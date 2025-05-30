const Redis = require('ioredis');
const config = require('../config');
const { redisKeys } = require('./redisKeys');

class RedisClient {
    constructor() {
        this.metrics = {
            hits: 0,
            misses: 0,
            totalLatency: 0,
            operationCount: 0,
            lastReset: new Date(),
            connectionErrors: 0
        };
        
        // Only create real connection if not in test environment
        if (process.env.NODE_ENV !== 'test') {
            this.initializeClient();
        }
    }

    initializeClient() {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            reconnectOnError: (err) => {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    return true;
                }
                return false;
            }
        });

        this.client.on('error', (err) => {
            this.metrics.connectionErrors++;
            console.error('Redis Client Error:', err.message);
            if (err.code === 'ECONNREFUSED') {
                console.error('Redis connection refused. Please check if Redis server is running.');
            } else if (err.code === 'ETIMEDOUT') {
                console.error('Redis connection timed out.');
            }
        });

        this.client.on('connect', () => {
            console.log('Connected to Redis');
            this.metrics.connectionErrors = 0;
        });

        this.client.on('reconnecting', () => {
            console.log('Attempting to reconnect to Redis...');
        });

        this.client.on('end', () => {
            console.log('Redis connection closed');
        });
    }

    async trackOperation(operation) {
        const start = process.hrtime();
        try {
            const result = await operation();
            const [seconds, nanoseconds] = process.hrtime(start);
            const latency = seconds * 1000 + nanoseconds / 1000000;
            this.metrics.totalLatency += latency;
            this.metrics.operationCount++;
            return result;
        } catch (error) {
            const [seconds, nanoseconds] = process.hrtime(start);
            const latency = seconds * 1000 + nanoseconds / 1000000;
            this.metrics.totalLatency += latency;
            this.metrics.operationCount++;
            
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                console.error(`Redis operation failed: ${error.message}`);
                return null;
            }
            throw error;
        }
    }

    isConnected() {
        return this.client ? this.client.status === 'ready' : false;
    }

    // Wrapped Redis operations for cacheService
    async get(key) {
        return this.trackOperation(async () => {
            return this.client.get(key);
        });
    }

    async set(key, value, expirationMode, time) {
        return this.trackOperation(async () => {
            return this.client.set(key, value, expirationMode, time);
        });
    }

    // Pure Redis operations
    async getChatHistory(sessionId) {
        return this.trackOperation(async () => {
            const key = redisKeys.chatHistory(sessionId);
            const history = await this.client.lrange(key, 0, -1);
            return history.map(item => JSON.parse(item));
        });
    }

    async addToChatHistory(sessionId, message) {
        return this.trackOperation(async () => {
            const key = redisKeys.chatHistory(sessionId);
            const pipeline = this.client.pipeline();
            pipeline.rpush(key, JSON.stringify(message));
            pipeline.ltrim(key, -50, -1);
            pipeline.expire(key, 86400);
            await pipeline.exec();
        });
    }

    async getPaginatedChatHistory(sessionId, page = 1, pageSize = 10) {
        return this.trackOperation(async () => {
            const key = redisKeys.chatHistory(sessionId);
            const start = (page - 1) * pageSize;
            const end = start + pageSize - 1;
            const history = await this.client.lrange(key, start, end);
            return history.map(item => JSON.parse(item));
        });
    }

    async resetChatSession(sessionId) {
        return this.trackOperation(async () => {
            const key = redisKeys.chatHistory(sessionId);
            await this.client.del(key);
        });
    }

    async getCacheStats() {
        return this.trackOperation(async () => {
            try {
                const info = await this.client.info();
                const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0', 10);
                const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0', 10);
                
                this.metrics.hits = hits;
                this.metrics.misses = misses;

                const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;
                console.log(`Cache Stats - Hits: ${hits}, Misses: ${misses}, Hit Rate: ${hitRate.toFixed(2)}%`);

                return { 
                    hits, 
                    misses,
                    hitRate,
                    avgLatency: this.metrics.operationCount > 0 
                        ? this.metrics.totalLatency / this.metrics.operationCount 
                        : 0,
                    totalOperations: this.metrics.operationCount,
                    connectionErrors: this.metrics.connectionErrors,
                    uptime: (new Date() - this.metrics.lastReset) / 1000
                };
            } catch (error) {
                console.error('Error getting cache stats:', error);
                return { 
                    hits: this.metrics.hits,
                    misses: this.metrics.misses,
                    hitRate: 0,
                    avgLatency: this.metrics.operationCount > 0 
                        ? this.metrics.totalLatency / this.metrics.operationCount 
                        : 0,
                    totalOperations: this.metrics.operationCount,
                    connectionErrors: this.metrics.connectionErrors,
                    uptime: (new Date() - this.metrics.lastReset) / 1000
                };
            }
        });
    }

    async resetMetrics() {
        this.metrics = {
            hits: 0,
            misses: 0,
            totalLatency: 0,
            operationCount: 0,
            lastReset: new Date(),
            connectionErrors: 0
        };
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

module.exports = {
    redisClient: new RedisClient()
}; 