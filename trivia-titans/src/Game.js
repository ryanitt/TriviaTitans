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
} from "@mantine/core";
import logo from "./logo-removebg-preview.png";
import he from "he";

function Game() {
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [answerOptions, setAnswerOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [score, setScore] = useState(0);

  const fetchData = async () => {
    const response = await fetch("https://opentdb.com/api.php?amount=1");
    const data = await response.json();
    const decodedData = decodeHtmlEntities(data);
    const type = decodedData.results[0].type;
    console.log(type);

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
    if (answerOption === correctAnswer) {
      setScore(score + 1);
    }
    setAnswerOptions([]);
    setCurrentQuestion("");
    setCorrectAnswer("");

    fetchData();
  };

  useEffect(() => {
    setScore(0);
    fetchData();
  }, []);

  return (
    <header className="Game-header">
      <AppShell
        padding="md"
        navbar={
          <Navbar width={{ base: 200 }} height={"100vh"} p="xs" bg="#282c34">
            <Card>
              <Text>Your Score: {score}</Text>
            </Card>
          </Navbar>
        }
        header={
          <Header height={70} bg="#282c34">
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
          <Card
            style={{ width: "50vw", height: 400, backgroundColor: "#282c34" }}
          >
            <Center>
              <Text c="white">{currentQuestion}</Text>
            </Center>
            <Space h="xl" />
            <SimpleGrid cols={2}>
              {answerOptions.map((option) => (
                <Button
                  key={option}
                  onClick={() => handleAnswerOptionClick(option)}
                >
                  {option}
                </Button>
              ))}
            </SimpleGrid>
          </Card>
        </Center>
      </AppShell>
    </header>
  );
}

export default Game;
