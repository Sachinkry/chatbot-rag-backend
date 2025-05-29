const { redisClient } = require('./redisClient');

class CacheService {
    constructor() {
        this.client = redisClient;
    }

    async get(key) {
        try {
            console.log('Getting from cache:', key);
            const value = await this.client.get(key);
            console.log('Cache value:', value);
            return value;
        } catch (error) {
            console.error('Cache get error:', error.message);
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        try {
            console.log('Setting cache:', key);
            await this.client.set(key, value, 'EX', ttl);
            console.log('Cache set successfully');
        } catch (error) {
            console.error('Cache set error:', error.message);
        }
    }

    async getChatHistory(sessionId) {
        try {
            console.log('Getting chat history for session:', sessionId);
            const history = await this.client.get(`chat:${sessionId}`);
            console.log('Chat history:', history);
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Chat history get error:', error.message);
            return [];
        }
    }

    async addToChatHistory(sessionId, message) {
        try {
            console.log('Adding to chat history:', message);
            const history = await this.getChatHistory(sessionId);
            history.push(message);
            await this.client.set(`chat:${sessionId}`, JSON.stringify(history));
            console.log('Chat history updated');
        } catch (error) {
            console.error('Chat history add error:', error.message);
        }
    }
}

// Export a singleton instance
module.exports = {
    cacheService: new CacheService()
}; 