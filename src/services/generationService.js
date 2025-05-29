const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class GenerationService {
    constructor() {
        this.model = new GoogleGenerativeAI(config.gemini.apiKey).getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    async generateResponse({ query, context, chatHistory }) {
        try {
            console.log('Generating response for query:', query);
            console.log('Context:', context);
            console.log('Chat history:', chatHistory);

            // Prepare the prompt with context and chat history
            const prompt = this._preparePrompt(query, context, chatHistory);
            console.log('Generated prompt:', prompt);

            // Generate response
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            console.log('Generated response:', response);

            return response;
        } catch (error) {
            console.error('Generation error:', error.message);
            throw error;
        }
    }

    _preparePrompt(query, context, chatHistory) {
        // Ensure context is an array and has the expected structure
        const contextArray = Array.isArray(context) ? context : [];
        const contextText = contextArray
            .filter(item => item && item.payload && item.payload.maintext)
            .map(item => item.payload.maintext)
            .join('\n\n');
        
        const chatHistoryText = Array.isArray(chatHistory) 
            ? chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
            : '';

        return `Context:\n${contextText}\n\nChat History:\n${chatHistoryText}\n\nUser: ${query}\n\nAssistant:`;
    }
}

// Export a singleton instance
module.exports = {
    generationService: new GenerationService()
}; 