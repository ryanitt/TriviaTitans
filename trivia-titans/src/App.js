import logo from "./logo.svg";
import "./App.css";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Center,
  Modal,
  Space,
  Text,
  TextInput,
} from "@mantine/core";
import { useState, useEffect, useRef } from "react";

const App = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  let appSocket = props.socket;

  const [username, setUsername] = useState("");
  const usernameRef = useRef("");
  const [room, setRoom] = useState("");
  const roomRef = useRef("");
  const [limitReached, setLimitReached] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false);
  const [invalidUsername, setInvalidUsername] = useState(false);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isJoinGameModalOpen, setIsJoinGameModalOpen] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [errorText, setErrorText] = useState("");

  const useJoinGame = () => {
    if (
      roomRef.current !== "" &&
      !invalidCode &&
      !limitReached &&
      !gameRunning &&
      !invalidUsername
    ) {
      // TODO: if its an invalid code dont send this emit
      appSocket.emit("join-room", {
        username: usernameRef.current,
        room: roomRef.current,
        newGame: false,
      });
    } else {
      console.log("Invalid Code");
    }
  };

  const handleNewGame = () => {
    let generatedRoom = Math.floor(1000 + Math.random() * 9000).toString();

    roomRef.current = generatedRoom;
    appSocket.emit("join-room", {
      username: usernameRef.current,
      room: roomRef.current,
      newGame: true,
    });

    navigate("/game", { state: { username: usernameRef.current } });
  };

  const clearStates = () => {
    setLimitReached(false);
    setGameRunning(false);
    setInvalidCode(false);
    setShowAlert(false);
    setInvalidUsername(false);
    setErrorText("");
    setUsername("");
    setRoom("");
  };

  useEffect(() => {
    appSocket.on("join-success", (data) => {
      if (data) navigate("/game", { state: { username: usernameRef.current } });
    });
    appSocket.on("limit-reached", (data) => {
      if (data) setLimitReached(true);
      setErrorText("Room is full.");
    });
    appSocket.on("game-running", (data) => {
      if (data) setGameRunning(true);
      setErrorText("Game is already running.");
    });
    appSocket.on("invalid-code", (data) => {
      if (data) setInvalidCode(true);
      setErrorText("Invalid room code.");
    });
    appSocket.on("username-taken", (data) => {
      if (data) setInvalidUsername(true);
      setErrorText(`Username ${username} has been taken for this room.`);
    });
  }, [appSocket, navigate, username]);

  useEffect(() => {
    if (errorText !== "") {
      setTimeout(() => {
        clearStates();
      }, 5000);
    }
  }, [errorText]);

  useEffect(() => {
    if (location.state) {
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
      }, 5000);
    }
  }, [location]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  return (
    <header className="App-header">
      {showAlert && (
        <Alert title="Bummer!" color="red">
          The host has left the game. The room has been closed.
        </Alert>
      )}
      <img src={logo} className="App-logo" alt="logo" />
      <Text>Trivia Titans</Text>
      <Space h="lg" />

      <Center>
        <Button
          size="lg"
          onClick={() => setIsNewGameModalOpen(!isNewGameModalOpen)}
        >
          New Game
        </Button>
        <Space w="lg" />
        <Button
          size="lg"
          onClick={() => setIsJoinGameModalOpen(!isJoinGameModalOpen)}
        >
          Join Game
        </Button>
        <Modal
          opened={isJoinGameModalOpen}
          onClose={() => {
            setIsJoinGameModalOpen(false);
            clearStates();
          }}
          title="Join Game"
        >
          <TextInput
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          <Space h="md" />
          <TextInput
            label="Game Code"
            placeholder="Enter the 4 letter game code"
            value={room}
            onChange={(e) => setRoom(e.currentTarget.value)}
          />
          <Space h="md" />
          <Text color="red" size="md">
            {errorText}
          </Text>
          <Space h="md" />
          <Center>
            <Button onClick={useJoinGame}>Join Game</Button>
          </Center>
        </Modal>
        <Modal
          opened={isNewGameModalOpen}
          onClose={() => {
            setIsNewGameModalOpen(false);
            clearStates();
          }}
          title="New Game"
        >
          <TextInput
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
          />
          <Space h="md" />
          <Center>
            <Button onClick={handleNewGame}>Create Game</Button>
          </Center>
        </Modal>
      </Center>
    </header>
  );
};

export default App;
