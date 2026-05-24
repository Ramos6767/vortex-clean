const API = "";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token) {
  window.location.href = "/login.html";
}

const chatContainer = document.getElementById("chatContainer");
const messageInput = document.getElementById("messageInput");
const chatList = document.getElementById("chatList");

let currentChatId = null;
let allChats = [];

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

function onlyAuthHeader() {
  return {
    Authorization: `Bearer ${token}`
  };
}

function scrollBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role === "assistant" ? "bot" : "user"}`;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "bot-avatar";
    avatar.textContent = "🌀";
    div.appendChild(avatar);
  }

  const content = document.createElement("div");
  content.className = "message-content";

  if (role === "assistant" && window.marked) {
    content.innerHTML = marked.parse(text || "");
  } else {
    content.textContent = text || "";
  }

  div.appendChild(content);
  chatContainer.appendChild(div);

  scrollBottom();

  return content;
}

async function loadChats() {
  try {
    const res = await fetch(`${API}/chats`, {
      headers: onlyAuthHeader()
    });

    allChats = await res.json();
    renderChats(allChats);
  } catch {
    chatList.innerHTML = "";
  }
}

function renderChats(chats) {
  chatList.innerHTML = "";

  chats.forEach(chat => {
    const item = document.createElement("div");
    item.className = "chat-item";

    const date = new Date(chat.created_at);

    item.innerHTML = `
      <h3>${chat.title || "Nova conversa"}</h3>
      <p>${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      })}</p>
    `;

    item.onclick = () => openChat(chat.id);

    chatList.appendChild(item);
  });
}

async function openChat(id) {
  currentChatId = id;
  chatContainer.innerHTML = "";

  try {
    const res = await fetch(`${API}/chats/${id}/messages`, {
      headers: onlyAuthHeader()
    });

    const messages = await res.json();

    messages.forEach(msg => {
      addMessage(msg.role, msg.content);
    });
  } catch {
    addMessage("assistant", "Erro ao abrir conversa.");
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();

  if (!message) return;

  messageInput.value = "";

  addMessage("user", message);

  const botContent = addMessage("assistant", "Pensando...");

  try {
    const res = await fetch(`${API}/chat/stream`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        message,
        chatId: currentChatId
      })
    });

    if (!res.ok) {
      botContent.textContent = "Erro ao conectar com a Vortex.";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullText = "";
    botContent.textContent = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      let chunk = decoder.decode(value);

      const match = chunk.match(/\[\[CHAT_ID:(\d+)\]\]/);

      if (match) {
        currentChatId = Number(match[1]);
        chunk = chunk.replace(/\n?\[\[CHAT_ID:\d+\]\]/, "");
      }

      fullText += chunk;

      if (window.marked) {
        botContent.innerHTML = marked.parse(fullText);
      } else {
        botContent.textContent = fullText;
      }

      scrollBottom();
    }

    await loadChats();
  } catch {
    botContent.textContent = "Erro ao conectar com a Vortex.";
  }
}

function newChat() {
  currentChatId = null;
  chatContainer.innerHTML = `
    <div style="
      text-align:center;
      margin-top:80px;
      color:#9ca3af;
    ">
      <h1 style="color:white;margin-bottom:10px;">🌀 VORTEX AI</h1>
      <p>Comece uma nova conversa.</p>
    </div>
  `;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

newChat();
loadChats();