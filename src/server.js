const express = require('express');
const cors = require('cors');
const { loggerMiddleware, errorMiddleware } = require('./middleware');
const config = require('./config');
const { ragPipeline } = require('./core/ragPipeline');
const { redisClient } = require('./services/redisClient');
const chatService = require('./services/chatService');

const app = express();
const PORT = config.port;

// Debug logs
console.log('Environment variables:', {
    PORT: process.env.PORT,
    configPort: config.port
});

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for testing
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json());
app.use(loggerMiddleware);

// Routes
// POST /chat: Handle user message using RAG pipeline
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
        
        // Use RAG pipeline to process the message
        const response = await ragPipeline.processQuery(sanitizedMessage, sanitizedSessionId);
        console.log('Sending response to client');
        res.json({ response });
    } catch (error) {
        next(error);
    }
});

// GET /history: Fetch chat history for a session
app.get('/history', async (req, res, next) => {
    console.log('Received /history request:', req.query);
    try {
        const { session_id } = req.query;
        if (!session_id) {
            console.log('Validation failed: session_id missing');
            return res.status(400).json({ error: 'session_id is required' });
        }
        const sanitizedSessionId = session_id.replace(/[<>{}]/g, '');
        // Use chatService to get and format history
        const history = await chatService.getChatHistory(sanitizedSessionId);
        console.log('Retrieved chat history:', history);
        res.json({ messages: history });
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
        await redisClient.resetChatSession(sanitizedSessionId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const cacheStats = await redisClient.getCacheStats();
        res.json({
            status: 'ok',
            redis: redisClient.isConnected() ? 'connected' : 'disconnected',
            cache: {
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                hitRate: `${cacheStats.hitRate.toFixed(2)}%`
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get health status',
            timestamp: new Date().toISOString(),
        });
    }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    try {
        const stats = await redisClient.getCacheStats();
        res.json({
            redis: {
                status: redisClient.isConnected() ? 'connected' : 'disconnected',
                uptime: `${(stats.uptime / 3600).toFixed(2)} hours`
            },
            cache: {
                hits: stats.hits,
                misses: stats.misses,
                hitRate: `${stats.hitRate.toFixed(2)}%`,
                totalOperations: stats.totalOperations
            },
            performance: {
                averageLatency: `${stats.avgLatency.toFixed(2)}ms`,
                operationsPerSecond: stats.uptime > 0 
                    ? (stats.totalOperations / stats.uptime).toFixed(2)
                    : 0
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get metrics',
            timestamp: new Date().toISOString(),
        });
    }
});

// Error middleware
app.use(errorMiddleware);

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port or kill the process using this port.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Initiating graceful shutdown...');
    
    try {
        console.log('Attempting to disconnect from Redis...');
        await redisClient.disconnect();
        console.log('Redis client disconnected.');
    } catch (error) {
        console.error('Error during Redis disconnection:', error);
    }

    console.log('Closing HTTP server...');
    server.close((err) => {
        if (err) {
            console.error('Error closing HTTP server:', err);
            process.exit(1);
        } else {
            console.log('HTTP server closed.');
            process.exit(0);
        }
    });

    // Add a timeout to force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Initiating graceful shutdown...');
    
    try {
        console.log('Attempting to disconnect from Redis...');
        await redisClient.disconnect();
        console.log('Redis client disconnected.');
    } catch (error) {
        console.error('Error during Redis disconnection:', error);
    }

    console.log('Closing HTTP server...');
    server.close((err) => {
        if (err) {
            console.error('Error closing HTTP server:', err);
            process.exit(1);
        } else {
            console.log('HTTP server closed');
            process.exit(0);
        }
    });

    // Add a timeout to force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
});