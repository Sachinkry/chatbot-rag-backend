const Redis = require('ioredis');
const config = require('../config');

class RedisClient {
    constructor() {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('Connected to Redis');
        });
    }

    isConnected() {
        return this.client.status === 'ready';
    }

    async getChatHistory(sessionId) {
        try {
            const key = `chat:${sessionId}`;
            const history = await this.client.lrange(key, 0, -1);
            return history.map(item => JSON.parse(item));
        } catch (error) {
            console.error('Error getting chat history:', error);
            throw error;
        }
    }

    async addToChatHistory(sessionId, message) {
        try {
            const key = `chat:${sessionId}`;
            await this.client.rpush(key, JSON.stringify(message));
            // Keep only last 50 messages
            await this.client.ltrim(key, -50, -1);
        } catch (error) {
            console.error('Error adding to chat history:', error);
            throw error;
        }
    }

    async resetChatSession(sessionId) {
        try {
            const key = `chat:${sessionId}`;
            await this.client.del(key);
        } catch (error) {
            console.error('Error resetting chat session:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await this.client.quit();
        } catch (error) {
            console.error('Error disconnecting from Redis:', error);
            throw error;
        }
    }
}

// Export a singleton instance
module.exports = {
    redisClient: new RedisClient()
}; 