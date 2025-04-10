// Retrieve the merchant name from localStorage (or sessionStorage)
const merchantName = localStorage.getItem('merchant_name');

if (merchantName) {
    // Update the welcome message to include the merchant name
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.innerHTML = `Welcome, ${merchantName}! <br> How can I assist you today?`;

    // Update the sender name for the user messages to use the merchant name
    const userSenderName = document.getElementById('userSenderName');
    userSenderName.innerHTML = merchantName;
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

    const senderName = document.createElement("div");
    senderName.classList.add("sender-name");
    senderName.textContent = sender === 'user' ? merchantName || "You" : "MEXY";

    const messageContent = document.createElement("div");
    messageContent.classList.add("message");
    messageContent.innerHTML = content;

    messageWrapper.appendChild(senderName);
    messageWrapper.appendChild(messageContent);

    return messageWrapper;
}

// Send message logic
function handleOutgoingMessage(e) {
    e.preventDefault();

    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    // Clear input box
    messageInput.value = "";

    // Display user's message
    const userMessageDiv = createMessageElement(userMessage, "user");
    chatBody.appendChild(userMessageDiv);

    // Scroll to latest message
    chatBody.scrollTop = chatBody.scrollHeight;

    // Call backend/OpenAI here (you can expand this part later)
    simulateBotReply(userMessage); // Placeholder for now
}

async function getBotReply(userMessage) {
    const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
    });

    const data = await response.json();
    return data.reply;
}

async function handleOutgoingMessage(e) {
    e.preventDefault();

    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    messageInput.value = "";

    const userMessageDiv = createMessageElement(userMessage, "user");
    chatBody.appendChild(userMessageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Show typing/loading animation
    const loadingDiv = createMessageElement("...", "bot");
    chatBody.appendChild(loadingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Get response from OpenAI API via backend
    const reply = await getBotReply(userMessage);

    // Replace loading with real reply
    chatBody.removeChild(loadingDiv);
    const botReplyDiv = createMessageElement(reply, "bot");
    chatBody.appendChild(botReplyDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}


// Event listeners
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();  // Prevent newline
        handleOutgoingMessage(e);
    }
});

sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));
