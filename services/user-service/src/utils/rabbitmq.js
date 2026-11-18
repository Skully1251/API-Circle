const amqp = require('amqplib');
const crypto = require('crypto');
const { EventEmitter, once } = require('events');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const VALIDATE_API_KEY_QUEUE = 'api-key.validate';

let connection;
let channel;
const responseEvents = new EventEmitter();

async function getChannel() {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(RABBITMQ_URL);
  connection.on('close', () => {
    connection = undefined;
    channel = undefined;
  });
  connection.on('error', (error) => {
    console.error('RabbitMQ connection error:', error.message);
  });
  channel = await connection.createChannel();
  const replyQueue = await channel.assertQueue('', { exclusive: true });

  await channel.consume(replyQueue.queue, (message) => {
    if (!message) return;

    const response = JSON.parse(message.content.toString());
    responseEvents.emit(message.properties.correlationId, response);
  }, { noAck: true });

  channel.replyQueue = replyQueue.queue;
  return channel;
}

async function validateApiKey(apiKey) {
  const rabbitChannel = await getChannel();
  const correlationId = crypto.randomUUID();
  const timeout = AbortSignal.timeout(5000);

  rabbitChannel.sendToQueue(
    VALIDATE_API_KEY_QUEUE,
    Buffer.from(JSON.stringify({ apiKey })),
    {
      correlationId,
      replyTo: rabbitChannel.replyQueue,
      persistent: true
    }
  );

  try {
    const [response] = await once(responseEvents, correlationId, {
      signal: timeout
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('API key service did not respond in time');
    }
    throw error;
  }
}

module.exports = { validateApiKey };