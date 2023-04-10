# Trivia Titans

A distributed trivia game made with React. Our objective was to create a fun and competitive game with up to 5 players per room. The motivation behind the project was to create an interesting trivia game where friends can play together on their free time, as well as learn about distributed systems architecture whilst building the application. Uses a React frontend with a Node.js backend. Socket.io WebSockets were used to connect the frontend to the backend. MongoDB was used for our database. Servers deployed using Docker containers.

# Installation and Setup

Docker Desktop is required to run the application which can be downloaded from the following link:
https://www.docker.com/products/docker-desktop/

As well as the latest LTS version of Node.js: https://nodejs.org/en

The connections to the database are not valid for those that are not authenticated as of now, access can be requested.

After downloading the contents of the repository. Enter the **trivia-titans** directory through your terminal. We recommend opening on Visual Studio Code. Enter the following command:

```powershell
npm i
```

This will install modules listed as dependencies. Do the same in the **backend** directory.

The port must be configured to your personal IP address and port after port forwarding if multiple people from multiple computers want to connect.

# Usage

To run the frontend, run the following command in the **trivia-titans** directory:

```powershell
npm start
```

To run the backend, run the following command in a separate terminal in the **backend** directory.

```powershell
docker compose up --build
```

After running the frontend, your default web browser should open with a window. You should be given two options, "New Game" and "Join Game".

![alt text](/FrontEndImage.png)

Select "New Game", enter a username and then create the room. After the room is created you should be able to start the game and play the game.

To close the server, run the following command in the /backend directory:

```powershell
docker compose down
```

# Testing

To test the fault tolerance, you may remove a server or daemon by deleting the container on Docker Desktop while running a game on the frontend. Deleting the primary server should pause the frontend for a bit, deleting the docker daemon should not affect the game running in the frontend. To test the crash of a database, log in to one of the databases and delete the triviatitans database.

# Troubleshooting

You may encounter errors when running `docker compose up --build`. Specifically, the docker-daemon may throw an error on start. If this happens, try killing the terminal, deleting the `backend` docker container group, and run `docker compose up --build` again. If the issue is persistent, try restarting your computer.

# Contributors

Andrew Eom
Vanessa Chen
Steven Ha
Ryan Ittiyipe
Vincent Zheng
