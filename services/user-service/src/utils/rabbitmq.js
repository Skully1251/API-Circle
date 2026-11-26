'use strict';

const amqp = require('amqplib');
const crypto = require('crypto');
const { EventEmitter, once } = require('events');
const config = require('../config/env');
const logger = require('./logger');

const VALIDATE_API_KEY_QUEUE = 'api-key.validate';
const RPC_TIMEOUT_MS = Number(process.env.RABBITMQ_RPC_TIMEOUT_MS || 5000);

let connection;
let channel;
const responseEvents = new EventEmitter();

async function getChannel() {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(config.rabbitmqUrl);
  connection.on('close', () => {
    connection = undefined;
    channel = undefined;
  });
  connection.on('error', (error) => {
    logger.error('RabbitMQ connection error', { errMessage: error.message });
  });

  channel = await connection.createChannel();
  channel.on('close', () => {
    channel = undefined;
  });

  const replyQueue = await channel.assertQueue('', { exclusive: true });
  await channel.consume(
    replyQueue.queue,
    (message) => {
      if (!message) return;

      try {
        const response = JSON.parse(message.content.toString());
        responseEvents.emit(message.properties.correlationId, response);
      } catch (err) {
        logger.warn('Failed to parse RabbitMQ RPC reply', { errMessage: err.message });
      }
    },
    { noAck: true }
  );

  channel.replyQueue = replyQueue.queue;
  return channel;
}

/**
 * Validate an API key synchronously over RabbitMQ RPC (`api-key.validate`).
 */
async function validateApiKey(apiKey) {
  const rabbitChannel = await getChannel();
  const correlationId = crypto.randomUUID();
  const timeout = AbortSignal.timeout(RPC_TIMEOUT_MS);

  rabbitChannel.sendToQueue(
    VALIDATE_API_KEY_QUEUE,
    Buffer.from(JSON.stringify({ apiKey })),
    {
      correlationId,
      replyTo: rabbitChannel.replyQueue,
      persistent: true,
    }
  );

  try {
    const [response] = await once(responseEvents, correlationId, {
      signal: timeout,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('API key service did not respond in time');
    }
    throw error;
  }
}

function isConnected() {
  return Boolean(connection && channel);
}

async function closeConnection() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } finally {
    channel = undefined;
    connection = undefined;
  }
}

module.exports = {
  validateApiKey,
  isConnected,
  closeConnection,
};
