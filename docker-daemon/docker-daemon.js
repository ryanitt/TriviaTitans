const amqp = require('amqplib');

const Docker = require('dockerode');

const net = process.env.NETWORK_NAME;

// RabbitMQ Message Queue connection
const exchangeName = 'my-exchange';

// Wait utility function (to allow connection to RabbitMQ service to connect properly)
function waitTime(time) {
  return new Promise(resolve => setTimeout(resolve, time));
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
            console.log("Recieved data update");
            break;
          case "initiate-election":
            console.log("Recieved initiate election");
            break;
          case "leader-elected":
            break;
          case "send-heartbeat":
            console.log("Recieved heartbeat");
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

const d = new Docker();

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
  }
}


setTimeout(() => {
  const containers = getTitanServerContainers();
}, 15000);

