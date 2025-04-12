const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const insights = require('./insights');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Import loadCSV function directly
const loadCSV = require('./loadCSV');

let datasets = {};
const TARGET_MERCHANT_ID = '3e2b6'; // Hardcoded merchant ID for initial development

async function loadAllData() {
  try {
    datasets.merchants = await loadCSV('./dataset/merchant.csv');
    datasets.items = await loadCSV('./dataset/items.csv');
    datasets.keywords = await loadCSV('./dataset/keywords.csv');
    datasets.updated_orders = await loadCSV('./dataset/updated_orders.csv');
    datasets.transactionData = await loadCSV('./dataset/transaction.zip', true, 'transaction_data.csv');
    datasets.transactionItems = await loadCSV('./dataset/transaction.zip', true, 'transaction_items.csv');
    console.log("✅ All datasets loaded");
    
    // Cache insights for the hardcoded merchant
    generateMerchantCache(TARGET_MERCHANT_ID);
  } catch (error) {
    console.error("Error loading data:", error);
  }
}

// Generate and cache insights for faster responses
let merchantInsightsCache = {};

function generateMerchantCache(merchantId) {
  try {
    merchantInsightsCache[merchantId] = insights.generateMerchantInsights(
      merchantId, 
      datasets
    );
    console.log(`✅ Insights cache generated for merchant: ${merchantId}`);
  } catch (error) {
    console.error(`Failed to generate insights for merchant ${merchantId}:`, error);
  }
}

// Start loading data when server starts
loadAllData();

// API endpoint to get merchant details
app.get('/api/merchant/:id', (req, res) => {
  const { id } = req.params;
  const merchant = datasets.merchants?.find(m => m.merchant_id === id);
  
  if (!merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }
  
  res.json(merchant);
});

// API endpoint to get comprehensive insights
app.get('/api/insights/:merchantId', (req, res) => {
  const { merchantId } = req.params;

  // Check if insights are cached
  if (merchantInsightsCache[merchantId]) {
    return res.json(merchantInsightsCache[merchantId]);
  }

  // If not in cache, generate on-demand
  try {
    const merchantInsights = insights.generateMerchantInsights(
      merchantId, 
      datasets
    );
    
    // Cache for future requests
    merchantInsightsCache[merchantId] = merchantInsights;
    
    res.json(merchantInsights);
  } catch (err) {
    console.error("Insight error:", err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Chat endpoint with insights integration
app.post('/chat', async (req, res) => {
  const { message, merchantId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  // Use either provided merchantId or default to our target merchant
  const targetMerchantId = merchantId || TARGET_MERCHANT_ID;

  try {
    // Get merchant details
    const merchant = datasets.merchants?.find(m => m.merchant_id === targetMerchantId);
    
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Get or generate merchant insights
    let merchantInsights = merchantInsightsCache[targetMerchantId];
    
    if (!merchantInsights) {
      merchantInsights = insights.generateMerchantInsights(
        targetMerchantId, 
        datasets
      );
      merchantInsightsCache[targetMerchantId] = merchantInsights;
    }

    // Prepare a detailed context for the AI based on the insights
    const insightsContext = prepareInsightsContext(merchantInsights);

    // Create prompt with merchant context and insights
    const prompt = `
You are MEXY, Grab's AI assistant for merchant-partners in Southeast Asia. You help merchants understand their business performance, identify opportunities, and improve operations. Be concise, proactive, and helpful in your responses.

MERCHANT DETAILS:
- Merchant ID: ${targetMerchantId}
- Merchant Name: ${merchant.merchant_name}
- City: ${merchant.city_id}
- Join Date: ${merchant.join_date}

CURRENT BUSINESS INSIGHTS:
${insightsContext}

INSTRUCTIONS:
1. Answer the user's question based on the above insights.
2. If they ask about sales, revenue, performance, or trends, provide specific data points from the insights.
3. If they ask for advice, provide actionable suggestions based on their data.
4. Be brief but informative - focus on the most important insights relevant to their question.
5. Use a friendly, professional tone and address the merchant by name when appropriate.
6. If they ask for information you don't have, acknowledge this and suggest what data might help.

USER QUERY: ${message}
`.trim();

    // Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: message }
      ],
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

// Helper function to format insights into a concise text context for the AI
function prepareInsightsContext(insights) {
  if (!insights || !insights.summary) {
    return "No insights available for this merchant.";
  }
  
  const { summary, operations, topItems, salesTrends, cuisineInsights } = insights;
  
  // Format top items
  const topItemsText = topItems && topItems.length
    ? topItems
        .map((item, index) => `${index + 1}. ${item.name}: ${item.count} sales, RM${item.revenue.toFixed(2)} revenue`)
        .join('\n')
    : "No item data available";
  
  // Format recent sales trends (last 5 days)
  const recentSalesText = salesTrends && salesTrends.daily && salesTrends.daily.length
    ? salesTrends.daily
        .slice(-5)
        .map(day => `- ${day.date}: RM${day.total.toFixed(2)}`)
        .join('\n')
    : "No recent sales data available";
  
  // Format cuisine insights
  const cuisineText = cuisineInsights && cuisineInsights.length
    ? cuisineInsights
        .map(c => `- ${c.cuisine}: ${c.count} orders (${c.percentage}%)`)
        .join('\n')
    : "No cuisine data available";
  
  return `
SUMMARY:
- Total Sales: RM${summary.totalSales}
- Total Orders: ${summary.totalOrders}
- Average Order Value: RM${summary.avgOrderValue}
- Top Selling Item: ${summary.topSellingItem}

OPERATIONS:
- Average Order Preparation Time: ${operations?.avgPrepTimeMinutes || 'N/A'} minutes
- Average Delivery Time: ${operations?.avgDeliveryTimeMinutes || 'N/A'} minutes
- Average Driver Wait Time: ${operations?.avgDriverWaitTimeMinutes || 'N/A'} minutes

TOP SELLING ITEMS:
${topItemsText}

RECENT SALES (Last 5 days):
${recentSalesText}

CUISINE PERFORMANCE:
${cuisineText}
  `.trim();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));