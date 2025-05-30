const NAMESPACE = 'chatbot';
const VERSION = 'v1';

const redisKeys = {
  chatHistory: (sessionId) => `${NAMESPACE}:${VERSION}:chat:${sessionId}`,
  embeddingCache: (query) => `${NAMESPACE}:${VERSION}:embedding:${query}`,
  geminiCache: (promptHash) => `${NAMESPACE}:${VERSION}:gemini:${promptHash}`
};

module.exports = { redisKeys }; 