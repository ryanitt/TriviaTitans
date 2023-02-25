const express = require("express");
const socketIo = require("socket.io");
const http = require("http");
const e = require("express");


const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});


// Room Management
let activeRooms = [];

//in case server and client run on different urls
let connections = [null, null, null, null, null];
io.on("connection", (socket) => {
  socket.on("join-room", (data) => {
    let playerIndex = -1;
    if (data.newGame) {
      playerIndex = 0;
      connections[playerIndex] = false;
      // this is player 1 - mark that dude
      socket.join(data.room);
      console.log("New Game:", data.room);
      console.log(`Player ${playerIndex} has connected`);
      activeRooms.push(data.room);
      socket.emit("player-number", playerIndex);
      socket.broadcast.to(data.room).emit("player-number", playerIndex);
      socket.emit("player-connection", playerIndex);
      socket.broadcast.to(data.room).emit("player-connection", playerIndex);
      socket.emit("room-code", data.room);
    } else {
      // check if the code exists
      let foundCode = activeRooms.find((validCode) => {
        return validCode == data.room;
      });
      if (foundCode) {
        for (const i in connections) {
          if (connections[i] === null) {
            playerIndex = i;
            break;
          }
        }
        // ignore any players beyond 5
        if (playerIndex === -1) {
          socket.emit("limit-reached", true);
          console.log("Game limit reached.");
          return;
        }
        socket.join(data.room);
        connections[playerIndex] = false;

        // tell everyone which player just connected
        console.log(`Player ${playerIndex} has joined ${data.room}`);
        socket.emit("join-success", true);
        socket.broadcast.to(data.room).emit("join-success", true);
        socket.emit("player-number", playerIndex);
        socket.broadcast.to(data.room).emit("player-number", playerIndex);
        socket.emit("player-connection", playerIndex);
        socket.broadcast.to(data.room).emit("player-connection", playerIndex);
        socket.emit("room-code", data.room);
      } else {
        socket.emit("invalid-code", true);
      }
    }
  });

  
  // Actual FUNCTIONALITY (TO BE REMOVED)
  socket.on("draw-line", (data) => {
    socket.broadcast
      .to(data.room)
      .emit("update-line", { id: data.lineId, turn: data.currentTurn });
  });

  socket.on("increment-turn", (data) => {
    let turn = 0;
    if (data.currentTurn > 3) turn = 1;
    else turn = data.currentTurn;
    socket.emit("get-turn", turn);
    socket.broadcast.to(data.room).emit("get-turn", turn);
  });

  socket.on("reset-game", (room) => {
    let index = activeRooms.findIndex((validCode) => {
      return validCode == room;
    });
    activeRooms.splice(index, 1);
    connections = [null, null, null];
  });
});

// start server and listen for port
server.listen(PORT, (err) => {
  if (err) console.log(err);
  console.log("Server running on Port ", PORT);
});
