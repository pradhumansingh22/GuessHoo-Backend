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


  redis.hSet(`game:${gameId}`, {
    player2Id: player2Id,
    player2Name: player2Name,
  });
});

const server = app.listen(8080, () => {
    console.log("WebSocket Server listening at port 8080");
})

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
    ws.on('error', (error) => { console.log(error) });
    console.log("connection established");

    ws.on('message', async (message: any) => {
        const { type, data } = JSON.parse(message);
        //Handle Game Actions
        switch (type) {
            //Image Selected by first player
            case "selection":
                redis.hSet(`game:${data.gameId}`, {"": data.selection });
                //may be not store it like this (dont wanna use player1 use playerId instead iguess)
        }
    })
})