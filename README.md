# Trivia Titans

A distributed trivia game made with React. Our objective was to create a fun and competitive game with up to 5 players per room. The motivation behind the project was to create an interesting trivia game where friends can play together on their free time, as well as learn about distributed systems architecture whilst building the application. Uses a React frontend with a Node.js backend. Socket.io WebSockets were used to connect the frontend to the backend. MongoDB was used for our database. Servers deployed using Docker containers.

# Installation and Setup

Docker Desktop is required to run the application which can be downloaded from the following link:
https://www.docker.com/products/docker-desktop/

As well as the latest LTS version of Node.js: https://nodejs.org/en

The connections to the database are not valid for those that are not authenticated as of now, access can be requested. If you are authenticated to access our databases, you need to download MongoDB Compass to test with the databases: https://www.mongodb.com/products/compass

After downloading the contents of the repository. Enter the **trivia-titans** directory through your terminal. We recommend opening on Visual Studio Code. Enter the following command:

```powershell
npm i
```

This will install modules listed as dependencies. Do the same in the **backend** directory.

The port must be configured to your personal IP address and port after port forwarding if multiple people from multiple computers want to connect.

# Usage

To run the backend, run the following command in a separate terminal in the **backend** directory.

```powershell
docker compose up --build
```

To run the frontend, run the following command in the **trivia-titans** directory:

```powershell
npm start
```

After running the frontend, your default web browser should open with a window. You should be given two options, "New Game" and "Join Game".

![alt text](/FrontEndImage.png)

Select "New Game", enter a username and then create the room. After the room is created you should be able to start the game and play the game.

To close the server, run the following command in the /backend directory:

```powershell
docker compose down
```

# Testing

To test the fault tolerance, you may remove a server or daemon by deleting the container on Docker Desktop while running a game on the frontend. Deleting the primary server should pause the frontend for a bit, deleting the docker daemon should not affect the game running in the frontend. To test the crash of a database, open MongoDB Compass and go to the cluster. Select the **triviatitans** database and drop the **questions** collection. To remake the database, create a new one on MongoDB. The database name should be called **triviatitans** and the collection should be called **questions**. Then add the data again by importing the questions.json file in the **data** directory from the repository. Credentials to the MongoDB accounts will be provided to trusted TA's.

# Troubleshooting

You may encounter errors when running `docker compose up --build`. Specifically, the docker-daemon may throw an error on start. If this happens, try killing the terminal, deleting the `backend` docker container group, and run `docker compose up --build` again. If the issue is persistent, try restarting your computer.

Additionally, if you get an error similar to the following:

```powershell
2023-04-06 12:26:54 Error: connect ECONNREFUSED /var/run/docker.sock
2023-04-06 12:26:54     at PipeConnectWrap.afterConnect [as oncomplete] (node:net:1278:16) {
2023-04-06 12:26:54   errno: -111,
2023-04-06 12:26:54   code: 'ECONNREFUSED',
2023-04-06 12:26:54   syscall: 'connect',
2023-04-06 12:26:54   address: '/var/run/docker.sock'
2023-04-06 12:26:54 }
```

Try restarting your computer.

# Contributors

Andrew Eom

Vanessa Chen

Steven Ha

Ryan Ittyipe

Vincent Zheng
