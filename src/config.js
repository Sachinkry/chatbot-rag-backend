const dotenv = require('dotenv');
const path = require('path');

// Load .env from the backend/ directory (one level up from src/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Validate critical environment variables
const requiredEnvVars = [
  'REDIS_URL',
  'JINA_API_KEY',
  'QDRANT_API_KEY',
  'QDRANT_HOST',
  'GEMINI_API_KEY',
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

// Export the config for use in other files
module.exports = {
  REDIS_URL: process.env.REDIS_URL,
  JINA_API_KEY: process.env.JINA_API_KEY,
  QDRANT_API_KEY: process.env.QDRANT_API_KEY,
  QDRANT_HOST: process.env.QDRANT_HOST,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PORT: process.env.PORT || 3000,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};