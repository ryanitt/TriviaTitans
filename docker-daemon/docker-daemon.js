const amqp = require('amqplib');

const Docker = require('dockerode');

const d = new Docker();
let containers = null;
let serverLeader = 1;

async function getTitanServerContainers() {
  const containers = await d.listContainers({ all: true });
  return containers;
}

setInterval(() => {
  containers = getTitanServerContainers();
}, 7000);

// RabbitMQ Message Queue connection
const serverExchangeName = 'server-exchange';
const daemonExchangeName = 'daemon-exchange';

const instanceId = process.env.DAEMON_INSTANCE_ID;

// Assume leader is srv1 to start
let leader = process.env.LEADER; 
let leaderTimeout = null;

// Create heartbeat timeout to check if leader is alive
let heartbeatTimeout = null;



// Wait utility function (to allow connection to RabbitMQ service to connect properly)
function waitTime(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// Publish functions

// Initiate an election for everyone
const ddInitiateElection = () => {
  daemonMQChannel.then(
    function(value) {
      const headers = { 
        'instance-id': instanceId,
        'message-type': "dd-initiate-election"
      };

      value.publish(daemonExchangeName, '', Buffer.from(""), {headers});

      if(leaderTimeout != null) {
        clearTimeout(leaderTimeout);
      }
      leaderTimeout = setTimeout(ddLeaderElected, 5000);

      console.log("Leader timeout started");
    },
    function(error) {
      console.log(error);
    }
  );}

// Tell everyone I am the leader
const ddLeaderElected = () => {
  daemonMQChannel.then(
    function(value) {
      const headers = { 
        'instance-id': instanceId,
        'message-type': "dd-leader-elected"
      };
      // io.to(data.room).emit("leader-elected", {});

      value.publish(daemonExchangeName, '', Buffer.from(""), {headers});
      leader = instanceId;
    },
    function(error) {
      console.log(error);
    }
  );}
  // Send heartbeat if I am the leader
  const ddSendHeartbeat = () => {
    if(instanceId != leader) {
      return;
    }
    daemonMQChannel.then(
      function(value) {
        const headers = { 
          'instance-id': instanceId,
          'message-type': "dd-send-heartbeat"
        };

        if(value) {
          value.publish(daemonExchangeName, '', Buffer.from(""), {headers});
        }
      },
      function(error) {
        console.log(error.type);
      }
    );}
  

// Consume functions

// New leader is trying to be elected
const consumeDDInitiateElection = (msg) => {
  if(msg.properties.headers["instance-id"] == instanceId) {
    console.log("Received my own daemon leader election");
  } else {
    console.log("Received someone else's daemon leader election: " + msg.content.toString());
    
    if(instanceId < msg.properties.headers["instance-id"]) {
      ddInitiateElection();
    } else {
      if(leaderTimeout != null) {
        clearTimeout(leaderTimeout);
      }
    }
  }
}
// leader has been elected
const consumeDDLeaderElected = (msg) => {
  if(msg.properties.headers["instance-id"] == instanceId) {
    console.log("Received my daemon leader election is successful");
  } else {
    console.log("Received someone else's daemon leader election is successful");

    if(leaderTimeout != null) {
      clearTimeout(leaderTimeout);
    }
    leader = msg.properties.headers["instance-id"];
  }
}

// consume heartbeat message from leader
const consumeDDSendHeartbeat = (msg) => {
  if(msg.properties.headers["instance-id"] == instanceId) {
    console.log("Received my own daemon leader heartbeat");
  } else {
    console.log("Received heartbeat from daemon leader ", msg.properties.headers["instance-id"]);

    if(heartbeatTimeout != null) {
      clearTimeout(heartbeatTimeout);
    }
    heartbeatTimeout = setTimeout(ddInitiateElection, 15000);
  }
}

// Send server switch information
const sendServerSwitch = (leaderInstanceId) => {
  serverMQChannel.then(
    function(value) {
      const headers = { 
        'leader-instance-id': leaderInstanceId,
        'message-type': "server-switch"
      };

      value.publish(serverExchangeName, '', Buffer.from(""), {headers});
    },
    function(error) {
      console.log(error);
    }
  );}

// leader has been elected
async function consumeLeaderElected(msg)  {

  console.log("Leader election message is received");

  containers = getTitanServerContainers();
  serverLeader = msg.properties.headers["instance-id"];
 
  if(leader != instanceId) {
    return;
  }

  let newLeaderContainer = null;
  try {
    containers.then(
      async function(value) {
        for (const container of value) {
          const containerInspect = await d.getContainer(container.Id).inspect();
          const env = containerInspect.Config.Env;

          if (env.includes('INSTANCE_ID=' + serverLeader)) {
            console.log(`Leader container name: ${containerInspect.Name}`);
            console.log(`Leader container ID: ${containerInspect.Id}`);
            console.log(`Leader container environment variables: ${env}`);
            newLeaderContainer = container;
          }
        }
        let container = d.getContainer(newLeaderContainer.Id);
        let containerInspect = await container.inspect();
        let containerName = containerInspect.Name.substring(1).replace('-1', '');;
        let containerInstanceIdEntry = containerInspect.Config.Env.find(str => str.includes('INSTANCE_ID='));
        containerInstanceIdEntry = containerInstanceIdEntry.charAt(containerInstanceIdEntry.length - 1)
        
        console.log("Current Leader HostConfig:", containerInspect.HostConfig);
        console.log("Current Leader Port:", containerInspect.HostConfig['PortBindings']?.['8080/tcp']?.[0].HostPort);
       
        // Check if leader is already running on correct port
        if(containerInspect.HostConfig['PortBindings']?.['8080/tcp']?.[0]?.HostPort === '8080') {
          console.log("Leader server running on correct port binding");
          getTitanServerContainers();
          return;
        }

        // Update the port bindings
        container.stop(function(err, data) {
          if (err) {
            console.log(`Error stopping container '${containerName}': ${err.message}`);
            return;
          }
          
          sendServerSwitch(containerInstanceIdEntry);
          console.log(`Container '${containerName}' stopped`);

          container.remove(function(err, data) {
            if (err) {
              console.log(`Error removing container '${containerName}': ${err.message}`);
              return;
            }
        
            console.log(`Container '${containerName}' removed`);
            
            const createOptions = {
              Image: containerName,
              name: containerName + '-1',
              HostConfig: {
                Binds: [
                  'backend_data:/app/data'
                ],
                PortBindings: {'8080/tcp': [{ HostPort: '8080' }]}
              },
              NetworkingConfig: {
                EndpointsConfig: {
                  'titan': {}
                }
              },
              Env: [
                'PORT=8080',
                'INSTANCE_ID=' + containerInstanceIdEntry,
                'LEADER=' + containerInstanceIdEntry,
                'RABBITMQ_HOST=rabbitmq'
              ]
            };
            
            d.createContainer(createOptions, function(err, container) {
              if (err) {
                console.log(`Error creating container: ${err.message}`);
                return;
              }
            
              console.log(`Container '${containerName}' created with updated port bindings`);

              container.start(function(err, data) {
                if (err) {
                  console.log(`Error started container ': ${err.message}`);
                  return;
                }
            
                console.log(`Container '${containerName}' started`);
              });
            });
          });
        });

        getTitanServerContainers();
    });
  } catch (error) {
    console.log("ERROR ERROR ERROR LOOK HERE ERROR ERROR ERROR:" + error);
  }
}

const mqSettings = {
  protocol: 'amqp',
  hostname: 'rabbitmq',
  port: 5672,
  username: 'guest',
  password: 'guest',
  vhost: '/',
  authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
}

async function initializeServerMQ() {
  try {
      await waitTime(10000);
      const conn = await amqp.connect(mqSettings);
      console.log("Server RabbitMQ connection created...");
      const channel = await conn.createChannel();
      console.log("Server RabbitMQ channel created...");

      await channel.assertExchange(serverExchangeName, 'fanout', { durable: false });

      const { queue } = await channel.assertQueue('daemon_server_queue_' + instanceId, {});
      await channel.bindQueue(queue, serverExchangeName, '');
      console.log("Server Rabbit Message Queue created...");

      channel.consume(queue, (msg) => {
        switch (msg.properties.headers["message-type"]) {
          case "data-update":
            console.log("Received data update");
            break;
          case "initiate-election":
            console.log("Received server initiate election");
            break;
          case "leader-elected":
            consumeLeaderElected(msg); 
            break;
          case "send-heartbeat":
            console.log("Received server leader heartbeat");
            break;
          case "server-switch":
            console.log("Server switched to new leader");
            break;
          default:
            console.log("Unknown message-type: " + msg.properties.headers["message-type"]);
            break;
        }
        channel.ack(msg);
    
      }, {noAck: false});

      return channel;

  } catch (error) {
    console.error(error);
  }
}

async function initializeDaemonMQ() {
  try {
      await waitTime(10000);
      const conn = await amqp.connect(mqSettings);
      console.log("Daemon RabbitMQ connection created...");
      const channel = await conn.createChannel();
      console.log("Daemon RabbitMQ channel created...");

      await channel.assertExchange(daemonExchangeName, 'fanout', { durable: false });

      const { queue } = await channel.assertQueue('daemon_queue_' + instanceId, {});
      await channel.bindQueue(queue, daemonExchangeName, '');
      console.log("Daemon Rabbit Message Queue created...");

      channel.consume(queue, (msg) => {
        switch (msg.properties.headers["message-type"]) {
          case "dd-initiate-election":
            consumeDDInitiateElection(msg);
            break;
          case "dd-leader-elected":
            consumeDDLeaderElected(msg); 
            break;
          case "dd-send-heartbeat":
            consumeDDSendHeartbeat(msg); 
            break;
          default:
            console.log("Unknown message-type: " + msg.properties.headers["message-type"]);
            break;
        }
        channel.ack(msg);
    
      }, {noAck: false});

      return channel;

  } catch (error) {
    console.error(error);
  }
}

const serverMQChannel = initializeServerMQ();
const daemonMQChannel = initializeDaemonMQ();

setInterval(ddSendHeartbeat, 5000);