const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('../config');

class QdrantService {
    constructor() {
        this.client = new QdrantClient({
            url: config.qdrant.url,
            apiKey: config.qdrant.apiKey
        });
        this.collection = config.qdrant.collection;
    }

    async listCollections() {
        try {
            const result = await this.client.getCollections();
            console.log('List of collections:', result.collections);
            return result.collections;
        } catch (error) {
            console.error('Could not get collections:', error.message);
            throw error;
        }
    }

    async search(vector, options = {}) {
        try {
            console.log('Qdrant search request:', {
                collection: this.collection,
                vector: vector.slice(0, 5), // Log a sample of the vector
                limit: options.limit || 3,
                with_payload: options.with_payload !== false
            });
            const response = await this.client.search(this.collection, {
                vector,
                limit: options.limit || 3,
                with_payload: options.with_payload !== false
            });
            console.log('Qdrant search response:', JSON.stringify(response, null, 2));
            return response;
        } catch (error) {
            console.error('Qdrant search error:', error.message);
            throw error;
        }
    }

    async upsertVectors(vectors) {
        try {
            console.log('Upserting vectors to Qdrant:', vectors.length);
            const response = await this.client.upsert(this.collection, {
                points: vectors.map(vector => ({
                    id: vector.id,
                    vector: vector.vector,
                    payload: vector.payload
                }))
            });
            console.log('Qdrant upsert response:', response);
            return response;
        } catch (error) {
            console.error('Qdrant upsert error:', error.message);
            throw error;
        }
    }

    async deleteVectors(ids) {
        try {
            console.log('Deleting vectors from Qdrant:', ids);
            const response = await this.client.delete(this.collection, {
                points: ids
            });
            console.log('Qdrant delete response:', response);
            return response;
        } catch (error) {
            console.error('Qdrant delete error:', error.message);
            throw error;
        }
    }
}

// Export a singleton instance
module.exports = {
    qdrantService: new QdrantService()
}; 