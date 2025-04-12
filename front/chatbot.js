// Retrieve the merchant name and ID from localStorage (or sessionStorage)
const merchantName = localStorage.getItem('merchant_name');
const merchantId = localStorage.getItem('merchant_id') || '3e2b6'; // Default to our hardcoded merchant

// Update welcome message
if (merchantName) {
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.innerHTML = `Welcome, ${merchantName}!`;
} else {
    // If no merchant name in storage, fetch from API based on ID
    fetch(`http://localhost:3000/api/merchant/${merchantId}`)
        .then(response => response.json())
        .then(merchant => {
            localStorage.setItem('merchant_name', merchant.merchant_name);
            localStorage.setItem('merchant_id', merchant.merchant_id);
            
            const welcomeMessage = document.getElementById('welcomeMessage');
            welcomeMessage.innerHTML = `Welcome, ${merchant.merchant_name}! <br> How can I assist you today?`;
        })
        .catch(error => {
            console.error("Error fetching merchant info:", error);
        });
}

const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".inputmsg");
const sendMessageButton = document.querySelector("#send-message");
let chatHistory = []; // Store conversation history

// Add initial greeting from bot
window.addEventListener('DOMContentLoaded', () => {
    // Fetch insights summary first
    fetch(`http://localhost:3000/api/insights/${merchantId}`)
        .then(response => response.json())
        .then(insights => {
            // Create welcome message with insights summary
            const initialGreeting = 
            `Hello! I'm MEXY, your Grab merchant assistant. Here's a quick overview of your business:

📊 Sales: RM${insights.summary.totalSales.toFixed(2)} from ${insights.summary.totalOrders} orders
⭐ Top item: ${insights.summary.topSellingItem}
⏱️ Average preparation time: ${insights.operations.avgPrepTimeMinutes} minutes

What would you like to know about your business today?`;

            // Display the bot's greeting
            setTimeout(() => {
                const botMessageDiv = createMessageElement(initialGreeting, "bot");
                chatBody.appendChild(botMessageDiv);
                chatBody.scrollTop = chatBody.scrollHeight;
                
                // Add quick buttons if they don't exist yet
                addQuickButtons();
            }, 500);
        })
        .catch(error => {
            console.error("Error fetching insights:", error);
            
            // Fallback greeting if insights can't be fetched
            const fallbackGreeting = "Hello! I'm MEXY, your Grab merchant assistant. How can I help you today?";
            
            setTimeout(() => {
                const botMessageDiv = createMessageElement(fallbackGreeting, "bot");
                chatBody.appendChild(botMessageDiv);
            }, 500);
        });
});

// Add dynamic quick buttons based on merchant data
function addQuickButtons() {
    const quickButtonsContainer = document.querySelector('.quick-buttons') || document.createElement('div');
    
    if (!document.querySelector('.quick-buttons')) {
        quickButtonsContainer.className = 'quick-buttons';
        document.querySelector('.chat-footer').insertBefore(quickButtonsContainer, document.querySelector('.chat-input'));
    }
    
    // Define helpful quick buttons
    const quickButtons = [
        { text: "Sales summary", message: "What were my total sales last week?" },
        { text: "Best items", message: "What are my best-selling items?" },
        { text: "Improve delivery", message: "How can I reduce my preparation time?" },
        { text: "Business tips", message: "Give me some tips to increase my sales" }
    ];
    
    // Create and append buttons
    quickButtons.forEach(button => {
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        btn.textContent = button.text;
        btn.dataset.message = button.message;
        btn.addEventListener('click', () => {
            messageInput.value = button.message;
            sendMessageButton.click();
        });
        
        quickButtonsContainer.appendChild(btn);
    });
}

// Utility to create message blocks
function createMessageElement(content, sender) {
    const messageWrapper = document.createElement("div");
    messageWrapper.classList.add(sender === 'user' ? "usermsg" : "botmsg");

    // Create sender's name
    const senderName = document.createElement("div");
    senderName.classList.add("sender-name");
    senderName.textContent = sender === 'user' ? merchantName || "You" : "MEXY";

    // Create the message content
    const messageContent = document.createElement("div");
    messageContent.classList.add("message");
    messageContent.innerHTML = formatMessage(content);

    // Append the sender's name and message content to the message wrapper
    messageWrapper.appendChild(senderName);
    messageWrapper.appendChild(messageContent);

    return messageWrapper;
}

// Enhanced message formatting with support for business data
function formatMessage(message) {
    if (!message || typeof message !== 'string') return "";

    // Format markdown-style elements
    let formatted = message
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold text
        .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic text
        .replace(/RM(\d+(\.\d+)?)/g, "<span class='currency'>RM$1</span>"); // Currency formatting
    
    // Handle line breaks and lists
    const lines = formatted.split("\n");
    let html = "";
    let inList = false;
    
    lines.forEach((line) => {
        let trimmedLine = line.trim();
        
        if (trimmedLine === "") {
            html += "<br>";
            return;
        }
        
        // Convert emoji indicators to actual emojis for better visuals
        trimmedLine = trimmedLine
            .replace(/📊/g, "📊 ")
            .replace(/🔸/g, "🔸 ")
            .replace(/🔥/g, "🔥 ")
            .replace(/📅/g, "📅 ")
            .replace(/⭐/g, "⭐ ")
            .replace(/⏱️/g, "⏱️ ");
        
        if (/^\d+\.\s+/.test(trimmedLine)) {
            // Numbered list
            if (!inList) {
                html += "<ol>";
                inList = true;
            }
            html += `<li>${trimmedLine.replace(/^\d+\.\s+/, "")}</li>`;
        } else if (/^[-*]\s+/.test(trimmedLine)) {
            // Bullet list
            if (!inList) {
                html += "<ul>";
                inList = true;
            }
            html += `<li>${trimmedLine.replace(/^[-*]\s+/, "")}</li>`;
        } else {
            // Close any open list
            if (inList) {
                html += inList ? (html.includes("<ul>") ? "</ul>" : "</ol>") : "";
                inList = false;
            }
            
            // Check if this is a header-like line
            if (trimmedLine.toUpperCase() === trimmedLine && trimmedLine.length > 3) {
                html += `<h4>${trimmedLine}</h4>`;
            } else {
                html += `<p>${trimmedLine}</p>`;
            }
        }
    });
    
    // Close list if still open
    if (inList) {
        html += html.includes("<ul>") ? "</ul>" : "</ol>";
    }
    
    return html;
}

// Function to handle the bot's reply
async function handleBotReply(userMessage) {
    try {
        // Add user message to history
        chatHistory.push({ role: "user", content: userMessage });
        
        // Get bot reply
        const botReply = await getBotReply(userMessage);
        
        // Add bot reply to history
        chatHistory.push({ role: "assistant", content: botReply });
        
        // Create and display the bot's message
        const botMessageDiv = createMessageElement(botReply, "bot");
        chatBody.appendChild(botMessageDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
        
        // Limit history size to prevent it from growing too large
        if (chatHistory.length > 10) {
            chatHistory = chatHistory.slice(-10);
        }
    } catch (error) {
        console.error("Error getting bot reply:", error);
        
        // Handle error gracefully
        const errorMessage = "I'm sorry, I encountered an error processing your request. Please try again.";
        const errorMessageDiv = createMessageElement(errorMessage, "bot");
        chatBody.appendChild(errorMessageDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
}

// Send message logic
async function handleOutgoingMessage(e) {
    e.preventDefault();

    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    // Clear input box
    messageInput.value = "";

    // Display user's message
    const userMessageDiv = createMessageElement(userMessage, "user");
    chatBody.appendChild(userMessageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Show typing/loading indicator
    const loadingDiv = createMessageElement("...", "bot");
    chatBody.appendChild(loadingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Get and display bot's response
    await handleBotReply(userMessage);

    // Remove loading indicator
    chatBody.removeChild(loadingDiv);
}

// Function to get bot's response
async function getBotReply(userMessage) {
    const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: userMessage,
            merchantId: merchantId,
            history: chatHistory
        }),
    });

    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.reply;
}

// Event listeners for handling user input
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleOutgoingMessage(e);
    }
});

sendMessageButton.addEventListener("click", handleOutgoingMessage);