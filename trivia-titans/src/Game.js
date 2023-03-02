import "./App.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
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
// import Timer from "./Timer";

const Game = (props) => {

  let socket = props.socket

  const lobbyStatus = useRef(new Map());
  const [lobbyElements, setLobbyElements] = useState([]);

  const [startGame, setStartGame] = useState(false);
  const [endedGame, setEndedGame] = useState(false);
  const [winner, setWinner] = useState("");


  const [room, setRoom] = useState("");

  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerOptions, setAnswerOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [clicked, setClicked] = useState(false);

  // const seconds = 15;
  // const [timerStarted, setTimerStarted] = useState(false);

  const { state } = useLocation();
  const { username } = state; // Read values passed on state
  
  const initializeGame = () => {
    console.log("Initializing Game");

    socket.emit("initialize-game", { room: room});
    socket.emit("request-question", { room: room});

    // setStartGame(true)
  }

  const handleAnswerOptionClick = (answerOption) => {
    if (!clicked) {
      setClicked(true);
      socket.emit("submit-answer", {room: room, username: username, answerOption: answerOption});
    }
  }

  socket.on("new-question", (data) => {
    setCurrentQuestion(data.currentQuestion);
    setAnswerOptions(data.answerOptions);
    setCorrectAnswer(data.correctAnswer);
    setClicked(false);
  });

  const arrangeLobby = useCallback((lobby) => {
    console.log("arranging");

    lobbyStatus.current.clear();
    lobbyStatus.current = lobby;

    // Generate cards
    const elements = [];
    lobby.forEach(function(value, key) {
      if (key === username) {
        elements.push(
          <Card bg="#E67700" shadow="sm" radius="md">
            <Center>
              <Text fz="lg" color="white" fw={500}>{key}: {value}</Text>
            </Center>
          </Card>
        );
      } else {
        elements.push(
          <Card bg="#393f4a" shadow="sm" radius="md">
            <Center>
              <Text fz="lg" color="white" fw={500}>{key}: {value}</Text>
            </Center>
          </Card>
        );      }
    });
    setLobbyElements(elements);
  }, [username]);

  useEffect(() => {
    socket.on("update-lobby", (data) => {
      console.log(data.lobby)
      arrangeLobby(new Map(JSON.parse(data.lobby)))
    })
  }, [arrangeLobby, socket]);

  useEffect(() => {
    socket.on("winner-found", (data) => {
      setWinner(data.winner);
      setStartGame(false);
      setEndedGame(true);
    })
  }, [winner, socket]);

  socket.on("started-game", () => {
    setStartGame(true);
  });

  const backToLobby = () => {
    setStartGame(false);
    setEndedGame(false);
    setWinner("");
  }
  // timer manipulation
  // const handleTimer = () => {
  //   setClicked(true);
  //   setTimerStarted(false);
  //   setTimeout(() => {
  //     setAnswerOptions([]);
  //     setCurrentQuestion("");
  //     setCorrectAnswer("");
  //     fetchData();
  //   }, 3000);
  // };
  socket.on("room-code", (data) => {
    setRoom(data);
  });

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
          <Button size="lg" component={Link} to="/" className="exit">
            Exit
          </Button>

          <Center>
            <Image width={250} src={logo} fit="contain" className="logo" />
          </Center>
          <Text className="room-code" fz="xl" color="white" fw={500}>Room Code: {room}</Text>
        </Header>
      }
    >
      {/* <Center>
        {clicked ? null : timerStarted ? (
          <Timer
            initialTime={seconds}
            handleTimer={handleTimer}
            clicked={clicked}
          />
        ) : null}
      </Center> */}
      <div className="centered">
        {startGame ?
        (
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
        )
        :
          endedGame ? 
            (
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
            ) 
            :(
              <Button size="xl" onClick={initializeGame}>
                Start Game
              </Button>
            )
        }
          
      </div>
    </AppShell>
  );
}

export default Game;
