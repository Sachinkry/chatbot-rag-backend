const { redisClient } = require('./redisClient');

class ChatService {
    constructor() {
        this.client = redisClient;
    }

    async getChatHistory(sessionId) {
        const rawHistory = await this.client.getChatHistory(sessionId);
        return this.formatChatHistory(rawHistory);
    }

    async addToChatHistory(sessionId, messageObject) {
        // messageObject should have role and content
        const formattedMessage = this.formatMessage(messageObject);
        await this.client.addToChatHistory(sessionId, formattedMessage);
    }

    async getPaginatedChatHistory(sessionId, page = 1, pageSize = 10) {
        const rawHistory = await this.client.getPaginatedChatHistory(sessionId, page, pageSize);
        return this.formatChatHistory(rawHistory);
    }

    formatMessage(messageObject) {
        const timestamp = new Date().toISOString();
        // Return a single object that includes both user and bot parts and their timestamps
        // This structure is easier to store and retrieve from Redis as one item per turn
        return {
            user: messageObject.role === 'user' ? messageObject.content : null,
            bot: messageObject.role === 'assistant' ? messageObject.content : null,
            userTimestamp: messageObject.role === 'user' ? timestamp : null,
            botTimestamp: messageObject.role === 'assistant' ? timestamp : null,
        };
    }

    formatChatHistory(rawHistory) {
        // Assuming raw history entries are objects like { user: '...', bot: '...', userTimestamp: '...', botTimestamp: '...' }
        return rawHistory.map((entry) => {
            const messages = [];

            // Add user message if it exists in the entry
            if (entry.user) {
                messages.push({
                    role: 'user',
                    content: entry.user,
                    timestamp: entry.userTimestamp
                });
            }

            // Add bot message if it exists in the entry
            if (entry.bot) {
                messages.push({
                    role: 'assistant',
                    content: entry.bot,
                    timestamp: entry.botTimestamp
                });
            }

            return messages;
        }).flat();
    }
}

module.exports = {
    chatService: new ChatService()
}; 