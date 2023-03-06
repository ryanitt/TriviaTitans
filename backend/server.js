const express = require("express");
const socketIo = require("socket.io");
const http = require("http");
const he = require("he");

const fetch = require("node-fetch");

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

var answersRecieved = 0;
var totalPlayers = 0;
var totalPlayersSet = false;

var currentQuestion = "";
var answerOptions = [];
var correctAnswer = "";

// Room Management
let activeRooms = new Map();

const sendLobbyToRoom = (room) => {
  // Check if someone won
  activeRooms.get(room).forEach(function (value, key) {
    if (value >= 100) {
      io.in(room).emit("winner-found", { winner: key });
      activeRooms.get(room).forEach(function (value, key) {
        activeRooms.get(room).set(key, 0);
      });
    }
  });

  let serializableMap = JSON.stringify(Array.from(activeRooms.get(room)));

  io.in(room).emit("update-lobby", { lobby: serializableMap });
};

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

      activeRooms.set(data.room, new Map());
      activeRooms.get(data.room).set(data.username, 0);
      console.log(`${data.username} has connected`);

      socket.emit("assign-host", true);
      socket.emit("player-connection", playerIndex);
      socket.broadcast.to(data.room).emit("player-connection", playerIndex);
      socket.emit("room-code", data.room);

      sendLobbyToRoom(data.room);
    } else {
      // check if the code exists
      if (activeRooms.has(data.room)) {
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
        activeRooms.get(data.room).set(data.username, 0);
        console.log(activeRooms);
        // tell everyone which player just connected
        console.log(`${data.username} has joined ${data.room}`);

        socket.emit("join-success", true);
        socket.broadcast.to(data.room).emit("join-success", true);
        socket.emit("player-connection", playerIndex);
        socket.broadcast.to(data.room).emit("player-connection", playerIndex);
        socket.emit("room-code", data.room);
        sendLobbyToRoom(data.room);
      } else {
        socket.emit("invalid-code", true);
      }
    }
  });

  // Trivia Game Logic //

  // Fetching data from the trivia db
  const fetchData = async () => {
    const response = await fetch("https://opentdb.com/api.php?amount=1");

    const data = await response.json();
    const decodedData = decodeHtmlEntities(data);
    const type = decodedData.results[0].type;

    if (type === "multiple") {
      const multipleOptions = [
        decodedData.results[0].correct_answer,
        decodedData.results[0].incorrect_answers[0],
        decodedData.results[0].incorrect_answers[1],
        decodedData.results[0].incorrect_answers[2],
      ];
      const shuffledOptions = shuffleArray(multipleOptions);
      currentQuestion = decodedData.results[0].question;
      answerOptions = shuffledOptions;
      correctAnswer = decodedData.results[0].correct_answer;
    } else {
      const booleanOptions = ["True", "False"];
      currentQuestion = decodedData.results[0].question;
      answerOptions = booleanOptions;
      correctAnswer = decodedData.results[0].correct_answer;
    }
  };

  // Decode special http characters
  const decodeHtmlEntities = (obj) => {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }
    const decodedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      decodedObj[key] = decodeHtmlEntities(value);
      if (typeof decodedObj[key] === "string") {
        decodedObj[key] = he.decode(decodedObj[key]);
      }
    }
    return decodedObj;
  };

  // shuffle answers for choosing
  const shuffleArray = (arr) => {
    const shuffledArr = [...arr];
    for (let i = shuffledArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledArr[i], shuffledArr[j]] = [shuffledArr[j], shuffledArr[i]];
    }
    return shuffledArr;
  };

  // User clicks the "Start Game" button, only accesible to the host
  socket.on("initialize-game", (data) => {
    io.in(data.room).emit("started-game", {});
    if (!totalPlayersSet) {
      totalPlayers = activeRooms.get(data.room).size;
      totalPlayersSet = true;
    }
    sendLobbyToRoom(data.room);
  });

  // User requests a new question from the database
  socket.on("request-question", async (data) => {
    console.log("Requesting Question");
    await fetchData();
    answersRecieved = 0;
    io.in(data.room).emit("new-question", {
      currentQuestion: currentQuestion,
      answerOptions: answerOptions,
      correctAnswer: correctAnswer,
      time: 15,
    });
  });

  // User submits an answer to the server
  // TODO: adjust this function to increment the score based on how fast the user answered
  socket.on("submit-answer", async (data) => {
    answersRecieved++;

    var correctlyAnswered = data.answerOption === correctAnswer;
    if (correctlyAnswered) {
      console.log("Modifying Score: ", activeRooms.get(data.room));
      activeRooms
        .get(data.room)
        .set(data.username, activeRooms.get(data.room).get(data.username) + 10);
      console.log("Modified Score: ", activeRooms.get(data.room));
    }
    sendLobbyToRoom(data.room);

    console.log(
      `answersRecieved: ${answersRecieved}, totalPlayers: ${totalPlayers}, correctlyAnswered: ${correctlyAnswered}, data.answerOption: ${data.answerOption}, correctAnswer: ${correctAnswer}`
    );

    // If all users answer the question
    if (answersRecieved >= totalPlayers) {
      await fetchData();
      answersRecieved = 0;
      setTimeout(() => {
        io.in(data.room).emit("new-question", {
          currentQuestion: currentQuestion,
          answerOptions: answerOptions,
          correctAnswer: correctAnswer,
          time: 15,
        });
      }, 3000);
      return;
    }
  });
});

// start server and listen for port
server.listen(PORT, (err) => {
  if (err) console.log(err);
  console.log("Server running on Port ", PORT);
});
