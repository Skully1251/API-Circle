const express = require('express');
const { validateApiKey } = require('./src/utils/rabbitmq');

const PORT = Number(process.env.PORT || 3002);
const app = express();

app.get('/users/me', async (request, response) => {
  const apiKey = request.get('x-api-key');
  if (!apiKey || typeof apiKey !== 'string') {
    return response.status(401).json({ error: 'x-api-key header is required' });
  }

  try {
    const result = await validateApiKey(apiKey);
    if (!result.valid) {
      return response.status(401).json({ error: 'Invalid API key' });
    }

    return response.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name
      },
      authenticatedBy: 'api-key-service via RabbitMQ'
    });
  } catch (error) {
    console.error('Could not validate API key:', error.message);
    return response.status(503).json({ error: 'API key validation is unavailable' });
  }
});

app.use((request, response) => {
  response.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`User service listening on PORT ${PORT}`);
});