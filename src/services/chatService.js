const { redisClient } = require('./redisClient');

class ChatService {
    constructor() {
        this.client = redisClient;
    }

    async getChatHistory(sessionId) {
        const rawHistory = await this.client.getChatHistory(sessionId);
        return this.formatChatHistory(rawHistory);
    }

    async addToChatHistory(sessionId, userQuery, botResponse) {
        const timestamp = new Date().toISOString();
        // Create a single object representing the full turn with timestamps
        const formattedMessage = {
            user: userQuery,
            bot: botResponse,
            userTimestamp: timestamp,
            botTimestamp: timestamp
        };
        // Pass this single object to redisClient
        await this.client.addToChatHistory(sessionId, formattedMessage);
    }

    async getPaginatedChatHistory(sessionId, page = 1, pageSize = 10) {
        const rawHistory = await this.client.getPaginatedChatHistory(sessionId, page, pageSize);
        return this.formatChatHistory(rawHistory);
    }

    // This method is now simplified to just format the stored turn object for the API
    formatMessage(messageObject) {
        // Avoid overwriting existing timestamps
        const now = new Date().toISOString();
        return {
          user: messageObject.user || null,
          bot: messageObject.bot || null,
          userTimestamp: messageObject.userTimestamp || now,
          botTimestamp: messageObject.botTimestamp || now
        };
      }
      

    // formatChatHistory now maps each stored turn object to an array of message objects for the API
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