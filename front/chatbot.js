// Retrieve the merchant name from localStorage (or sessionStorage)
const merchantName = localStorage.getItem('merchant_name');

if (merchantName) {
    // Update the welcome message to include the merchant name
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.innerHTML = `Welcome, ${merchantName}! <br> How can I assist you today?`;
} else {
    console.log("No merchant name found in localStorage.");
}

const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".inputmsg");
const sendMessageButton = document.querySelector("#send-message");

// Utility to create message blocks
function createMessageElement(content, sender) {
    const messageWrapper = document.createElement("div");
    messageWrapper.classList.add(sender === 'user' ? "usermsg" : "botmsg");

    // Create sender's name dynamically based on who the sender is
    const senderName = document.createElement("div");
    senderName.classList.add("sender-name");
    senderName.textContent = sender === 'user' ? merchantName || "You" : "MEXY"; // Show merchant name for the user, "MEXY" for bot

    // Create the message content
    const messageContent = document.createElement("div");
    messageContent.classList.add("message");
    messageContent.innerHTML = content; // Insert the content of the message

    // Append the sender's name and message content to the message wrapper
    messageWrapper.appendChild(senderName);
    messageWrapper.appendChild(messageContent);

    return messageWrapper;
}

// Function to handle the bot's reply
async function handleBotReply(userMessage) {
    // Simulate bot reply (replace with actual API call in production)
    const botReply = await getBotReply(userMessage);

    // Format the response before displaying it (e.g., paragraphs, lists)
    const formattedReply = formatBotResponse(botReply);

    // Create and display the bot's formatted response
    const botMessageDiv = createMessageElement(formattedReply, "bot");
    chatBody.appendChild(botMessageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Function to format the bot's response
function formatBotResponse(response) {
    if (!response || typeof response !== 'string') return "";

    const lines = response.trim().split("\n");
    let formatted = "";
    let inList = false;

    lines.forEach((line) => {
        let trimmedLine = line.trim();

        if (trimmedLine === "") return; // Skip empty lines

        // Replace markdown-style bold (**text**) with <strong>text</strong>
        trimmedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        if (/^\d+\.\s+/.test(trimmedLine)) {
            // Numbered list
            if (!inList) {
                formatted += "<ol>";
                inList = true;
            }
            formatted += `<li>${trimmedLine.replace(/^\d+\.\s+/, "")}</li>`;
        } else if (/^[-*]\s+/.test(trimmedLine)) {
            // Bullet list
            if (!inList) {
                formatted += "<ul>";
                inList = true;
            }
            formatted += `<li>${trimmedLine.replace(/^[-*]\s+/, "")}</li>`;
        } else {
            // Close any open list
            if (inList) {
                formatted += formatted.includes("<ul>") ? "</ul>" : "</ol>";
                inList = false;
            }

            // Regular paragraph
            formatted += `<p>${trimmedLine}</p>`;
        }
    });

    // Close list if still open
    if (inList) {
        formatted += formatted.includes("<ul>") ? "</ul>" : "</ol>";
    }

    return formatted;
}


// Send message logic
async function handleOutgoingMessage(e) {
    e.preventDefault();

    const userMessage = messageInput.value.trim();
    if (!userMessage) return;  // Do nothing if there's no message

    // Clear input box
    messageInput.value = "";  // Clear the input field after sending

    // Display user's message
    const userMessageDiv = createMessageElement(userMessage, "user");
    chatBody.appendChild(userMessageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Show typing/loading
    const loadingDiv = createMessageElement("...", "bot");
    chatBody.appendChild(loadingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Get response from OpenAI API via backend and handle formatting
    await handleBotReply(userMessage);

    // Replace loading with real reply
    chatBody.removeChild(loadingDiv);
}

// Function to get bot's response (replace with actual API endpoint in production)
async function getBotReply(userMessage) {
    const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
    });

    const data = await response.json();
    return data.reply;  // Make sure your backend sends the bot's reply as "reply"
}

// Event listeners for handling user input
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();  // Prevent newline on Enter key press
        handleOutgoingMessage(e);
    }
});

sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));
