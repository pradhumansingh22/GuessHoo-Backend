import "dotenv/config";
import express from "express";
import { getRedisClient, prisma } from "./db.js";
import { WebSocketServer } from "ws";
import cors from "cors";
import cloudinary from "../config/cloudinary.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(cors());

const redis = await getRedisClient();


app.post("/admin/img/upload", async (req, res) => {

  const data = await req.body;
  console.log("data", data);

  const file = data.file;
  //const isAdmin = adminMiddleware(hash);
  // if (!isAdmin) {
  //   return res.json({ message: "Unauthorized" }).status(401);
  // }
  //console.log("file", file);

  const uploadResult = await cloudinary.uploader
    .upload(
      file,
      {
        public_id: "images",
      }
    )
    .catch((error) => {
      console.log(error);
    });

  console.log(uploadResult);

  return res.json({ msg: "file uploaded" }).status(200);
})

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

  

    redis.hSet(`game:${newGame.gameId}`, {
      status: "created",
      player1Id: player1Id,
      player1Name: player1Name,
    });
    return res
      .json({ message: "Game Created", gameId: newGame.gameId,player1Id, success: true })
      .status(200);
  } catch (error) {
    console.log("Some error occurred while creating a game", error);
    return res.json({ message: "Some Error occurred" }).status(500);
  }
});

app.post("/game/:gameId/join", async (req, res) => {
  const gameId = req.params.gameId;
  console.log("gameId-",gameId);
  const { player2Name } = await req.body;
  const player2Id = crypto.randomUUID();

  const game = await prisma.game.findFirst({ where: { gameId } });
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
        const img2 = await redis.hGet(`game:${data.gameId}`, "player2SelectedImage");
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
          type:"chat",
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
