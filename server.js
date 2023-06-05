require('dotenv').config();
const express = require("express");
const http = require("http");
const path = require("path");
const socketio = require("socket.io");

const app = express();

const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const io = socketio(server);

const { userConnected, connectedUsers, initializeChoices, moves, makeMove, choices } = require("./lobby/users");
const { createRoom, joinRoom, exitRoom, rooms } = require("./lobby/rooms");
const e = require("express");
const { exitCode } = require("process");

io.on("connection", socket => {
  socket.on("create-room", (roomId) => {
    if (rooms[roomId]) {
      const error = "This room already exists";
      socket.emit("display-error", error);
    } else {
      userConnected(socket.client.id);
      createRoom(roomId, socket.client.id);
      socket.emit("room-created", roomId);
      socket.emit("player-1-connected");
      socket.join(roomId);
    }
  })

  socket.on("join-room", roomId => {
    if (!rooms[roomId]) {
      const error = "This room doesn't exist";
      socket.emit("display-error", error);
    } else {
      userConnected(socket.client.id);
      joinRoom(roomId, socket.client.id);
      socket.join(roomId);

      socket.emit("room-joined", roomId);
      socket.emit("player-2-connected");
      socket.broadcast.to(roomId).emit("player-2-connected");
      initializeChoices(roomId);
    }
  })

  socket.on("join-random", () => {
    let roomId = "";

    for (let id in rooms) {
      if (rooms[id][1] === "") {
        roomId = id;
        break;
      }
    }

    if (roomId === "") {
      const error = "All rooms are full or none exists";
      socket.emit("display-error", error);
    } else {
      userConnected(socket.client.id);
      joinRoom(roomId, socket.client.id);
      socket.join(roomId);

      socket.emit("room-joined", roomId);
      socket.emit("player-2-connected");
      socket.broadcast.to(roomId).emit("player-2-connected");
      initializeChoices(roomId);
    }
  });

  socket.on("make-move", ({ playerId, myChoice, roomId }) => {
    if (choices[roomId][0] !== "" && choices[roomId][1] !== "") {
      return; // Ignore the move if both players have already made their choices
    }
    
    makeMove(roomId, playerId, myChoice);

    if (choices[roomId][0] !== "" && choices[roomId][1] !== "") {
      let playerOneChoice = choices[roomId][0];
      let playerTwoChoice = choices[roomId][1];

      if (playerOneChoice === playerTwoChoice) {
        let message = "Both of you chose " + playerOneChoice + ". So it's a draw";
        io.to(roomId).emit("draw", message);
      } else if (moves[playerOneChoice] === playerTwoChoice) {
        let enemyChoice = playerId === 1 ? playerTwoChoice : playerOneChoice;
        io.to(roomId).emit("player-1-wins", { myChoice, enemyChoice });
      } else {
        let enemyChoice = playerId === 1 ? playerTwoChoice : playerOneChoice;
        io.to(roomId).emit("player-2-wins", { myChoice, enemyChoice });
      }

      choices[roomId] = ["", ""];
    }
  });

  socket.on("disconnect", () => {
    if (connectedUsers[socket.client.id]) {
      let player;
      let roomId;

      for (let id in rooms) {
        if (rooms[id][0] === socket.client.id || rooms[id][1] === socket.client.id) {
          player = rooms[id][0] === socket.client.id ? 1 : 2;
          roomId = id;
          break;
        }
      }

      exitRoom(roomId, player);

      if (player === 1) {
        io.to(roomId).emit("player-1-disconnected");
      } else {
        io.to(roomId).emit("player-2-disconnected");
      }
    }
  })
})

server.listen(process.env.PORT || 3000, function () {
  console.log("Server is running on port " + (process.env.PORT || 3000));
});
