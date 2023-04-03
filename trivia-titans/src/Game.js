import "./App.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppShell,
  Button,
  Card,
  Center,
  Header,
  Image,
  Navbar,
  SimpleGrid,
  Space,
  Text,
  UnstyledButton,
} from "@mantine/core";
import logo from "./logo-removebg-preview.png";

const Game = (props) => {
  let socket = props.socket;

  // useStates for the game
  const navigate = useNavigate();
  const lobbyStatus = useRef(new Map());
  const [lobbyElements, setLobbyElements] = useState([]);
  const [room, setRoom] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [startGame, setStartGame] = useState(false);
  const [endedGame, setEndedGame] = useState(false);
  const [winner, setWinner] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerOptions, setAnswerOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [clicked, setClicked] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [seconds, setSeconds] = useState(15);
  const { state } = useLocation();
  const { username } = state;

  /********* Component functions /*********/

  const initializeGame = () => {
    console.log("Initializing Game");
    socket.emit("initialize-game", { room: room });
    socket.emit("request-question", { room: room });
  };

  const handleAnswerOptionClick = (answerOption) => {
    if (!clicked) {
      setClicked(true);
      console.log(room, username, answerOption, seconds);
      socket.emit("submit-answer", {
        room: room,
        username: username,
        answerOption: answerOption,
        timeLeft: seconds
      });
    }
  };

  const clearQuestionStates = () => {
    setWinner("");
    setCurrentQuestion("");
    setAnswerOptions([]);
    setCorrectAnswer("");
  };

  // Timer
  function Timer(props) {
    const intervalRef = useRef(null);
  
    useEffect(() => {
      if (seconds === 0 || props.clicked ) {
        props.handleTimer();
      } else {
        intervalRef.current = setInterval(() => {
          if (seconds === 0) {
            clearInterval(intervalRef.current);
          } else {
            setSeconds(seconds - 1);
          }
        }, 1000);
      }
  
      return () => clearInterval(intervalRef.current);
    }, [props]);
  
    return (
      <div>
        <Card bg="#393f4a" shadow="sm" radius="md" sx={{ width: 100 }}>
          <Text size="xl" fw={500} ta="center">
            {seconds.toLocaleString("en-US", { minimumIntegerDigits: 2 })}
          </Text>
        </Card>
      </div>
    );
  }

  const handleTimer = () => {
    setClicked(true);
    setTimerStarted(false);
    setTimeout(() => {
      setAnswerOptions([]);
      setCurrentQuestion("");
      setCorrectAnswer("");
      socket.emit("request-question", { room: room });
      setTimerStarted(true);
    }, 3000);
  };

  const backToLobby = () => {
    setStartGame(false);
    setEndedGame(false);
    setWinner("");
    clearQuestionStates();
  };

  const handleExit = () => {
    if (isHost) {
      socket.emit("host-left", { room: room });
    } else {
      socket.emit("leave-room", { room: room, username: username });
    }
  };

  const arrangeLobby = useCallback(
    (lobby) => {
      lobbyStatus.current.clear();
      lobbyStatus.current = lobby;

      // Generate cards
      const elements = [];
      lobby.forEach(function (value, key) {
        if (key === username) {
          elements.push(
            <>
              <Card bg="#E67700" shadow="sm" radius="md">
                <Center>
                  <Text fz="lg" color="white" fw={500}>
                    {key}: {value}
                  </Text>
                </Center>
              </Card>
              <Space h="sm" />
            </>
          );
        } else {
          elements.push(
            <>
              <Card bg="#393f4a" shadow="sm" radius="md">
                <Center>
                  <Text fz="lg" color="white" fw={500}>
                    {key}: {value}
                  </Text>
                </Center>
              </Card>
              <Space h="sm" />
            </>
          );
        }
      });
      setLobbyElements(elements);
    },
    [username]
  );

  /********* Socket Events /*********/

  socket.on("room-code", (data) => {
    setRoom(data);
  });

  socket.on("assign-host", (data) => {
    setIsHost(data);
  });

  socket.on("started-game", () => {
    setStartGame(true);
    setTimerStarted(true);
  });

  socket.on("new-question", (data) => {
    setCurrentQuestion(data.currentQuestion);
    setAnswerOptions(data.answerOptions);
    setCorrectAnswer(data.correctAnswer);
    setSeconds(data.time);
    setClicked(false);

  });

  socket.on("room-deleted", () => {
    navigate("/", { state: isHost ? false : true });
  });

  useEffect(() => {
    console.log(room, username, isHost);
  }, [room, username, isHost]);

  useEffect(() => {
    socket.on("update-lobby", (data) => {
      arrangeLobby(new Map(JSON.parse(data.lobby)));
    });
  }, [arrangeLobby, socket]);

  useEffect(() => {
    socket.on("winner-found", (data) => {
      setWinner(data.winner);
      setStartGame(false);
      setEndedGame(true);
      setTimerStarted(false);
    });
  }, [winner, socket]);

  useEffect(() => {
    socket.on("request-rejoin", () => {
      clearQuestionStates();
      socket.emit("rejoin-room", {
        room: room,
      });
    });
  }, [socket, room]);

  return (
    <AppShell
      padding="md"
      navbar={
        <Navbar width={{ base: 200 }} height={"100vh"} p="xs">
          {lobbyElements}
        </Navbar>
      }
      header={
        <Header height={70}>
          <Button
            size="lg"
            component={Link}
            to="/"
            className="exit"
            onClick={handleExit}
          >
            Exit
          </Button>

          <Center>
            <Image width={250} src={logo} fit="contain" className="logo" />
          </Center>
          <Text className="room-code" fz="xl" color="white" fw={500}>
            Room Code: {room}
          </Text>
        </Header>
      }
    >
      <Center>
        {clicked ? null : timerStarted ? (
          <Timer
            initialTime={seconds}
            handleTimer={handleTimer}
            clicked={clicked}
          />
        ) : null}
      </Center>
      <div className="centered">
        {startGame ? (
          <Card className="question-card" shadow="sm" radius="md">
            <Center>
              <Text c="white" fz="xl" fw={500} ta="center">
                {currentQuestion}
              </Text>
            </Center>
            <Space h="xl" />
            <SimpleGrid cols={2}>
              {answerOptions.map((option) => (
                <UnstyledButton
                  sx={{
                    backgroundColor: clicked
                      ? option === correctAnswer
                        ? "#2B8A3E"
                        : "#C92A2A"
                      : "#1864ab",
                    borderRadius: "5px",
                    "&:hover": {
                      backgroundColor: "#339af0",
                    },
                  }}
                  p="md"
                  key={option}
                  onClick={() => handleAnswerOptionClick(option)}
                  className={
                    clicked ? "answer-button--disabled" : "answer-button"
                  }
                >
                  <Text
                    truncate={false}
                    lineClamp={2}
                    ta="center"
                    fw={500}
                    color="white"
                  >
                    {option}
                  </Text>
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </Card>
        ) : endedGame ? (
          <Center>
            <SimpleGrid>
              <div>
                <Text c="white" fz="xl" fw={500} ta="center">
                  The winner is {winner}!
                </Text>
              </div>
              <div>
                <Button size="xl" onClick={backToLobby}>
                  Back to Lobby
                </Button>
              </div>
            </SimpleGrid>
          </Center>
        ) : isHost ? (
          <Button size="xl" onClick={initializeGame}>
            Start Game
          </Button>
        ) : (
          <Text c="white" fz="xl" fw={500} ta="center">
            Waiting for host to start game...
          </Text>
        )}
      </div>
    </AppShell>
  );
};

export default Game;
