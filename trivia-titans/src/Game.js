import "./App.css";
import { useState, useEffect, useRef } from "react";
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

  const [startGame, setStartGame] = useState(false);
  const [room, setRoom] = useState("");

  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerOptions, setAnswerOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [clicked, setClicked] = useState(false);
  const [score, setScore] = useState(0);

  // const seconds = 15;
  // const [timerStarted, setTimerStarted] = useState(false);

  const { state } = useLocation();
  const { username } = state; // Read values passed on state
  
  const initializeGame = () => {
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

  socket.on("started-game", () => {
    setStartGame(true);
  });

  socket.on("new-question", (data) => {
    setCurrentQuestion(data.currentQuestion);
    setAnswerOptions(data.answerOptions);
    setCorrectAnswer(data.correctAnswer);
    setClicked(false);
  });

  useEffect(() => {
    socket.on("answer-response", (data) => {
      console.log(data.lobby)
      lobbyStatus.current = new Map(JSON.parse(data.lobby));
      setScore(lobbyStatus.current.get(username))
    })
  }, [score]);

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
          <Card bg="#393f4a" shadow="sm" radius="md">
            <Center>
              <Text fz="lg" color="white" fw={500}>
                {username}: {score}
              </Text>
            </Center>
          </Card>
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
        ) : (
          <Button size="xl" onClick={initializeGame}>
            Start Game
          </Button>
        )}
      </div>
    </AppShell>
  );
}

export default Game;
