const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('redis');
const axios = require('axios');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('reconnecting', () => console.log('Reconnecting to Redis...'));
redisClient.on('end', () => console.log('Redis connection closed'));

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected:', redisClient.isOpen);
    await redisClient.set('test_key', 'test_value');
    console.log('Redis test successful:', (await redisClient.get('test_key')) === 'test_value');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    process.exit(1);
  }
})();

// Embed query using Jina API
const embedQuery = async (query) => {
  const response = await axios.post(
    'https://api.jina.ai/v1/embeddings',
    {
      model: 'jina-clip-v2',
      input: [{ text: query }],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
      },
    }
  );
  return response.data.data[0].embedding;
};

// Query Qdrant for top-k passages
const searchQdrant = async (queryVector, topK = 5) => {
    console.log('Querying Qdrant with vector length:', queryVector.length);
    try {
      const response = await axios.post(
        `http://${process.env.QDRANT_HOST}/collections/news_articles/points/query`,
        {
          vector: queryVector,
          limit: topK,
          with_payload: true,
          with_vectors: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.QDRANT_API_KEY,
          },
        }
      );
      console.log('Qdrant raw response:', response.data);
      if (!response.data.result || !response.data.result.points) {
        console.error('Qdrant response missing result.points:', response.data);
        throw new Error('Invalid Qdrant response structure');
      }
      return response.data.result.points;
    } catch (error) {
      console.error('Qdrant error:', error.response ? error.response.data : error.message);
      throw error; // Let the outer try/catch handle it
    }
  };

// Call Gemini API
// Call Gemini API
const callGemini = async (context, message) => {
    const prompt = `You are a news assistant. Based on the following context, answer the user's query.\n\nContext: ${context}\n\nUser Query: ${message}\n\nProvide a concise, informative response.`;
    console.log('Calling Gemini API with prompt:', prompt);
    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
        {
          contents: [
            {
              parts: [
                { text: prompt },
              ],
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            key: process.env.GEMINI_API_KEY,
          },
        }
      );
      console.log('Gemini API response:', JSON.stringify(response.data, null, 2));
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('Extracted Gemini response:', generatedText);
      return generatedText;
    } catch (error) {
      console.error('Gemini API error:', error.response ? error.response.data : error.message);
      throw new Error('Failed to generate response from Gemini API');
    }
  };

// POST /chat: Handle user message, retrieve context, call Gemini, store in Redis
app.post('/chat', async (req, res) => {
    console.log('Received /chat request:', req.body);
    try {
      const { session_id, message } = req.body;
  
      if (!session_id || !message) {
        console.log('Validation failed: session_id or message missing');
        return res.status(400).json({ error: 'session_id and message are required' });
      }
  
      // Embed the query
      const queryVector = await embedQuery(message);
      console.log('Query embedded successfully');
  
      // Retrieve top-k passages from Qdrant
      let context = 'No relevant news articles found.';
      try {
        const retrievedContexts = await searchQdrant(queryVector);
        console.log('Retrieved contexts:', retrievedContexts);
        if (retrievedContexts && retrievedContexts.length > 0) {
          context = retrievedContexts.map((ctx) => ctx.payload.maintext).join(' ');
        }
      } catch (qdrantError) {
        console.error('Failed to retrieve contexts from Qdrant:', qdrantError.message);
      }
      console.log('Final context for Gemini:', context);
  
      // Call Gemini API
      const botResponse = await callGemini(context, message);
      console.log('Bot response:', botResponse);
  
      // Fetch existing chat history from Redis
      const historyKey = `chat_history:${session_id}`;
      console.log('Fetching history from Redis with key:', historyKey);
      let chatHistory;
      try {
        const rawHistory = await redisClient.get(historyKey);
        chatHistory = rawHistory ? JSON.parse(rawHistory) : [];
        console.log('Parsed chat history:', chatHistory);
      } catch (redisError) {
        console.error('Redis GET error:', redisError);
        chatHistory = [];
      }
  
      // Append new message and response
      chatHistory.push({ user: message, bot: botResponse });
      console.log('Updated chat history:', chatHistory);
  
      // Store in Redis
      try {
        console.log('Saving updated history to Redis...');
        await redisClient.set(historyKey, JSON.stringify(chatHistory), {
          EX: 24 * 60 * 60,
        });
        console.log('History saved to Redis');
      } catch (redisError) {
        console.error('Redis SET error:', redisError);
      }
  
      console.log('Sending response to client');
      res.json({ response: botResponse });
    } catch (error) {
      console.error('Error in /chat:', error.message);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// GET /history?session_id=...: Fetch chat history for a session
app.get('/history', async (req, res) => {
    console.log('Received /history request:', req.query);
    try {
      const { session_id } = req.query;
  
      if (!session_id) {
        console.log('Validation failed: session_id missing');
        return res.status(400).json({ error: 'session_id is required' });
      }
  
      const historyKey = `chat_history:${session_id}`;
      const chatHistory = await redisClient.get(historyKey);
      const rawMessages = chatHistory ? JSON.parse(chatHistory) : [];
  
      // Transform the history into the frontend's expected Message format
      const messages = rawMessages.flatMap((entry, index) => [
        {
          id: `${index}-user`,
          content: entry.user,
          type: 'user',
          timestamp: new Date().toISOString(), // You might want to store timestamps in Redis
        },
        {
          id: `${index}-bot`,
          content: entry.bot,
          type: 'bot',
          timestamp: new Date().toISOString(),
        },
      ]);
  
      console.log('Transformed messages for frontend:', messages);
      res.json({ messages });
    } catch (error) {
      console.error('Error in /history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// POST /reset: Clear session history
app.post('/reset', async (req, res) => {
  console.log('Received /reset request:', req.body);
  try {
    const { session_id } = req.body;

    if (!session_id) {
      console.log('Validation failed: session_id missing');
      return res.status(400).json({ error: 'session_id is required' });
    }

    const historyKey = `chat_history:${session_id}`;
    await redisClient.del(historyKey);

    res.json({ success: true });
  } catch (error) {
    console.error('Error in /reset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redisClient.quit();
  process.exit(0);
});