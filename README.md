# Trivia Titans

A distributed trivia game made with React. Our objective was to create a fun and competitive game with up to 5 players per room. The motivation behind the project was to create an interesting trivia game where friends can play together on their free time, as well as learn about distributed systems architecture whilst building the application. Uses a React frontend with a Node.js backend. Socket.io WebSockets were used to connect the frontend to the backend. MongoDB was used for our database. Servers deployed using Docker containers.

**Image here**

# Installation and Usage

Docker Desktop is required to run the application which can be downloaded from the following link:
https://www.docker.com/products/docker-desktop/

As well as the latest LTS version of Node.js: https://nodejs.org/en

**// MongoDB accounts????**

After downloading the contents of the repository. Enter the **trivia-titans** directory through your terminal. We recommend opening on Visual Studio Code. Enter the following command:

```powershell
npm i
```

This will install modules listed as dependencies. Do the same in the **backend** directory.

To run the frontend, run the following command in the **trivia-titans** directory:

```powershell
npm start
```

To run the backend, run the following command in a separate terminal in the **backend** directory.

```powershell
docker compose up --build
```

**// might need to change IP and port in code?**

After running the frontend, your default web browser should open with a window. You should be given two options, "New Game" and "Join Game".

**add picture**

Select "New Game", enter a username and then create the room. After the room is created you should be able to start the game and play the game.

# Testing
