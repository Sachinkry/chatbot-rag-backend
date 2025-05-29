const { embeddingService } = require('../services/embeddingService');
const { generationService } = require('../services/generationService');
const { qdrantService } = require('../services/qdrantService');
const { cacheService } = require('../services/cache');

class RAGPipeline {
    constructor() {
        this.embeddingService = embeddingService;
        this.generationService = generationService;
        this.qdrantService = qdrantService;
        this.cacheService = cacheService;
    }

    async processQuery(query, sessionId) {
        try {
            // console.log('Processing query:', query);
            // console.log('Session ID:', sessionId);

            // Check cache first
            const cachedResponse = await this.cacheService.get(query);
            if (cachedResponse) {
                // console.log('Cache hit for query:', query);
                return cachedResponse;
            }

            // Get chat history
            const chatHistory = await this.cacheService.getChatHistory(sessionId) || [];
            // console.log('Chat history:', chatHistory);

            // Create embedding
            const embedding = await this.embeddingService.createEmbedding(query);
            // console.log('Created embedding (sample):', Array.isArray(embedding) ? embedding.slice(0, 5) : embedding);

            // Search Qdrant
            const searchResults = await this.qdrantService.search(embedding);
            console.log('Qdrant search response:', JSON.stringify(searchResults, null, 2));

            // Generate response with raw search results
            const response = await this.generationService.generateResponse({
                query,
                context: searchResults, // Pass raw search results instead of prepared context
                chatHistory
            });
            console.log('Gemini response:', response);

            // Cache the response
            await this.cacheService.set(query, response);
            // console.log('Cached response for query:', query);

            // Update chat history
            await this.cacheService.addToChatHistory(sessionId, {
                role: 'user',
                content: query
            });
            await this.cacheService.addToChatHistory(sessionId, {
                role: 'assistant',
                content: response
            });
            // console.log('Updated chat history for session:', sessionId);

            return response;
        } catch (error) {
            console.error('RAG pipeline error:', error.message);
            throw error;
        }
    }

    _prepareContext(similarVectors) {
        // Sort by score and take top results
        const sortedVectors = similarVectors.sort((a, b) => b.score - a.score);
        // Combine relevant text from vectors
        const context = sortedVectors
            .map(vector => vector.payload.maintext)
            .join('\n\n')
            .slice(0, this.maxContextLength);
        return context;
    }

    async addToKnowledgeBase(texts) {
        try {
            // Generate embeddings for all texts
            const embeddings = await embeddingService.createEmbeddings(texts);
            // Prepare vectors for Qdrant
            const vectors = embeddings.map((embedding, index) => ({
                id: Date.now() + index,
                vector: embedding,
                payload: { text: texts[index] }
            }));
            // Store in Qdrant
            await qdrantService.upsertVectors(vectors);
        } catch (error) {
            console.error('Error adding to knowledge base:', error);
            throw error;
        }
    }
}

// Export a singleton instance
module.exports = {
    ragPipeline: new RAGPipeline()
}; 