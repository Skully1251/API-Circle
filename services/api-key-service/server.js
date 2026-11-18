const crypto = require('crypto');
const amqp = require('amqplib');
const express = require('express');

const port = Number(process.env.PORT || 3008);
const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const validateQueue = 'api-key.validate';
const keys = new Map();
let channel;

async function startRabbitConsumer() {
  const connection = await amqp.connect(rabbitmqUrl);
  connection.on('error', (error) => {
    console.error('RabbitMQ connection error:', error.message);
  });

  channel = await connection.createChannel();
  await channel.assertQueue(validateQueue, { durable: true });
  await channel.prefetch(10);
  await channel.consume(validateQueue, (message) => {
    if (!message) return;

    let payload;
    try {
      payload = JSON.parse(message.content.toString());
    } catch {
      channel.ack(message);
      return;
    }

    const user = keys.get(payload.apiKey);
    channel.sendToQueue(
      message.properties.replyTo,
      Buffer.from(JSON.stringify(user ? { valid: true, user } : { valid: false })),
      { correlationId: message.properties.correlationId }
    );
    channel.ack(message);
  });
}

const app = express();
app.use(express.json({ limit: '10kb' }));

app.post('/api-keys', (request, response) => {
  const { userId, email, name } = request.body;
  if (!userId || !email || !name) {
    return response.status(400).json({
      error: 'userId, email and name are required'
    });
  }

  const apiKey = `ac_${crypto.randomBytes(24).toString('hex')}`;
  keys.set(apiKey, {
    id: String(userId),
    email: String(email),
    name: String(name)
  });

  return response.status(201).json({
    apiKey,
    userId: String(userId),
    warning: 'Demo storage only: keys are lost when this container restarts'
  });
});

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && error.status === 400) {
    return response.status(400).json({ error: 'Request body must be valid JSON' });
  }
  return next(error);
});

async function start() {
  try {
    await startRabbitConsumer();
    app.listen(port, () => {
    console.log(`API key service listening on port ${port}`);
    });
  } catch (error) {
    console.error('Could not connect to RabbitMQ:', error.message);
    process.exit(1);
  }
}

start();