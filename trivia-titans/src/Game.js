import "./App.css";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

function Game() {
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerOptions, setAnswerOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [clicked, setClicked] = useState(false);
  const [score, setScore] = useState(0);

  const [seconds, setSeconds] = useState(10);

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
  };

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

  const handleTimer = () => {
    setClicked(true);
    setTimeout(() => {
      setAnswerOptions([]);
      setCurrentQuestion("");
      setCorrectAnswer("");
      fetchData();
    }, 3000);
  };

  useEffect(() => {
    setScore(0);
    fetchData();
  }, []);

  return (
    <AppShell
      padding="md"
      navbar={
        <Navbar width={{ base: 200 }} height={"100vh"} p="xs">
          <Card bg="#393f4a" shadow="sm" radius="md">
            <Center>
              <Text fz="lg" color="white" fw={500}>
                Your Score: {score}
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
        </Header>
      }
    >
      <Center>
        {clicked ? null : (
          <Timer
            initialTime={seconds}
            handleTimer={handleTimer}
            clicked={clicked}
          />
        )}
      </Center>
      <div className="centered">
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
      </div>
    </AppShell>
  );
}

export default Game;
