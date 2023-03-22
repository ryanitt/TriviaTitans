const amqp = require('amqplib');
const path = require('node:path');

const Docker = require('dockerode');

const net = process.env.NETWORK_NAME;

const d = new Docker();
let containers = null;
let leader = 1;

async function getTitanServerContainers() {
  const containers = await d.listContainers({ all: true });
  console.log("Active Containers:");
  for (const container of containers) {
    const containerId = container.Id;
    const networkSettings = container.NetworkSettings.Networks;
    if (networkSettings["titan"]) {
      d.getContainer(containerId).inspect((err, data) => {
        const config = data.Config;
        if(data.Name != "/backend-rabbitmq-1" && data.Name != "/backend-docker-daemon-1") {
          console.log(data.Name, config.ExposedPorts, data.HostConfig.PortBindings);
        }
      });
    } 
  }
  console.log();
  return containers;
}

setInterval(() => {
  containers = getTitanServerContainers();
}, 7000);

// RabbitMQ Message Queue connection
const exchangeName = 'my-exchange';

// Wait utility function (to allow connection to RabbitMQ service to connect properly)
function waitTime(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// Send server switch information
const sendServerSwitch = (leaderInstanceId) => {
  mqChannel.then(
    function(value) {
      const headers = { 
        'leader-instance-id': leaderInstanceId,
        'message-type': "server-switch"
      };

      value.publish(exchangeName, '', Buffer.from(""), {headers});
    },
    function(error) {
      console.log(error);
    }
  );}

// leader has been elected
async function consumeLeaderElected(msg)  {
  console.log("Leader election message is received");

  containers = getTitanServerContainers();
  leader = msg.properties.headers["instance-id"];

  let newLeaderContainer = null;
  try {
    containers.then(
      async function(value) {
        for (const container of value) {
          const containerInspect = await d.getContainer(container.Id).inspect();
          const env = containerInspect.Config.Env;

          if (env.includes('INSTANCE_ID=' + leader)) {
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
        
        console.log("Current Leader Port:", containerInspect.HostConfig['PortBindings']['8080/tcp'][0].HostPort);
        // Check if leader is already running on correct port
        if(containerInspect.HostConfig['PortBindings']['8080/tcp'][0].HostPort === '8080') {
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

async function initializeMQ() {
  try {
      await waitTime(10000);
      const conn = await amqp.connect(mqSettings);
      console.log("RabbitMQ connection created...");
      const channel = await conn.createChannel();
      console.log("RabbitMQ channel created...");

      await channel.assertExchange(exchangeName, 'fanout', { durable: false });

      const { queue } = await channel.assertQueue('daemon_queue', {});
      await channel.bindQueue(queue, exchangeName, '');
      console.log("Rabbit Message Queue created...");

      channel.consume(queue, (msg) => {
        switch (msg.properties.headers["message-type"]) {
          case "data-update":
            console.log("Received data update");
            break;
          case "initiate-election":
            console.log("Received initiate election");
            break;
          case "leader-elected":
            consumeLeaderElected(msg); 
            break;
          case "send-heartbeat":
            console.log("Received heartbeat");
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

const mqChannel = initializeMQ();
