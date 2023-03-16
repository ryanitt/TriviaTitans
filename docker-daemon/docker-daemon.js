const amqp = require('amqplib');

const Docker = require('dockerode');

const net = process.env.NETWORK_NAME;

const d = new Docker();
let containers = null;

async function getTitanServerContainers() {
  const containers = await d.listContainers({ all: true });
  for (const container of containers) {
    const containerId = container.Id;
    const networkSettings = container.NetworkSettings.Networks;
    if (networkSettings["titan"]) {
      console.log(`Container ${containerId} is connected to network "titan"`);
    } else {
      console.log(`Container ${containerId} is not connected to network "titan"`);
    }
    d.getContainer(containerId).inspect((err, data) => {
      console.log(data.Name);
      const config = data.Config;
      console.log(config.Env);
      console.log(config.ExposedPorts);
      console.log(data.HostConfig.PortBindings);
    });
  }
  return containers;
}



setTimeout(() => {
  containers = getTitanServerContainers();
}, 10000);


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
  console.log("Leader election message is received: ", msg);
  
  const updatedConfig = {
    "HostConfig": {
      "PortBindings": {
        "8080/tcp": [{
          "HostIp": "",
          "HostPort": "8080"
        }]
      }
    } 
  }

  let newLeaderContainer = null;

  containers.then(
    async function(value) {
      for (const container of value) {
        const containerInspect = await d.getContainer(container.Id).inspect();
        const env = containerInspect.Config.Env;
        if (env.includes('INSTANCE_ID=' + msg.properties.headers["instance-id"])) {
          console.log(`Leader container name: ${containerInspect.Name}`);
          console.log(`Leader container ID: ${containerInspect.Id}`);
          console.log(`Leader container environment variables: ${env}`);
          newLeaderContainer = container;
        }
      }
      const inspectingLeaderContainer = d.getContainer(newLeaderContainer.Id);
      console.log("Set leader container as: ", newLeaderContainer);
  
      inspectingLeaderContainer.update({
        "HostConfig": updatedConfig.HostConfig
      });
      sendServerSwitch(msg.properties.headers["instance-id"]);  
  });
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
      await waitTime(15000);
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
