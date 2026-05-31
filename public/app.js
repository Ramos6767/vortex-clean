const API = "";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token) window.location.href = "/login.html";

const chatContainer = document.getElementById("chatContainer");
const messageInput = document.getElementById("messageInput");
const chatList = document.getElementById("chatList");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");
const searchInput = document.getElementById("searchInput");
const sidebar = document.getElementById("sidebar");

let currentChatId = null;
let allChats = [];
let uploadedText = "";
let uploadedFileName = "";

document.getElementById("userName").textContent = user.name || "Gabriel";
document.getElementById("userAvatar").textContent =
  (user.name || "G").slice(0, 1).toUpperCase();

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

function addCopyButtonsToCode(content) {
  content.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".copy-code")) return;

    const btn = document.createElement("button");
    btn.className = "copy-code";
    btn.textContent = "Copiar código";

    btn.onclick = async () => {
      const code = pre.querySelector("code")?.innerText || pre.innerText;
      await navigator.clipboard.writeText(code);

      btn.textContent = "Copiado";

      setTimeout(() => {
        btn.textContent = "Copiar código";
      }, 1200);
    };

    pre.style.position = "relative";
    pre.prepend(btn);
  });
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
    addCopyButtonsToCode(content);
  } else {
    content.textContent = text || "";
  }

  div.appendChild(content);

  if (role === "assistant") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-response";
    copyBtn.textContent = "Copiar";

    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(content.innerText);
      copyBtn.textContent = "Copiado";
      setTimeout(() => {
        copyBtn.textContent = "Copiar";
      }, 1200);
    };

    div.appendChild(copyBtn);
  }

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
      <div class="chat-info">
        <h3>${chat.title || "Nova conversa"}</h3>
        <p>${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit"
        })}</p>
      </div>

      <button class="delete-chat">🗑</button>
    `;

    item.querySelector(".chat-info").onclick = () => openChat(chat.id);

    item.querySelector(".delete-chat").onclick = async (e) => {
      e.stopPropagation();
      await deleteChat(chat.id);
    };

    chatList.appendChild(item);
  });
}

async function deleteChat(id) {
  try {
    await fetch(`${API}/chats/${id}`, {
      method: "DELETE",
      headers: onlyAuthHeader()
    });

    if (currentChatId === id) {
      newChat();
    }

    await loadChats();
  } catch {
    alert("Erro ao apagar.");
  }
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

  const typing = document.createElement("div");
  typing.className = "typing";
  typing.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;

  chatContainer.appendChild(typing);
  scrollBottom();

  try {
    const res = await fetch(`${API}/chat/stream`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        message,
        chatId: currentChatId,
        fileContext: uploadedText
          ? `Arquivo:\n${uploadedFileName}\n\n${uploadedText}`
          : ""
      })
    });

    typing.remove();

    if (!res.ok) {
      addMessage("assistant", "Erro ao conectar com a Vortex.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullText = "";
    const botContent = addMessage("assistant", "");

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
        addCopyButtonsToCode(botContent);
      } else {
        botContent.textContent = fullText;
      }

      scrollBottom();
    }

    uploadedText = "";
    uploadedFileName = "";
    filePreview.textContent = "";

    await loadChats();
  } catch {
    typing.remove();
    addMessage("assistant", "Erro ao conectar com a Vortex.");
  }
}

function newChat() {
  currentChatId = null;
  uploadedText = "";
  uploadedFileName = "";
  filePreview.textContent = "";

  chatContainer.innerHTML = `
    <div class="welcome">
      <div class="welcome-center">
        <h1>🌀 VORTEX AI</h1>
        <h3>Como posso ajudar hoje?</h3>

        <div class="quick-actions">
          <button onclick="quickPrompt('Crie um código HTML CSS e JavaScript moderno')">
            💻 Criar código
          </button>

          <button onclick="quickPrompt('Explique este assunto de forma simples')">
            📚 Explicar matéria
          </button>

          <button onclick="quickPrompt('Escreva um texto profissional sobre')">
            ✍️ Escrever texto
          </button>

          <button onclick="quickPrompt('Me dê ideias criativas para')">
            🚀 Gerar ideias
          </button>
        </div>
      </div>
    </div>
  `;
}

function quickPrompt(text) {
  messageInput.value = text;
  messageInput.focus();
}

function startVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Seu navegador não suporta voz.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.start();

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    messageInput.value = text;
    messageInput.focus();
  };
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

function toggleSidebar() {
  sidebar.classList.toggle("active");
}

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase().trim();

  const filtered = allChats.filter(chat =>
    (chat.title || "").toLowerCase().includes(term)
  );

  renderChats(filtered);
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];

  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  filePreview.textContent = `Enviando: ${file.name}`;

  try {
    const res = await fetch(`${API}/upload`, {
      method: "POST",
      headers: onlyAuthHeader(),
      body: formData
    });

    const data = await res.json();

    if (data.error) {
      filePreview.textContent = data.error;
      return;
    }

    uploadedText = data.text || "";
    uploadedFileName = data.filename || file.name;

    filePreview.textContent = `Arquivo anexado: ${uploadedFileName}`;
  } catch {
    filePreview.textContent = "Erro upload.";
  }
});

window.sendMessage = sendMessage;
window.newChat = newChat;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.quickPrompt = quickPrompt;
window.startVoice = startVoice;

newChat();
loadChats();
function openSettings() {
  document.getElementById("settingsModal").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}

function setTheme(mode) {
  if (mode === "light") {
    document.body.classList.add("light-mode");
  } else {
    document.body.classList.remove("light-mode");
  }

  localStorage.setItem("theme", mode);
}

const savedTheme = localStorage.getItem("theme");

if (savedTheme === "light") {
  document.body.classList.add("light-mode");
}

window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.setTheme = setTheme;