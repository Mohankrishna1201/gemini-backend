const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the API key and GoogleGenerativeAI instance
const apiKey = 'AIzaSyAowESxQuKFye4MgAqAJ8MCiSAvkgC1M8k';  // Use environment variables in production for security
const genAI = new GoogleGenerativeAI(apiKey);
const app = express();

app.use(cors());  // Enable CORS
app.use(express.json());

/**
 * Function to send a prompt to Gemini and get the response.
 * @param {string} prompt - The prompt text to send to the model.
 * @returns {Promise<string>} - The response text from the model.
 */
const getAIResponse = async (prompt) => {
    const model = await genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
};

// POST route to generate multiple questions, options, and correct answers based on a topic
app.post('/askgemini', async (req, res) => {
    const { topic, numQuestions } = req.body;  // Extract the topic and number of questions from the request body

    if (!topic || !numQuestions || isNaN(numQuestions) || numQuestions <= 0) {
        return res.status(400).json({ error: 'Valid topic and number of questions are required' });
    }

    try {
        const questionsArray = [];

        for (let i = 0; i < numQuestions; i++) {
            // Step 1: Generate a question based on the topic
            const questionPrompt = `Generate a clear multiple-choice question about the topic ${topic}. Do not add unnecessary labels like "Question:". Just return the question text.
don't give options just question is enough`;
            const question = await getAIResponse(questionPrompt);

            // Step 2: Generate options that must contain the answer for the question
            const optionsPrompt = `Generate four multiple-choice options for the following question: ${question}. One of these should be the correct answer. Please don't repeat "Options:" or mark the correct answer in this step.
don't give like (A),(B),(C),(D) JUST generate 4 options I will figure it out in frontend these. Vary options more make sure two options are not same`;
            const optionsText = await getAIResponse(optionsPrompt);

            // Parse options (assuming the model returns a comma-separated list of options)
            const options = optionsText.split(',').map(option => option.trim());

            // Step 3: Generate the correct answer for the question
            const answerPrompt = `Follow strictly From the following options: [${options.join(', ')}], which is the correct answer for the question: ${question}? Only return the exact correct option without any labels or explanations.. Only return the correct answer without any additional explanation or labels.
Don't include any (a),(b),(c)`;
            const correctAnswer = await getAIResponse(answerPrompt);

            // Construct the individual question object
            const questionObject = {
                question: question.trim(),
                options: options,
                correctAnswer: correctAnswer.trim()
            };

            // Add to the array
            questionsArray.push(questionObject);
        }

        // Send the final structured response with all questions
        res.status(200).json({ questions: questionsArray });

    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({ error: 'An error occurred while generating content.' });
    }
});
const geminiAsk = require('./media');
app.use(geminiAsk);

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port} 🔥`));
