const { redisClient } = require('./redisClient');
const { redisKeys } = require('./redisKeys');

class CacheService {
    constructor() {
        this.redisClient = redisClient;
        this.cacheTTL = 60 * 60; // Default cache time-to-live in seconds (1 hour)
    }

    async get(key) {
        // Use the wrapped get method
        const cachedData = await this.redisClient.get(key);
        if (cachedData) {
            // Assuming cached data is JSON stringified
            try {
                // Increment cache hits metrics in redisClient
                 if (this.redisClient.metrics) this.redisClient.metrics.hits++;
                return JSON.parse(cachedData);
            } catch (error) {
                console.error('Error parsing cached data:', error);
                return null;
            }
        } else {
            // Increment cache misses metrics in redisClient
             if (this.redisClient.metrics) this.redisClient.metrics.misses++;
            return null;
        }
    }

    async set(key, value, ttl = this.cacheTTL) {
        // Use the wrapped set method
        // Assuming value is a plain object or can be JSON stringified
        try {
            const dataToCache = JSON.stringify(value);
            await this.redisClient.set(key, dataToCache, 'EX', ttl);
        } catch (error) {
            console.error('Error setting cache data:', error);
        }
    }

    async getEmbedding(query) {
        try {
            const key = redisKeys.embeddingCache(query);
            const value = await this.redisClient.get(key);
            console.log(value ? 'Embedding cache HIT' : 'Embedding cache MISS');
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Error getting embedding from cache:', error);
            return null;
        }
    }

    async setEmbedding(query, embedding, ttl = 86400) {
        try {
            const key = redisKeys.embeddingCache(query);
            await this.redisClient.set(key, JSON.stringify(embedding), 'EX', ttl);
            console.log('Embedding cache set successfully');
        } catch (error) {
            console.error('Error setting embedding in cache:', error);
        }
    }

    async getGeminiCache(promptHash) {
        try {
            const key = redisKeys.geminiCache(promptHash);
            const value = await this.redisClient.get(key);
            console.log(value ? 'Gemini cache HIT' : 'Gemini cache MISS');
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Error getting Gemini response from cache:', error);
            return null;
        }
    }

    async setGeminiCache(promptHash, response, ttl = 86400) {
        try {
            const key = redisKeys.geminiCache(promptHash);
            await this.redisClient.set(key, JSON.stringify(response), 'EX', ttl);
            console.log('Gemini cache set successfully');
        } catch (error) {
            console.error('Error setting Gemini response in cache:', error);
        }
    }

    async getCacheStats() {
        // This method should now rely on redisClient's aggregated metrics
        // The actual fetching of stats is done within redisClient.getCacheStats
        return this.redisClient.getCacheStats();
    }
}

// Export a singleton instance
module.exports = {
    cacheService: new CacheService()
}; 