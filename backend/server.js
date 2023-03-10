const express = require("express");
const socketIo = require("socket.io");
const http = require("http");
const he = require("he");
const amqp = require('amqplib');

const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);

// MongoDB stuff
const mongourl =
  "mongodb+srv://triviatitans:triviatitans123@cluster0.gtvyghr.mongodb.net/?retryWrites=true&w=majority";
const { MongoClient } = require("mongodb");
const client = new MongoClient(mongourl);
async function connectClient() {
  try {
    await client.connect();
  } catch (err) {
    console.log(err);
  }
}
connectClient();

async function QueryQuestion(room) {
  var db = client.db("triviatitans");
  randomQuestionNum = getRandomInt(2149);
  while (activeRooms.get(room).questionsAsked.has(randomQuestionNum)) {
    randomQuestionNum = getRandomInt(2149);
  }
  activeRooms.get(room).questionsAsked.set(randomQuestionNum, 1);
  response = await db
    .collection("questions")
    .find()
    .limit(-1)
    .skip(randomQuestionNum)
    .next();
  return response;
}
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

//mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }).then((result) => console.log("connected to db")).catch((err) => console.log(err));
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

// RabbitMQ Message Queue connection

const exchangeName = 'my-exchange';
const instanceId = process.env.INSTANCE_ID;
console.log(instanceId);

const mqSettings = {
  protocol: 'amqp',
  hostname: 'rabbitmqhost',
  port: 5672,
  username: 'guest',
  password: 'guest',
  vhost: '/',
  authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
}

async function initializeMQ() {
  try {

    const conn = await amqp.connect(mqSettings);
    console.log("RabbitMQ connection created...");
    const channel = await conn.createChannel();
    console.log("RabbitMQ channel created...");

    await channel.assertExchange(exchangeName, 'fanout', { durable: false });

    const { queue } = await channel.assertQueue('titanQueue', {});
    await channel.bindQueue(queue, exchangeName, '');
    console.log("Rabbit Message Queue created...");

    channel.consume(queue, (msg) => {
      if(msg.properties.headers["instance-id"] == instanceId) {
        console.log("Recieved my own message");
        channel.nack(msg, false, true);


      } else {
        console.log("Recieved someone else's message: " + msg.content.toString());
        channel.ack(msg);
      }
      // activeRooms = new JSON.parse(msg));
      // console.log("New Active Rooms: " + activeRooms);
    }, {noAck: false});

    return channel;

  } catch (error) {
    console.error("Error: " + error);
  }
}

const mqChannel = initializeMQ();

// Room Management
let activeRooms = new Map();

function createRoom(roomCode) {
  let gameVariables = {
    players: new Map(),
    answerOptions: [],
    answersRecieved: 0,
    totalPlayers: 0,
    totalPlayersSet: false,
    currentQuestion: "",
    correctAnswer: "",
    questionsAsked: new Map(),
  };
  activeRooms.set(roomCode, gameVariables);
}

const updateMQ = () => {
  mqChannel.then(
    function(value) {
      const headers = { 'instance-id': instanceId };

      value.publish(exchangeName, '', Buffer.from(JSON.stringify(activeRooms, (key, value) => {
        if (value instanceof Map) {
          return Array.from(value.entries());
        }
        return value;
      })), {headers});
    },
    function(error) {
      console.log(error);
    }
  );
}

const sendLobbyToRoom = (room) => {
  // Check if someone won
  activeRooms.get(room).players.forEach(function (value, key) {
    if (value >= 20) {
      io.in(room).emit("winner-found", { winner: key });
      activeRooms.get(room).players.forEach(function (value, key) {
        activeRooms.get(room).players.set(key, 0);
      });
    }
  });
  // Update lobby after checking for winner
  let serializableMap = JSON.stringify(
    Array.from(activeRooms.get(room).players)
  );
  updateMQ();

  io.in(room).emit("update-lobby", { lobby: serializableMap, room: room });
};

function handleNewPlayer(room, username) {
  const gameVars = activeRooms.get(room);
  activeRooms.get(room).players.set(username, 0);
  gameVars.totalPlayers++;
  activeRooms.set(room, gameVars);
}

//in case server and client run on different urls
io.on("connection", (socket) => {
  socket.on("join-room", (data) => {
    if (data.newGame) {
      socket.join(data.room);
      console.log("New Game:", data.room);
      createRoom(data.room);
      handleNewPlayer(data.room, data.username);
      console.log(`${data.username} has connected to ${data.room}`);
      socket.emit("assign-host", true);
      socket.emit("player-connection", {});
      socket.broadcast.to(data.room).emit("player-connection", {});
      socket.emit("room-code", data.room);

      sendLobbyToRoom(data.room);
    } else {
      // check if the code exists
      if (activeRooms.has(data.room)) {
        // ignore any players beyond 5
        if (activeRooms.get(data.room).totalPlayers > 5) {
          socket.emit("limit-reached", true);
          console.log("Game limit reached.");
          return;
        }
        socket.join(data.room);
        handleNewPlayer(data.room, data.username);
        // tell everyone which player just connected
        console.log(`${data.username} has joined ${data.room}`);

        socket.emit("join-success", true);
        socket.broadcast.to(data.room).emit("join-success", true);
        socket.emit("player-connection", {});
        socket.broadcast.to(data.room).emit("player-connection", {});
        socket.emit("room-code", data.room);
        setTimeout(() => {
          sendLobbyToRoom(data.room);
        }, 100);
      } else {
        socket.emit("invalid-code", true);
      }
    }
  });

  // Trivia Game Logic //

  // Fetching data from the trivia db
  const fetchData = async (room) => {
    const response = await QueryQuestion(room);
    const decodedData = decodeHtmlEntities(response);
    const type = decodedData["type"];

    const gameVars = activeRooms.get(room);

    if (type === "multiple") {
      const multipleOptions = [
        decodedData["correct_answer"],
        decodedData["incorrect_answers"][0],
        decodedData["incorrect_answers"][1],
        decodedData["incorrect_answers"][2],
      ];
      const shuffledOptions = shuffleArray(multipleOptions);
      gameVars.currentQuestion = decodedData["question"];
      gameVars.answerOptions = shuffledOptions;
      gameVars.correctAnswer = decodedData["correct_answer"];
    } else {
      const booleanOptions = ["True", "False"];
      gameVars.currentQuestion = decodedData["question"];
      gameVars.answerOptions = booleanOptions;
      gameVars.correctAnswer = decodedData["correct_answer"];
    }
    activeRooms.set(room, gameVars);
    updateMQ();
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
    if (!activeRooms.get(data.room).totalPlayersSet) {
      activeRooms.get(data.room).totalPlayersSet = true;
    }
    sendLobbyToRoom(data.room);
  });

  // User requests a new question from the database
  socket.on("request-question", async (data) => {
    console.log("Requesting Question");
    await fetchData(data.room);
    const gameVars = activeRooms.get(data.room);
    gameVars.answersRecieved = 0;
    io.in(data.room).emit("new-question", {
      currentQuestion: gameVars.currentQuestion,
      answerOptions: gameVars.answerOptions,
      correctAnswer: gameVars.correctAnswer,
      time: 15,
    });
    activeRooms.set(data.room, gameVars);
  });

  // User submits an answer to the server
  // TODO: adjust this function to increment the score based on how fast the user answered
  socket.on("submit-answer", async (data) => {
    const gameVars = activeRooms.get(data.room);
    gameVars.answersRecieved++;
    var correctlyAnswered = data.answerOption === gameVars.correctAnswer;
    if (correctlyAnswered) {
      gameVars.players.set(
        data.username,
        gameVars.players.get(data.username) + 10
      );
      console.log("Modified Score: ", activeRooms.get(data.room));
    }

    // console.log(
    //   `answersRecieved: ${gameVars.answersRecieved}, totalPlayers: ${gameVars.totalPlayers}, correctlyAnswered: ${correctlyAnswered}, data.answerOption: ${data.answerOption}, correctAnswer: ${gameVars.correctAnswer}`
    // );

    // If all users answer the question
    if (gameVars.answersRecieved >= gameVars.totalPlayers) {
      await fetchData(data.room);
      gameVars.answersRecieved = 0;
      setTimeout(() => {
        io.in(data.room).emit("new-question", {
          currentQuestion: gameVars.currentQuestion,
          answerOptions: gameVars.answerOptions,
          correctAnswer: gameVars.correctAnswer,
          time: 15,
        });
      }, 3000);
      return;
    }
    activeRooms.set(data.room, gameVars);
    sendLobbyToRoom(data.room);
  });

  socket.on("leave-room", (data) => {
    const gameVars = activeRooms.get(data.room);
    gameVars.players.delete(data.username);
    gameVars.totalPlayers--;
    activeRooms.set(data.room, gameVars);
    console.log(`Player ${data.username} has left`);
    sendLobbyToRoom(data.room);
});

  // if host leaves, delete the room
  socket.on("host-left", (data) => {
    activeRooms.delete(data.room);
    console.log(`Host left the game. Room ${data.room} has been deleted`);
    io.to(data.room).emit("room-deleted", {});
    updateMQ();
  });
});

// start server and listen for port
server.listen(PORT, (err) => {
  if (err) console.log(err);
  console.log("Server running on Port ", PORT);
});
