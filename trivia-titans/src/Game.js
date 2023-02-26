import "./App.css";
import { useState, useEffect } from "react";
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
import he from "he";
import Timer from "./Timer";

const Game = (props) => {

  let socket = props.socket

  var thisRoom = 0;

  const [startGame, setStartGame] = useState(false);
  const [room, setRoom] = useState("");

  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerOptions, setAnswerOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [clicked, setClicked] = useState(false);
  const [score, setScore] = useState(0);

  const seconds = 15;
  const [timerStarted, setTimerStarted] = useState(false);

  const { state } = useLocation();
  const { username } = state; // Read values passed on state
  
  console.log("username for this instance is: " + username)

  // fetching data from the trivia db
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
      setCurrentQuestion(decodedData.results[0].question);
      setAnswerOptions(shuffledOptions);
      setCorrectAnswer(decodedData.results[0].correct_answer);
    } else {
      const booleanOptions = ["True", "False"];
      setCurrentQuestion(decodedData.results[0].question);
      setAnswerOptions(booleanOptions);
      setCorrectAnswer(decodedData.results[0].correct_answer);
    }

    // Reset clicked state and selected option
    setClicked(false);
    setTimerStarted(true);
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

  const handleAnswerOptionClick = (answerOption) => {
    if (!clicked) {
      setClicked(true);

      if (answerOption === correctAnswer) {
        setScore(score + 10);
      }
    }
    handleTimer();
  };

  // timer manipulation
  const handleTimer = () => {
    setClicked(true);
    setTimerStarted(false);
    setTimeout(() => {
      setAnswerOptions([]);
      setCurrentQuestion("");
      setCorrectAnswer("");
      fetchData();
    }, 3000);
  };

  useEffect(() => {
    socket.on("room-code", (data) => {
      setRoom(data);
      thisRoom = data;
    });

    if (startGame) {
      setScore(0);
      fetchData();
    }
  }, [startGame]);

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
        ) : (
          <Button size="xl" onClick={() => setStartGame(true)}>
            Start Game
          </Button>
        )}
      </div>
    </AppShell>
  );
}

export default Game;
