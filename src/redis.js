const { createClient } = require('redis');
const { embedQuery, searchQdrant, callGemini } = require('./rag');
const config = require('./config'); // Import config

// Redis client setup
// console.log('REDIS_URL from config:', config.REDIS_URL); // Debug log
const redisClient = createClient({
  url: config.REDIS_URL, // Use config
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('reconnecting', () => console.log('Reconnecting to Redis...'));
redisClient.on('end', () => console.log('Redis connection closed'));

// Connect to Redis on startup
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

// Process a chat message: Embed, retrieve, generate, and store
const processChat = async (session_id, message) => {
  const start = Date.now();

  // Embed the query
  const queryVector = await embedQuery(message);
  console.log(`Query embedded in ${Date.now() - start}ms`);

  // Retrieve top-k passages from Qdrant
  let context = 'No relevant news articles found.';
  const retrieveStart = Date.now();
  let retrievedContexts;
  try {
    retrievedContexts = await searchQdrant(queryVector);
    console.log(`Retrieved contexts in ${Date.now() - retrieveStart}ms:`); // retrievedContexts
    if (retrievedContexts && retrievedContexts.length > 0) {
      context = retrievedContexts.map((ctx) => ctx.payload.maintext).join(' ');
    }
  } catch (qdrantError) {
    console.error('Failed to retrieve contexts from Qdrant:', qdrantError.message);
  }
//   console.log('Final context for Gemini:', context);

  // Call Gemini API
  const geminiStart = Date.now();
  const botResponse = await callGemini(context, message);
  console.log(`Gemini response generated in ${Date.now() - geminiStart}ms`);
//   console.log('Bot response:', botResponse);

  // Fetch existing chat history from Redis
  const historyKey = `chat_history:${session_id}`;
//   console.log('Fetching history from Redis with key:', historyKey);
  let chatHistory = [];
  try {
    const rawHistory = await redisClient.get(historyKey);
    chatHistory = rawHistory ? JSON.parse(rawHistory) : [];
    // console.log('Parsed chat history:', chatHistory);
  } catch (redisError) {
    console.error('Redis GET error:', redisError);
  }

  // Append new message and response with timestamps
  chatHistory.push({
    user: message,
    bot: botResponse,
    userTimestamp: new Date().toISOString(),
    botTimestamp: new Date().toISOString(),
  });
//   console.log('Updated chat history:', chatHistory);

  // Store in Redis
  try {
    console.log('Saving updated history to Redis...');
    await redisClient.set(historyKey, JSON.stringify(chatHistory), {
      EX: 24 * 60 * 60, // 24-hour TTL
    });
    console.log('History saved to Redis');
  } catch (redisError) {
    console.error('Redis SET error:', redisError);
  }

  console.log(`Total chat processing time: ${Date.now() - start}ms`);
  return botResponse;
};

// Get chat history and transform for frontend
const getChatHistory = async (session_id) => {
  const historyKey = `chat_history:${session_id}`;
  const chatHistory = await redisClient.get(historyKey);
  const rawMessages = chatHistory ? JSON.parse(chatHistory) : [];

  // Transform the history into the frontend's expected Message format
  const messages = rawMessages.flatMap((entry, index) => [
    {
      id: `${index}-user`,
      content: entry.user,
      type: 'user',
      timestamp: entry.userTimestamp || new Date().toISOString(),
    },
    {
      id: `${index}-bot`,
      content: entry.bot,
      type: 'bot',
      timestamp: entry.botTimestamp || new Date().toISOString(),
    },
  ]);

//   console.log('Transformed messages for frontend:', messages);
  return messages;
};

// Reset chat session
const resetChatSession = async (session_id) => {
  const historyKey = `chat_history:${session_id}`;
  await redisClient.del(historyKey);
  console.log(`Session ${session_id} reset successfully`);
};

module.exports = { redisClient, processChat, getChatHistory, resetChatSession };