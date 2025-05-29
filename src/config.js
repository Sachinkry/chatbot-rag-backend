const dotenv = require('dotenv');
const path = require('path');

// Load .env from the backend/ directory (one level up from src/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Validate critical environment variables
const requiredEnvVars = [
    'JINA_EMBEDDING_API_KEY',
    'GEMINI_API_KEY',
    'QDRANT_API_KEY',
    'QDRANT_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'PORT'
];

requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
        console.error(`Missing required environment variable: ${varName}`);
        process.exit(1);
    }
});

// Export the config for use in other files
module.exports = {
    jina: {
        apiKey: process.env.JINA_EMBEDDING_API_KEY
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-pro'
    },
    qdrant: {
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collection: process.env.QDRANT_COLLECTION || 'default'
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD || undefined
    },
    port: process.env.PORT || 3000
};