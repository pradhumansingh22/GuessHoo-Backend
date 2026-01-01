import "dotenv/config";
import express from "express";
import { getRedisClient, prisma } from "./db.js";
import { WebSocketServer } from "ws";
import cors from "cors";
import cloudinary from "../config/cloudinary.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import multer from "multer";


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());

const redis = await getRedisClient();

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/admin/img/upload", upload.single("file"), async (req, res) => {
  const { poolName, imageName, password } = await req.body;  


  const isAdmin = await adminMiddleware(password);
  
  console.log("isAdmin", isAdmin);
  if (!isAdmin) {
    return res.json({ message: "Unauthorized" }).status(401);
  }

  cloudinary.uploader
    .upload_stream({ folder: poolName }, async (error, result) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ message: "Upload failed" });
      }

      const imageUrl = result?.secure_url!;

      const existingPool = await prisma.imagePool.findFirst({
        where: { poolName },
      });

      if (existingPool) {
        await prisma.image.create({
          data: {
            imageName: imageName as string,
            imageUrl,
            poolId: existingPool.id,
          },
        });
      } else {
        await prisma.imagePool.create({
          data: {
            poolName,
            images: {
              create: {
                imageName,
                imageUrl,
              },
            },
          },
        });
      }

      return res.status(200).json({
        message: "File uploaded",
        success: true,
      });
    })
    .end(req.file!.buffer);
});

app.post("/game/create", async (req, res) => {
  console.log("Request Came");
  const { player1Name } = await req.body;
  const player1Id = crypto.randomUUID();
  try {
    const newGame = await prisma.game.create({
      data: {
        createdAt: new Date(Date.now()),
      },
    });

    redis.hSet(`game:${newGame.id}`, {
      status: "created",
      player1Id: player1Id,
      player1Name: player1Name,
    });
    return res
      .json({
        message: "Game Created",
        gameId: newGame.id,
        player1Id,
        success: true,
      })
      .status(200);
  } catch (error) {
    console.log("Some error occurred while creating a game", error);
    return res.json({ message: "Some Error occurred" }).status(500);
  }
});

app.post("/game/:gameId/join", async (req, res) => {
  const gameId = req.params.gameId;
  console.log("gameId-", gameId);
  const { player2Name } = await req.body;
  const player2Id = crypto.randomUUID();

  const game = await prisma.game.findFirst({ where: { id: gameId } });
  if (!game) {
    return res.json({ message: "Invalid Id", success: false }).status(400);
  }

  try {
    await redis.hSet(`game:${gameId}`, {
      status: "full",
      player2Id: player2Id,
      player2Name: player2Name,
    });
    const player1Name = await redis.hGet(`game:${gameId}`, "player1Name");

    return res
      .json({
        message: "Game Joined",
        success: true,
        player2Id,
        player1Name,
      })
      .status(200);
  } catch (error) {
    console.log("Some error occurred while joining a game", error);
    return res.json({ message: "Some Error occurred" }).status(500);
  }
});

app.get("/images/:poolId", async (req, res) => {
  const poolId = req.params.poolId;
  const images = await prisma.image.findMany({ where: { poolId } });
  
  return res.json({ images, success: true }).status(200);
})

const server = app.listen(8080, () => {
  console.log("WebSocket Server listening at port 8080");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("error", (error) => {
    console.log(error);
  });
  console.log("connection established");

  ws.on("message", async (message: any) => {
    const { type, data } = JSON.parse(message);
    //Handle Game Actions
    switch (type) {
      case "create":
        console.log("Message came to create game");
        const player1Id = crypto.randomUUID();
        const gameId = crypto.randomUUID();
        try {
          // const newGame = await prisma.game.create({
          //   data: {
          //     createdAt: new Date(Date.now()),
          //   },
          // });

          redis.hSet(`game:${gameId}`, {
            status: "created",
            player1Id: player1Id,
            player1Name: data.player1Name,
          });
          sendSocketMessage({
            type: "create",
            success: "true",
            gameId: gameId,
            player1Id: player1Id,
          });
        } catch (error) {
          console.log("Some error occurred while creating a game", error);
          sendSocketMessage({
            type: "create",
            success: "false",
          });
        }
        break;

      case "selection1":
        await redis.hSet(`game:${data.gameId}`, {
          player1SelectedImage: data.selection,
        });
        const img2 = await redis.hGet(
          `game:${data.gameId}`,
          "player2SelectedImage"
        );
        if (img2) sendSocketMessage({ type: "imageSelection" });
        break;

      case "selection2":
        await redis.hSet(`game:${data.gameId}`, {
          player2SelectedImage: data.selection,
        });
        const img1 = await redis.hGet(
          `game:${data.gameId}`,
          "player1SelectedImage"
        );
        if (img1) sendSocketMessage({ type: "imageSelection" });
        break;

      case "start":
        await redis.hSet(`game:${data.gameId}`, { status: "started" });

      case "guess":
        const guessedByPlayer = data.guessedByPlayer;
        const playerNo = guessedByPlayer == "player1" ? "player2" : "player1";
        const selectedImage = await redis.hGet(
          `game:${data.gameId}`,
          `${playerNo}SelectedImage`
        );

        const isCorrect = selectedImage == data.guessedImage;
        if (isCorrect) {
          await redis.hSet(`game:${data.gameId}`, { status: "over" });

          setTimeout(async () => {
            await redis.DEL(`game:${data.gameId}`);
          }, 1000 * 60 * 5);

          sendSocketMessage({
            type: "guess",
            result: "gameOver",
            winner: playerNo,
          });
        } else
          sendSocketMessage({
            type: "guess",
            result: "incorrect",
          });
        break;

      case "chat":
        sendSocketMessage({
          type: "chat",
          sendBy: data.name,
          msg: data.chatMessage,
        });
        break;
    }
  });
});

const sendSocketMessage = (messageData: any) => {
  if (!wss) {
    console.log("WebSocket not found");
    return;
  }

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(messageData));
    }
  });
};
