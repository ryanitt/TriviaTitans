import logo from "./logo.svg";
import "./App.css";
import { useNavigate } from "react-router-dom";
import { Button, Center, Modal, Space, Text, TextInput } from "@mantine/core";
import { useState } from "react";

function App() {
  const navigate = useNavigate();
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isJoinGameModalOpen, setIsJoinGameModalOpen] = useState(false);

  const [username, setUsername] = useState("");
  const [gameCode, setGameCode] = useState("");

  const handleNewGame = () => {
    navigate("/game", { state: { username: username } });
  };

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
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          <Space h="md" />
          <TextInput
            label="Game Code"
            placeholder="Enter the 4 letter game code"
            value={gameCode}
            onChange={(e) => setGameCode(e.currentTarget.value)}
          />
          <Space h="md" />
          <Center>
            <Button>Join Game</Button>
          </Center>
        </Modal>
        <Modal
          opened={isNewGameModalOpen}
          onClose={() => setIsNewGameModalOpen(!isNewGameModalOpen)}
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
            <Button onClick={() => handleNewGame()}>Create Game</Button>
          </Center>
        </Modal>
      </Center>
    </header>
  );
}

export default App;
