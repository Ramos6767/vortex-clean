// public/app.js

const API = "";

const form = document.getElementById("form");
const input = document.getElementById("input");
const chat = document.getElementById("chat");
const history = document.getElementById("history");
const emptyState = document.getElementById("emptyState");

const themeBtn = document.getElementById("themeBtn");
const themeModal = document.getElementById("themeModal");
const closeTheme = document.getElementById("closeTheme");

const openMenu = document.getElementById("openMenu");
const closeMenu = document.getElementById("closeMenu");
const sidebar = document.getElementById("sidebar");

const stopBtn = document.getElementById("stopBtn");

const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");

const suggestions = document.querySelectorAll(".suggestions button");

let controller = null;
let currentChatId = null;
let uploadedText = "";

const token = localStorage.getItem("token");

if (!token) {
  location.href = "/login.html";
}

async function loadChats() {

  const res = await fetch(`${API}/chats`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const chats = await res.json();

  history.innerHTML = "";

  chats.forEach(chatItem => {

    const div = document.createElement("div");

    div.className = "chat-card";

    const date = new Date(chatItem.created_at);

    div.innerHTML = `
      <h4>${chatItem.title}</h4>
      <span>${date.toLocaleString("pt-BR")}</span>
    `;

    div.onclick = () => {
      openChat(chatItem.id);
    };

    history.appendChild(div);
  });
}

function addMessage(role, text) {

  emptyState.style.display = "none";

  const wrapper = document.createElement("div");

  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");

  avatar.className = "msg-avatar";

  avatar.innerHTML =
    role === "assistant"
      ? "🌀"
      : "👤";

  const box = document.createElement("div");

  box.className = "msg-box";

  const content = document.createElement("div");

  content.className = "msg-content";

  content.innerHTML = marked.parse(text);

  box.appendChild(content);

  if (role === "assistant") {

    const actions = document.createElement("div");

    actions.className = "msg-actions";

    actions.innerHTML = `
      <button class="copy-btn">📋</button>
      <button>👍</button>
      <button>👎</button>
    `;

    actions.querySelector(".copy-btn").onclick = () => {

      navigator.clipboard.writeText(text);

      actions.querySelector(".copy-btn").innerHTML = "✅";
    };

    box.appendChild(actions);
  }

  if (role === "assistant") {

    wrapper.appendChild(avatar);
    wrapper.appendChild(box);

  } else {

    wrapper.appendChild(box);
  }

  chat.appendChild(wrapper);

  chat.scrollTop = chat.scrollHeight;

  return content;
}

async function sendMessage(message) {

  addMessage("user", message);

  const aiContent = addMessage("assistant", "Pensando...");

  controller = new AbortController();

  stopBtn.style.display = "flex";

  try {

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

      chat.scrollTop = chat.scrollHeight;
    }

    loadChats();

  } catch (err) {

    aiContent.innerHTML = `
      <p style="color:#ff4d4d">
        Erro ao conectar com a Vortex.
      </p>
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

async function openChat(id) {

  currentChatId = id;

  chat.innerHTML = "";

  emptyState.style.display = "none";

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

document.getElementById("newChat").onclick = () => {

  currentChatId = null;

  chat.innerHTML = "";

  emptyState.style.display = "block";
};

suggestions.forEach(btn => {

  btn.onclick = () => {

    input.value = btn.dataset.prompt;

    input.focus();
  };
});

themeBtn.onclick = () => {
  themeModal.style.display = "flex";
};

closeTheme.onclick = () => {
  themeModal.style.display = "none";
};

document.querySelectorAll(".theme-grid button").forEach(btn => {

  btn.onclick = () => {

    const color = btn.dataset.color;

    document.body.setAttribute("data-theme", color);

    localStorage.setItem("theme", color);

    themeModal.style.display = "none";
  };
});

const savedTheme = localStorage.getItem("theme");

if (savedTheme) {
  document.body.setAttribute("data-theme", savedTheme);
}

openMenu.onclick = () => {
  sidebar.classList.add("active");
};

closeMenu.onclick = () => {
  sidebar.classList.remove("active");
};

fileBtn.onclick = () => {
  fileInput.click();
};

fileInput.addEventListener("change", async () => {

  const file = fileInput.files[0];

  if (!file) return;

  const formData = new FormData();

  formData.append("file", file);

  filePreview.innerHTML = `
    📎 ${file.name}
  `;

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

    filePreview.innerHTML = `
      ✅ ${file.name} carregado
    `;
  }
});

document.getElementById("logoutBtn").onclick = () => {

  localStorage.removeItem("token");

  location.href = "/login.html";
};

loadChats();