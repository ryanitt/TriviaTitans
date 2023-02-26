import logo from "./logo.svg";
import "./App.css";
import { useNavigate } from "react-router-dom";
import { Button, Center, Modal, Space, Text, TextInput } from "@mantine/core";
import { useState, useEffect, useRef } from "react";

const App = (props) => {
  const navigate = useNavigate();
  
  let appSocket = props.socket;

  const username = useRef("");
  const room = useRef("");

  const [limitReached, setLimitReached] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false);

  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isJoinGameModalOpen, setIsJoinGameModalOpen] = useState(false);

  const useJoinGame = () => {
    if (room.current !== "" && !invalidCode && !limitReached) {
      // TODO: if its an invalid code dont send this emit
      appSocket.emit("join-room", { username: username.current, room: room.current, newGame: false });
    
    } else {
      console.log("Invalid Code");
    }
  };

  const handleNewGame = () => {
    let generatedRoom = Math.floor(1000 + Math.random() * 9000).toString();

    room.current = generatedRoom;
    appSocket.emit("join-room", { username: username.current, room: room.current, newGame: true });

    navigate("/game", { state: { username: username.current } });
  };

  useEffect(() => {
    appSocket.on("join-success", (data) => {
      if (data) navigate("/game", { state: { username: username.current }});
    });
    appSocket.on("limit-reached", (data) => {
      if (data) setLimitReached(true);
    });
    appSocket.on("invalid-code", (data) => {
      if (data) setInvalidCode(true);
    });
    appSocket.on("room-code", (data) => {
      console.log("ROOM CODE:", data);
    });
  }, [appSocket, navigate]);

  return (
    <header className="App-header">
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
          onClose={() => setIsJoinGameModalOpen(!isJoinGameModalOpen)}
          title="Join Game"
        >
          <TextInput
            label="Username"
            placeholder="Enter your username"
            value={username.current}
            onChange={(e) => username.current = e.currentTarget.value}
          />
          <Space h="md" />
          <TextInput
            label="Game Code"
            placeholder="Enter the 4 letter game code"
            value={room.current}
            onChange={(e) => room.current = e.currentTarget.value}
          />
          <Space h="md" />
          <Center>
            <Button onClick={useJoinGame}>Join Game</Button>
          </Center>
        </Modal>
        <Modal
          opened={isNewGameModalOpen}
          onClose={() => setIsNewGameModalOpen(!isNewGameModalOpen)}
        >
          <TextInput
            label="Username"
            placeholder="Enter your username"
            value={username.current}
            onChange={(e) => username.current = e.currentTarget.value}
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
}

export default App;
