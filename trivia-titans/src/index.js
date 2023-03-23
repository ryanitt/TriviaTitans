import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Route, Routes, HashRouter } from "react-router-dom";
import App from "./App";
import Game from "./Game";
import { MantineProvider } from "@mantine/core";
import { io } from "socket.io-client";

const root = ReactDOM.createRoot(document.getElementById("root"));

const socket = io.connect("http://***REMOVED***:8080/");

root.render(
  <MantineProvider
    theme={{ colorScheme: "dark" }}
    withGlobalStyles
    withNormalizeCSS
  >
    <HashRouter>
      <Routes>
        <Route exact path="/" element={<App socket={socket} />} />
        <Route path="/game" element={<Game socket={socket} />} />
      </Routes>
    </HashRouter>
  </MantineProvider>
);
