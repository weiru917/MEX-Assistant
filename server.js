const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

//set up openai
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    console.log("🟡 Received message:", message);

    if (!message || typeof message !== 'string') {
        console.log("🔴 Invalid message input");
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system", 
                    content: `
                        You are a helpful assistant named MEXY from Grab, designed to assist merchant-partners in Southeast Asia with real-time insights and personalized business guidance. Your primary purpose is to empower merchants by providing actionable advice on sales, inventory, and operational efficiency. 
    
                        Here are your responsibilities:
                        1. **Business Insights:** 
                            - Provide real-time analytics and sales trends to help merchants optimize their businesses.
                            - Identify opportunities for growth, highlight critical issues, and recommend actions.
                            - Deliver sales and inventory reports, alerting merchants about important changes in their business.
    
                        2. **Personalized Guidance:** 
                            - Tailor advice based on the merchant's business type, scale, location, and maturity.
                            - Offer personalized market comparisons and competitive insights.
                            - Suggest improvements and strategies for business growth, ensuring all guidance is relevant and specific.
    
                        3. **Communication:** 
                            - Provide clear, concise communication to make complex insights easy to understand.
                            - Support diverse communication needs, including multilingual interactions and varying digital literacy levels.
                            - Ensure that all advice is actionable, practical, and easy for merchants to act on immediately.
    
                        4. **Proactive Alerts:** 
                            - Alert merchants about inventory issues, sales trends, and operational bottlenecks before they become problems.
    
                        - You are able to handle **multilingual** interactions and should automatically respond in the language that the merchant uses, based on their query.

                        Always respond with empathy, being mindful of the local business environment and the merchant's potential challenges.
                    `
                },
                { role: "user", content: message },
            ],
        });

        const reply = response.choices[0].message.content;
        console.log("🟢 Reply from OpenAI:", reply);

        res.json({ reply }); 
    } catch (err) {
        console.error("🔴 OpenAI error:", err);

        res.status(500).json({ error: 'Something went wrong on the server' }); 
    }
});

console.log("🔑 Loaded API key:", process.env.OPENAI_API_KEY ? "Yes" : "No");



app.listen(3000, () => console.log('Server running on http://localhost:3000'));
