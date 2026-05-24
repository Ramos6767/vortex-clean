// public/app.js

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const stopBtn = document.getElementById("stopBtn");
const chatList = document.getElementById("chatList");
const fileInput = document.getElementById("fileInput");

const API = "";

let controller = null;
let currentChatId = null;
let uploadedText = "";

function addMessage(role, text) {

  const div = document.createElement("div");

  div.className = `message ${role}`;

  const top = document.createElement("div");
  top.className = "msg-top";

  const name = document.createElement("span");
  name.className = "msg-name";

  name.innerText =
    role === "user"
      ? "Você"
      : "Vortex";

  top.appendChild(name);

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.innerText = "Copiar";

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(text);
    copyBtn.innerText = "Copiado";

    setTimeout(() => {
      copyBtn.innerText = "Copiar";
    }, 1500);
  };

  top.appendChild(copyBtn);

  const content = document.createElement("div");
  content.className = "msg-content";

  content.innerHTML = marked.parse(text);

  div.appendChild(top);
  div.appendChild(content);

  messages.appendChild(div);

  messages.scrollTop = messages.scrollHeight;

  return content;
}

async function sendMessage(message) {

  addMessage("user", message);

  const aiContent = addMessage("assistant", "Pensando...");

  controller = new AbortController();

  stopBtn.style.display = "flex";

  try {

    const token = localStorage.getItem("token");

    const response = await fetch(`${API}/chat/stream`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },

      body: JSON.stringify({
        message,
        chatId: currentChatId,
        fileContext: uploadedText
      }),

      signal: controller.signal
    });

    const reader = response.body.getReader();

    const decoder = new TextDecoder();

    let fullText = "";

    aiContent.innerHTML = "";

    while (true) {

      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);

      if (chunk.includes("[[CHAT_ID:")) {

        const id =
          chunk
            .split("[[CHAT_ID:")[1]
            .split("]]")[0];

        currentChatId = id;

        continue;
      }

      fullText += chunk;

      aiContent.innerHTML = marked.parse(fullText);

      messages.scrollTop = messages.scrollHeight;
    }

    loadChats();

  } catch (err) {

    aiContent.innerHTML = `
      <span style="color:red">
        Erro ao conectar com a Vortex.
      </span>
    `;

  } finally {

    stopBtn.style.display = "none";

    uploadedText = "";
  }
}

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const message = input.value.trim();

  if (!message) return;

  input.value = "";

  sendMessage(message);
});

stopBtn.onclick = () => {

  if (controller) {
    controller.abort();
  }

  stopBtn.style.display = "none";
};

async function loadChats() {

  const token = localStorage.getItem("token");

  if (!token) return;

  const res = await fetch(`${API}/chats`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const chats = await res.json();

  chatList.innerHTML = "";

  chats.forEach(chat => {

    const div = document.createElement("div");

    div.className = "chat-item";

    const date = new Date(chat.created_at);

    div.innerHTML = `
      <div class="chat-title">
        ${chat.title}
      </div>

      <div class="chat-date">
        ${date.toLocaleString("pt-BR")}
      </div>
    `;

    div.onclick = () => {
      openChat(chat.id);
    };

    chatList.appendChild(div);
  });
}

async function openChat(id) {

  currentChatId = id;

  messages.innerHTML = "";

  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/chats/${id}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();

  data.forEach(msg => {
    addMessage(msg.role, msg.content);
  });
}

document.getElementById("newChatBtn").onclick = () => {

  currentChatId = null;

  messages.innerHTML = `
    <div class="welcome">
      <h1>Nova conversa</h1>
    </div>
  `;
};

fileInput.addEventListener("change", async () => {

  const file = fileInput.files[0];

  if (!file) return;

  const formData = new FormData();

  formData.append("file", file);

  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/upload`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${token}`
    },

    body: formData
  });

  const data = await res.json();

  if (data.text) {

    uploadedText = data.text;

    addMessage(
      "assistant",
      `Arquivo "${data.filename}" carregado com sucesso.`
    );
  }
});

loadChats();