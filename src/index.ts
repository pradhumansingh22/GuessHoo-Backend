import express from "express";
import { getRedisClient, prisma } from "./db.js";
import { WebSocketServer } from "ws";

const app = express();

app.use(express.json());

const redis = await getRedisClient();

app.post("/game/create", async (req, res) => {
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
      .json({ message: "Game Created", gameId: newGame.gameId })
      .status(200);
  } catch (error) {
    console.log("Some error occurred while creating a game", error);
    return res.json({ message: "Some Error occurred" }).status(500);
  }
});

app.post("/game/:gameId/join", async (req, res) => {
  const gameId = req.params.gameId;
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
    const player1Id = await redis.hGet(`game:${gameId}`, "player1Id");
    const player1Name = await redis.hGet(`game:${gameId}`, "player1Name");

    return res
      .json({
        message: "Game Joined",
        success: true,
        player2Id,
        player1Id,
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
            player1Name: data.player1Name,
          });
          sendSocketMessage({
            type: "create",
            success: "true",
            gameId: newGame.gameId,
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
        break;

      case "selection2":
        await redis.hSet(`game:${data.gameId}`, {
          player2SelectedImage: data.selection,
        });
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

        const isCorrect = selectedImage == data.guess;
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
