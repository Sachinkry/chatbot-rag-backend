# RAG Chatbot Backend

This backend powers a full-stack chatbot that answers user queries using Retrieval-Augmented Generation (RAG) over a recent news corpus.

## Features

- Semantic search using Qdrant vector database
- Context retrieval and response generation with Gemini
- Redis-based chat history with pagination support
- Comprehensive health monitoring and metrics
- Robust error handling and retry mechanisms

## API Endpoints

- `POST /chat`: Process user query with RAG
- `GET /history?session_id=...`: Fetch paginated chat history
- `POST /reset`: Clear session history
- `GET /health`: System health check
- `GET /metrics`: Detailed performance metrics

## Code Structure

```
src/
├── config/           # Configuration management
├── services/         # Core business logic
│   ├── redisClient.js    # Redis operations
│   ├── chatService.js    # Chat history management
│   └── ragService.js     # RAG pipeline
├── middleware/       # Express middleware
├── routes/          # API route handlers
└── server.js        # Application entry point
```

## Redis Implementation

### Chat History Storage

- Session-based storage with TTL
- JSON-formatted messages
- Pagination support
- Automatic cleanup of old sessions

### Performance Monitoring

- Operation latency tracking
- Cache hit/miss statistics
- Connection health metrics
- Automatic retry on failures

## Environment Variables

```env
REDIS_HOST=your_redis_url
JINA_API_KEY=your_jina_api_key
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_HOST=your_qdrant_host:6333
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Performance Metrics

The system tracks:

- Average operation latency
- Operations per second
- Cache hit rates
- Connection status
- Error rates

## Error Handling

- Automatic retry for transient failures
- Graceful degradation on Redis unavailability
- Detailed error logging
- Connection state monitoring

## Development

```bash
npm install
npm start
```

## Testing

```bash
npm test
```
