const express = require('express');
const cors = require('cors');
const { loggerMiddleware, errorMiddleware } = require('./middleware');
const { processChat, getChatHistory, resetChatSession } = require('./redis');
const config = require('./config'); // Import config

const app = express();
const PORT = config.PORT; // Use config

// Middleware
app.use(cors({
  origin: config.FRONTEND_URL, // Use config
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());
app.use(loggerMiddleware);

// Routes
// POST /chat: Handle user message, retrieve context, call Gemini, store in Redis
app.post('/chat', async (req, res, next) => {
  console.log('Received /chat request:', req.body);
  try {
    const { session_id, message } = req.body;
    if (!session_id || !message) {
      console.log('Validation failed: session_id or message missing');
      return res.status(400).json({ error: 'session_id and message are required' });
    }
    const sanitizedMessage = message.replace(/[<>{}]/g, '');
    const sanitizedSessionId = session_id.replace(/[<>{}]/g, '');
    const botResponse = await processChat(sanitizedSessionId, sanitizedMessage);
    console.log('Sending response to client');
    res.json({ response: botResponse });
  } catch (error) {
    next(error);
  }
});

// GET /history?session_id=...: Fetch chat history for a session
app.get('/history', async (req, res, next) => {
  console.log('Received /history request:', req.query);
  try {
    const { session_id } = req.query;
    if (!session_id) {
      console.log('Validation failed: session_id missing');
      return res.status(400).json({ error: 'session_id is required' });
    }
    const sanitizedSessionId = session_id.replace(/[<>{}]/g, '');
    const messages = await getChatHistory(sanitizedSessionId);
    console.log('Transformed messages for frontend:', messages);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

// POST /reset: Clear session history
app.post('/reset', async (req, res, next) => {
  console.log('Received /reset request:', req.body);
  try {
    const { session_id } = req.body;
    if (!session_id) {
      console.log('Validation failed: session_id missing');
      return res.status(400).json({ error: 'session_id is required' });
    }
    const sanitizedSessionId = session_id.replace(/[<>{}]/g, '');
    await resetChatSession(sanitizedSessionId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Health check
app.get('/health', (req, res) => {
  const redis = require('./src/redis');
  res.json({
    status: 'ok',
    redis: redis.redisClient.isOpen ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Error middleware
app.use(errorMiddleware);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  const redis = require('./src/redis');
  await redis.redisClient.quit();
  process.exit(0);
});