# RAG Chatbot Backend

This backend powers a full-stack chatbot that answers user queries using Retrieval-Augmented Generation (RAG) over a recent news corpus.

## Features

- Searches qdrant db with the embedded query
- Retrieves top-k contexts via semantic search
- Calls Gemini for final response generation
- Stores and retrieves session-based chat history from Redis
- Supports:
  - `POST /chat`: process user query
  - `GET /history?session_id=...`: fetch session history
  - `POST /reset`: clear session history
  - `GET /health`: check backend + Redis status

## Code Structure:

- `src/config.js`: Loads and validates environment variables.
- `src/middleware.js`: Logging and error-handling middleware.
- `src/rag.js`: Core RAG pipeline functions (embedQuery, searchQdrant, callGemini).
- `src/redis.js`: Redis client setup and session management logic.
- `src/server.js`: Express server setup, API routes, and shutdown.
- `.env`: environment variables

```js
REDIS_URL=your_redis_url
JINA_API_KEY=your_jina_api_key
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_HOST=your_qdrant_host:6333
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Redis Storage, Session Management & System Design

### 1. Session-Based Chat Storage

Each user session is identified using a `session_id`, passed explicitly from the frontend.

- **Key Format**: `chat_history:<session_id>`
- **Value**: JSON array of message objects:
  ```json
  [
    {
      "user": "What's the latest on elections?",
      "bot": "According to Reuters...",
      "userTimestamp": "2025-05-11T10:00:00Z",
      "botTimestamp": "2025-05-11T10:00:01Z"
    }
  ]
  ```

### 2. Embedding Cache

To avoid redundant embedding calls to the Jina API, the system can cache embeddings in Redis per unique query text.

- **Key Format**: `embedding:<query_text>`
- **Value**: JSON-encoded array of floats (the embedding vector). Example: `[0.023, -0.045, ..., 0.312]`
