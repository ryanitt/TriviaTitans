import logo from "./logo.svg";
import "./App.css";
import { Link } from "react-router-dom";
import { Button } from "@mantine/core";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Trivia Titans</p>
        <Button size="lg" component={Link} to="/game">
          New Game
        </Button>
      </header>
    </div>
  );
}

export default App;
