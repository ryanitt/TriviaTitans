const express = require("express");
const socketIo = require("socket.io");
const http = require("http");
const he = require("he");
const amqp = require("amqplib");
const fs = require("fs");

const app = express();

const server = http.createServer(app);

let PORT = process.env.PORT || 8080;

// MongoDB stuff
// const mongourl =
//   "mongodb+srv://triviatitans:triviatitans123@cluster0.gtvyghr.mongodb.net/?retryWrites=true&w=majority";
const mongourls = [
  "mongodb+srv://triviatitans:triviatitans123@cluster0.gtvyghr.mongodb.net/?retryWrites=true&w=majority",
  "mongodb+srv://triviatitans:triviatitans123@cluster0.jpzyzmh.mongodb.net/?retryWrites=true&w=majority",
  "mongodb+srv://triviatitans:triviatitans123@cluster0.b27r3yz.mongodb.net/?retryWrites=true&w=majority",
];
let dbNum = 0;
// const mongourl = "mongodb://127.0.0.1:27017/";

const { MongoClient } = require("mongodb");
let client = null;

async function connectClient() {
  try {
    console.log("Attempting to connect to DB", dbNum);
    client = await new MongoClient(mongourls[dbNum], {
      useNewUrlParser: true,
    }).connect();
    console.log("Successfully connected to DB", dbNum);
  } catch (err) {
    if (dbNum < 2) {
      console.log("Failed attempt to connect to DB", dbNum);
      dbNum++;
      connectClient();
    }
    console.log(err);
  }
}
connectClient();

async function QueryQuestion(room) {
  if (!activeRooms.has(room)) {
    return;
  }
  try {
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
    console.log("Got a new question", response);
    if (!response) {
      throw new Error("Question cannot be null!");
    }
    return response;
  } catch (error) {
    console.log("Question could not be retrieved from DB", dbNum);
    if (dbNum < 2) {
      dbNum++;
      connectClient();
      return QueryQuestion();
    }
  }
}
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

//mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }).then((result) => console.log("connected to db")).catch((err) => console.log(err));
const io = socketIo(server, {
  cors: {
    origin: "*",
  },
});

// RabbitMQ Message Queue connection
const exchangeName = "server-exchange";
const instanceId = process.env.INSTANCE_ID;

// Assume leader is srv1 to start
let leader = process.env.LEADER;
let leaderTimeout = null;

// Create heartbeat timeout to check if leader is alive
let heartbeatTimeout = null;

console.log(instanceId);

// Wait utility function (to allow connection to RabbitMQ service to connect properly)
function waitTime(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const mqSettings = {
  protocol: "amqp",
  hostname: "rabbitmq",
  port: 5672,
  username: "guest",
  password: "guest",
  vhost: "/",
  authMechanism: ["PLAIN", "AMQPLAIN", "EXTERNAL"],
};

// Publish functions

// Send active rooms to everyone
const updateData = () => {
  mqChannel.then(
    function (value) {
      const headers = {
        "instance-id": instanceId,
        "message-type": "data-update",
      };

      value.publish(
        exchangeName,
        "",
        Buffer.from(
          JSON.stringify(activeRooms, (key, value) => {
            if (value instanceof Map) {
              return Array.from(value.entries());
            }
            return value;
          })
        ),
        { headers }
      );
    },
    function (error) {
      console.log(error);
    }
  );
};
// Initiate an election for everyone
const initiateElection = () => {
  mqChannel.then(
    function (value) {
      const headers = {
        "instance-id": instanceId,
        "message-type": "initiate-election",
      };

      value.publish(exchangeName, "", Buffer.from(""), { headers });

      if (leaderTimeout != null) {
        clearTimeout(leaderTimeout);
      }
      leaderTimeout = setTimeout(leaderElected, 5000);

      console.log("Leader timeout started");
    },
    function (error) {
      console.log(error);
    }
  );
};
// Tell everyone I am the leader
const leaderElected = () => {
  mqChannel.then(
    function (value) {
      const headers = {
        "instance-id": instanceId,
        "message-type": "leader-elected",
      };
      // io.to(data.room).emit("leader-elected", {});

      value.publish(exchangeName, "", Buffer.from(""), { headers });
      leader = instanceId;
    },
    function (error) {
      console.log(error);
    }
  );
};
// Send heartbeat if I am the leader
const sendHeartbeat = () => {
  if (instanceId != leader) {
    return;
  }
  mqChannel.then(
    function (value) {
      const headers = {
        "instance-id": instanceId,
        "message-type": "send-heartbeat",
      };

      if (value) {
        value.publish(exchangeName, "", Buffer.from(""), { headers });
      }
    },
    function (error) {
      console.log(error.type);
    }
  );
};

// Consume functions

// Update new active rooms to additional data
const consumeUpdateData = (msg) => {
  if (msg.properties.headers["instance-id"] == instanceId) {
    console.log("Received my own room update");
  } else {
    activeRooms = new Map(JSON.parse(msg.content));
    console.log(
      "Updated active rooms with new data: " + [...activeRooms.entries()]
    );

    activeRooms.forEach(function (value, key) {
      activeRooms.get(key).players = new Map(activeRooms.get(key).players);
      activeRooms.get(key).questionsAsked = new Map(
        activeRooms.get(key).questionsAsked
      );
    });
  }
};

// New leader is trying to be elected
const consumeInitiateElection = (msg) => {
  if (msg.properties.headers["instance-id"] == instanceId) {
    console.log("Received my own leader election");
  } else {
    console.log(
      "Received someone else's leader election: " + msg.content.toString()
    );

    if (instanceId < msg.properties.headers["instance-id"]) {
      initiateElection();
    } else {
      if (leaderTimeout != null) {
        clearTimeout(leaderTimeout);
      }
    }
  }
};
// leader has been elected
const consumeLeaderElected = (msg) => {
  if (msg.properties.headers["instance-id"] == instanceId) {
    console.log("Received my leader election is successful");
  } else {
    console.log("Received someone else's leader election is successful");

    if (leaderTimeout != null) {
      clearTimeout(leaderTimeout);
    }
    leader = msg.properties.headers["instance-id"];
  }
};

// Recieve server switch update
const consumeServerSwitch = (msg) => {
  if (msg.properties.headers["leader-instance-id"] == instanceId) {
    console.log("Server switching to open leader port...");
  } else {
    console.log("Leader rebooting on open port 8080...");

    if (heartbeatTimeout != null) {
      clearTimeout(heartbeatTimeout);
    }
    heartbeatTimeout = setTimeout(initiateElection, 20000);
  }
};

// consume heartbeat message from leader
const consumeSendHeartbeat = (msg) => {
  if (msg.properties.headers["instance-id"] == instanceId) {
    console.log("Received my own heartbeat");
  } else {
    console.log(
      "Received heartbeat from leader ",
      msg.properties.headers["instance-id"]
    );

    if (heartbeatTimeout != null) {
      clearTimeout(heartbeatTimeout);
    }
    heartbeatTimeout = setTimeout(initiateElection, 7000);
  }
};

async function initializeMQ() {
  try {
    await waitTime(10000);
    const conn = await amqp.connect(mqSettings);
    console.log("RabbitMQ connection created...");
    const channel = await conn.createChannel();
    console.log("RabbitMQ channel created...");

    await channel.assertExchange(exchangeName, "fanout", { durable: false });

    const { queue } = await channel.assertQueue("queue_" + instanceId, {});
    await channel.bindQueue(queue, exchangeName, "");
    console.log("Rabbit Message Queue created...");

    channel.consume(
      queue,
      (msg) => {
        switch (msg.properties.headers["message-type"]) {
          case "data-update":
            consumeUpdateData(msg);
            break;
          case "initiate-election":
            consumeInitiateElection(msg);
            break;
          case "leader-elected":
            consumeLeaderElected(msg);
            break;
          case "send-heartbeat":
            consumeSendHeartbeat(msg);
            break;
          case "server-switch":
            consumeServerSwitch(msg);
            break;
          default:
            console.log(
              "Unknown message-type: " + msg.properties.headers["message-type"]
            );
            break;
        }
        channel.ack(msg);
      },
      { noAck: false }
    );

    return channel;
  } catch (error) {
    console.error(error);
  }
}

const mqChannel = initializeMQ();
setInterval(sendHeartbeat, 5000);

// Room Management
let activeRooms = null;

const initializeActiveRooms = () => {
  try {
    activeRooms = new Map(JSON.parse(fs.readFileSync("/app/data/config.json")));

    activeRooms.forEach(function (value, key) {
      activeRooms.get(key).players = new Map(activeRooms.get(key).players);
      activeRooms.get(key).questionsAsked = new Map(
        activeRooms.get(key).questionsAsked
      );
    });
    console.log("Config file parsed in as initial state");
    console.log("Parsed rooms:", activeRooms);
  } catch (error) {
    console.log("Config file was empty. Initializing empty state");
    activeRooms = new Map();
  }
};

function createRoom(roomCode) {
  let gameVariables = {
    players: new Map(),
    answerOptions: [],
    answersReceived: 0,
    totalPlayers: 0,
    totalPlayersSet: false,
    currentQuestion: "",
    correctAnswer: "",
    questionsAsked: new Map(),
    readyForNewQuestion: true,
    gameRunning: false,
  };
  activeRooms.set(roomCode, gameVariables);
}

const sendLobbyToRoom = (room) => {
  // Check if room still exists
  try {
    const recipientRoom = activeRooms.get(room);
    if (!recipientRoom) {
      console.log("Room", room, "isnt in activeRooms so cannot be sent to");
      return;
    }
  } catch (error) {
    return;
  }

  // Check if someone won
  activeRooms.get(room).players.forEach(function (value, key) {
    if (value >= 20) {
      io.in(room).emit("winner-found", { winner: key });
      activeRooms.get(room).gameRunning = false;
      activeRooms.get(room).players.forEach(function (value, key) {
        activeRooms.get(room).players.set(key, 0);
      });
    }
  });
  // Update lobby after checking for winner
  let serializableMap = JSON.stringify(
    Array.from(activeRooms.get(room).players)
  );
  updateData();

  // Write to volume to be accessed by docker containers
  fs.writeFile(
    "/app/data/config.json",
    JSON.stringify(activeRooms, (key, value) => {
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      return value;
    }),
    (err) => {
      if (err) throw err;
      console.log("Data written to config.json");
    }
  );
  console.log("Sending this lobby to room:", serializableMap);
  io.in(room).emit("update-lobby", { lobby: serializableMap, room: room });
};

function handleNewPlayer(room, username) {
  const gameVars = activeRooms.get(room);
  activeRooms.get(room).players.set(username, 0);
  gameVars.totalPlayers++;
  activeRooms.set(room, gameVars);
}

// Trivia Game Logic
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

// Fetching data from the trivia db
const fetchData = async (room) => {
  const response = await QueryQuestion(room);
  if (!response) {
    return;
  }
  const decodedData = decodeHtmlEntities(response);
  if (!decodedData) {
    return;
  }
  const type = decodedData["type"];
  const gameVars = activeRooms.get(room);

  if (!gameVars) {
    return;
  }

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
  updateData();
};

const requestQuestion = async (data) => {
  if (
    !data ||
    !data.room ||
    !activeRooms.has(data.room) ||
    !activeRooms.get(data.room).readyForNewQuestion
  ) {
    return;
  }

  await fetchData(data.room);

  const gameVars = activeRooms.get(data.room);
  gameVars.answersReceived = 0;
  // socket.emit("test", {});
  console.log("Sending requested question to Room", data.room);
  io.in(data.room).emit("new-question", {
    currentQuestion: gameVars.currentQuestion,
    answerOptions: gameVars.answerOptions,
    correctAnswer: gameVars.correctAnswer,
    time: 15,
  });
  gameVars.readyForNewQuestion = false;
  activeRooms.set(data.room, gameVars);

  setTimeout(() => {
    gameVars.readyForNewQuestion = true;
    activeRooms.set(data.room, gameVars);
  }, 3000);
};

initializeActiveRooms();

//in case server and client run on different urls
io.on("connection", (socket) => {
  // Setup rooms from config file
  try {
    let numOfRooms = 0;
    activeRooms.forEach(function (value, key) {
      socket.join(key);
      numOfRooms++;
    });
    if (numOfRooms > 0) {
      // console.log(numOfRooms, "rooms created in io", activeRooms);
      // console.log("Requesting frontend to rejoin games...")
      io.sockets.emit("request-rejoin", {});
    }
  } catch (error) {
    console.log("No old rooms to be remade in io");
    console.log("Active Rooms:", activeRooms);
    console.log(error);
  }

  socket.on("join-room", (data) => {
    if (data.newGame) {
      socket.join(data.room);
      console.log("New Game:", data.room);
      createRoom(data.room);
      handleNewPlayer(data.room, data.username);
      console.log(`${data.username} has connected to ${data.room}`);
      socket.emit("assign-host", true);
      socket.emit("room-code", data.room);

      setTimeout(() => {
        sendLobbyToRoom(data.room);
      }, 400);
    } else {
      // check if the code exists
      if (activeRooms.has(data.room)) {
        if (activeRooms.get(data.room).gameRunning) {
          socket.emit("game-running", true);
          console.log("Game is already running.");
          return;
        }
        // Allow a total of 5 players
        if (activeRooms.get(data.room).totalPlayers > 4) {
          socket.emit("limit-reached", true);
          console.log("Game limit reached.");
          return;
        }
        // ignore any players that have an existing username in the room
        if (activeRooms.get(data.room).players.has(data.username)) {
          socket.emit("username-taken", true);
          console.log("Username taken.");
          return;
        }
        socket.join(data.room);
        handleNewPlayer(data.room, data.username);
        // tell everyone which player just connected
        console.log(`${data.username} has joined ${data.room}`);

        socket.emit("join-success", true);
        socket.broadcast.to(data.room).emit("join-success", true);
        socket.emit("room-code", data.room);
        setTimeout(() => {
          socket.emit("room-code", data.room);
          sendLobbyToRoom(data.room);
        }, 400);
      } else {
        socket.emit("invalid-code", true);
      }
    }
  });

  socket.on("rejoin-room", (data) => {
    // console.log("Rejoining room with data:", data);

    if (activeRooms.has(data.room)) {
      socket.leaveAll();
      socket.join(data.room);
      socket.emit("room-code", data.room);

      if (activeRooms.get(data.room)?.gameRunning) {
        try {
          requestQuestion({ room: data.room });
        } catch (error) {
          console.log(error);
        }
      }
      setTimeout(() => {
        sendLobbyToRoom(data.room);
      }, 400);
      setTimeout(() => {
        sendLobbyToRoom(data.room);
      }, 2000);
    } else {
      console.log("Active rooms did not find", data.room);
      console.log("Current Active Rooms is this:", activeRooms);
      socket.emit("invalid-code", true);
    }
  });

  // User clicks the "Start Game" button, only accesible to the host
  socket.on("initialize-game", (data) => {
    console.log("Room starting");
    io.in(data.room).emit("started-game", {});
    const gameVars = activeRooms.get(data.room);
    gameVars.gameRunning = true;
    activeRooms.set(data.room, gameVars);

    if (!activeRooms.get(data.room).totalPlayersSet) {
      activeRooms.get(data.room).totalPlayersSet = true;
    }
    sendLobbyToRoom(data.room);
  });
  // User requests a new question from the database
  socket.on("request-question", requestQuestion);

  // User submits an answer to the server
  // TODO: adjust this function to increment the score based on how fast the user answered
  socket.on("submit-answer", async (data) => {
    const gameVars = activeRooms.get(data.room);
    if (!gameVars) {
      return;
    }
    gameVars.answersReceived++;
    var correctlyAnswered = data.answerOption === gameVars.correctAnswer;
    console.log(
      "Correct Answer:",
      gameVars.correctAnswer,
      "Selected Answer:",
      data.answerOption,
      "Correct:",
      correctlyAnswered
    );
    console.log("data:", data);
    if (correctlyAnswered) {
      // Increment the amount of points recieved based on amount of time left
      let scoreInc = 0;
      if (data.timeLeft >= 13) {
        scoreInc = 10;
      } else if (data.timeLeft >= 11) {
        scoreInc = 8;
      } else if (data.timeLeft >= 9) {
        scoreInc = 5;
      } else if (data.timeLeft >= 5) {
        scoreInc = 3;
      } else {
        scoreInc = 1;
      }
      gameVars.players.set(
        data.username,
        gameVars.players.get(data.username) + scoreInc
      );
      console.log("Modified Score: ", activeRooms.get(data.room));
    }

    activeRooms.set(data.room, gameVars);
    sendLobbyToRoom(data.room);

    // If all users answer the question
    if (
      gameVars.answersReceived >= gameVars.totalPlayers &&
      gameVars.gameRunning
    ) {
      await fetchData(data.room);
      gameVars.answersReceived = 0;
      setTimeout(async () => {
        console.log("Sending timeout question to Room", data.room);
        await fetchData(data.room);
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

  socket.on("leave-room", async (data) => {
    const gameVars = activeRooms.get(data.room);
    if (gameVars) {
      gameVars.players.delete(data.username);
      gameVars.totalPlayers--;
      activeRooms.set(data.room, gameVars);
      console.log(`Player ${data.username} has left`);
      socket.leaveAll();
    }
    console.log(`Synchronizing lobby data with players...`);
    sendLobbyToRoom(data.room);

    // Now that 1 player left, recheck if new question required
    if (
      gameVars?.answersReceived >= gameVars?.totalPlayers &&
      gameVars?.gameRunning
    ) {
      await fetchData(data.room);
      gameVars.answersReceived = 0;
      setTimeout(() => {
        console.log("Sending timeout leave-game question to Room", data.room);
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

  // if host leaves, delete the room
  socket.on("host-left", (data) => {
    activeRooms.delete(data.room);
    console.log(`Host left the game. Room ${data.room} has been deleted`);
    socket.leaveAll();
    io.to(data.room).emit("room-deleted", {});
    updateData();
  });
});

// start server and listen for current port
server.listen(PORT, (err) => {
  if (err) console.log(err);
  if (instanceId == leader) {
    console.log("Leader server running on Port ", PORT);
  } else {
    console.log("Replica server running on Port ", PORT);
  }
});
