const axios = require('axios');
const config = require('../config');

class EmbeddingService {
    constructor() {
        this.apiKey = config.jina.apiKey;
        this.apiUrl = 'https://api.jina.ai/v1/embeddings';
        this.model = 'jina-clip-v2';
    }

    async createEmbedding(text) {
        try {
            console.log('Creating embedding for:', text);
            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.model,
                    input: [{ text }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Jina API Response:', response.data);
            if (response.data && response.data.data && response.data.data[0]) {
                return response.data.data[0].embedding;
            }
            throw new Error('Invalid response format from Jina API');
        } catch (error) {
            console.error('Embedding creation error:', error.response?.data || error.message);
            throw error;
        }
    }

    async createEmbeddings(texts) {
        try {
            console.log('Creating embeddings for:', texts);
            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.model,
                    input: texts.map(text => ({ text }))
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Jina API Response:', response.data);
            if (response.data && response.data.data) {
                return response.data.data.map(item => item.embedding);
            }
            throw new Error('Invalid response format from Jina API');
        } catch (error) {
            console.error('Embeddings creation error:', error.response?.data || error.message);
            throw error;
        }
    }
}

// Export a singleton instance
module.exports = {
    embeddingService: new EmbeddingService()
}; 