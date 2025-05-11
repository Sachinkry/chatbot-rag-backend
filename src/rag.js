const axios = require('axios');
const config = require('./config'); // Import config

// Embed query using Jina API with caching
const embedQuery = async (query) => {
  const { redisClient } = require('./redis');
//   const cacheKey = `embedding:${query}`;
//   const cached = await redisClient.get(cacheKey);
//   if (cached) {
//     console.log('Embedding cache hit:', query);
//     return JSON.parse(cached);
//   }

  try {
    const response = await axios.post(
      'https://api.jina.ai/v1/embeddings',
      {
        model: 'jina-clip-v2',
        input: [{ text: query }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.JINA_API_KEY}`, // Use config
        },
        timeout: 10000,
      }
    );
    const embedding = response.data.data[0].embedding;
    // await redisClient.set(cacheKey, JSON.stringify(embedding), { EX: 24 * 60 * 60 });
    console.log('Embedding generated', embedding);
    return embedding;
  } catch (error) {
    console.error('Jina API error:', error.response ? error.response.data : error.message);
    throw new Error('Failed to embed query with Jina');
  }
};

// Query Qdrant for top-k passages (updated endpoint)
const searchQdrant = async (queryVector, topK = 3) => {
    console.log('Querying Qdrant with vector length:', queryVector.length, 'Sample:', queryVector.slice(0, 5)); // Debug
    try {
      const response = await axios.post(
        `http://${process.env.QDRANT_HOST}/collections/news_articles_world/points/search`, // Fixed endpoint
        {
          vector: queryVector,
          limit: topK,
          with_payload: true,
          with_vectors: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.QDRANT_API_KEY,
          },
        }
      );
      console.log('Qdrant raw response:', response.data.result);
      if (!response.data.result || response.data.result.length === 0) {
        console.error('Qdrant returned no points:', response.data);
        return [];
      }
      return response.data.result; // Fixed response structure
    } catch (error) {
      console.error('Qdrant error:', error.response ? error.response.data : error.message);
      throw error; // Let the outer try/catch handle it
    }
  };

// Call Gemini API with caching
const callGemini = async (context, message) => {
//   const { redisClient } = require('./redis');
//   const cacheKey = `gemini:${context}:${message}`;
//   const cached = await redisClient.get(cacheKey);
//   if (cached) {
//     console.log('Gemini cache hit:', cacheKey);
//     return cached;
//   }

  const prompt = `
    You are a professional AI news reporter. Your role is to deliver concise, fact-based, and well-contextualized news reports in response to user questions.

    Guidelines:
    - If the question is about a recent news topic (last few weeks), report on it using a journalistic tone — clear, direct, and informative.
    - Include context, key facts, and significance. Prioritize clarity over fluff.
    - Use 2 to 3 short paragraphs max. Lead with the main takeaway, then add relevant detail.
    - Avoid speculation, opinion, or sensationalism. Stick to facts available from reliable sources.

    Fallback Instructions:
    - If there are no relevant or current news reports, say:
    "There are no recent news articles on that topic. Here's a general overview based on common knowledge, if helpful."
    - If the question is unrelated to news, say:
    "I'm a news reporter AI. Please ask about recent events or current topics."

    Tone:
    - Neutral, informative, and journalistic. No jokes or personality unless the topic is cultural or light-hearted.

    Context:
    ${context}

    User Question:
    ${message}

    Answer:
  `;

  console.log('Calling Gemini API with prompt:', prompt);
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [
          {
            parts: [
              { text: prompt },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: config.GEMINI_API_KEY, // Use config
        },
        timeout: 10000,
      }
    );
    const generatedText = response.data.candidates[0].content.parts[0].text;
    if (!generatedText || generatedText.trim() === '') {
      throw new Error('Gemini returned an empty response');
    }
    // await redisClient.set(cacheKey, generatedText, { EX: 24 * 60 * 60 });
    // console.log('Gemini response cached:', cacheKey);
    console.log('Extracted Gemini response:', generatedText);
    return generatedText;
  } catch (error) {
    console.error('Gemini API error:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate response from Gemini API');
  }
};

module.exports = { embedQuery, searchQdrant, callGemini };