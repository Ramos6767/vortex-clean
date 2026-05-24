const API = "";

const user = JSON.parse(localStorage.getItem("user") || "{}");
const token = localStorage.getItem("token");

if (!token) {
  location.href = "/login.html";
}

const form = document.getElementById("form");
const input = document.getElementById("input");
const chat = document.getElementById("chat");
const chatArea = document.getElementById("chatArea");
const emptyState = document.getElementById("emptyState");
const historyBox = document.getElementById("history");
const searchHistory = document.getElementById("searchHistory");

const newChat = document.getElementById("newChat");
const openMenu = document.getElementById("openMenu");
const closeMenu = document.getElementById("closeMenu");
const sidebar = document.getElementById("sidebar");

const themeBtn = document.getElementById("themeBtn");
const themeModal = document.getElementById("themeModal");
const closeTheme = document.getElementById("closeTheme");

const exportBtn = document.getElementById("exportBtn");
const logoutBtn = document.getElementById("logoutBtn");

const avatar = document.getElementById("avatar");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const helloName = document.getElementById("helloName");

const stopBtn = document.getElementById("stopBtn");
const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");
const filePreview = document.getElementById("filePreview");

let currentChatId = null;
let allChats = [];
let currentMessages = [];
let uploadedText = "";
let uploadedFileName = "";
let controller = null;

function getUserName() {
  return user?.name || user?.email?.split("@")[0] || "Gabriel";
}

function getInitial() {
  return getUserName().trim().slice(0, 1).toUpperCase();
}

function setupUser() {
  const name = getUserName();

  avatar.textContent = getInitial();
  profileAvatar.textContent = getInitial();
  profileName.textContent = name;
  helloName.textContent = name.split(" ")[0];
}

setupUser();

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

function formatDate(dateString) {
  const d = new Date(dateString);

  return d.toLocaleDateString("pt-BR") + ", " + d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatHour(date = new Date()) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function clearEmpty() {
  emptyState.style.display = "none";
}

function showEmpty() {
  emptyState.style.display = "block";
}

function addMessage(role, text) {
  clearEmpty();

  const message = document.createElement("div");
  message.className = `message ${role}`;

  if (role === "assistant") {
    const avatarEl = document.createElement("div");
    avatarEl.className = "msg-avatar";
    avatarEl.textContent = "🌀";
    message.appendChild(avatarEl);
  }

  const box = document.createElement("div");
  box.className = "msg-box";

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = formatHour();

  const content = document.createElement("div");
  content.className = "msg-content";

  if (role === "assistant") {
    content.innerHTML = marked.parse(text || "");
  } else {
    content.textContent = text || "";
  }

  box.appendChild(time);
  box.appendChild(content);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const copy = document.createElement("button");
    copy.textContent = "Copiar";

    copy.onclick = async () => {
      await navigator.clipboard.writeText(text);
      copy.textContent = "Copiado";
      setTimeout(() => copy.textContent = "Copiar", 1200);
    };

    const like = document.createElement("button");
    like.textContent = "👍";

    const dislike = document.createElement("button");
    dislike.textContent = "👎";

    actions.appendChild(copy);
    actions.appendChild(like);
    actions.appendChild(dislike);

    box.appendChild(actions);
  }

  message.appendChild(box);
  chat.appendChild(message);

  currentMessages.push({
    role: role === "assistant" ? "Vortex" : "Você",
    content: text
  });

  chatArea.scrollTop = chatArea.scrollHeight;

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
    historyBox.innerHTML = "";
  }
}

function renderChats(list) {
  historyBox.innerHTML = "";

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = `chat-card ${item.id === currentChatId ? "active" : ""}`;

    div.innerHTML = `
      <h4>${item.title || "Nova conversa"}</h4>
      <span>${formatDate(item.created_at)}</span>
    `;

    div.onclick = () => {
      openChat(item.id);
    };

    historyBox.appendChild(div);
  });
}

searchHistory.addEventListener("input", () => {
  const term = searchHistory.value.toLowerCase().trim();

  const filtered = allChats.filter(chat =>
    (chat.title || "").toLowerCase().includes(term)
  );

  renderChats(filtered);
});

async function openChat(id) {
  currentChatId = id;
  currentMessages = [];
  chat.innerHTML = "";
  clearEmpty();

  try {
    const res = await fetch(`${API}/chats/${id}/messages`, {
      headers: onlyAuthHeader()
    });

    const messages = await res.json();

    messages.forEach(msg => {
      addMessage(
        msg.role === "assistant" ? "assistant" : "user",
        msg.content
      );
    });

    renderChats(allChats);
  } catch {
    addMessage("assistant", "Erro ao abrir conversa.");
  }
}

async function sendMessage(message) {
  addMessage("user", message);

  const aiContent = addMessage("assistant", "");
  aiContent.innerHTML = "Pensando...";

  controller = new AbortController();
  stopBtn.style.display = "block";

  try {
    const res = await fetch(`${API}/chat/stream`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        message,
        chatId: currentChatId,
        fileContext: uploadedText
          ? `Arquivo: ${uploadedFileName}\n\n${uploadedText}`
          : ""
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error("Erro HTTP");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullText = "";
    aiContent.innerHTML = "";

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

      aiContent.innerHTML = marked.parse(fullText);

      chatArea.scrollTop = chatArea.scrollHeight;
    }

    const last = currentMessages[currentMessages.length - 1];

    if (last && last.role === "Vortex") {
      last.content = fullText;
    }

    uploadedText = "";
    uploadedFileName = "";
    filePreview.innerHTML = "";

    await loadChats();
  } catch (err) {
    if (err.name === "AbortError") {
      aiContent.innerHTML = marked.parse("Resposta interrompida.");
    } else {
      aiContent.innerHTML = marked.parse("Erro ao conectar com a Vortex.");
    }
  } finally {
    stopBtn.style.display = "none";
  }
}

form.addEventListener("submit", e => {
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

newChat.onclick = () => {
  currentChatId = null;
  currentMessages = [];
  chat.innerHTML = "";
  showEmpty();
  renderChats(allChats);
};

document.querySelectorAll(".suggestions button").forEach(btn => {
  btn.onclick = () => {
    input.value = btn.dataset.prompt;
    input.focus();
  };
});

openMenu.onclick = () => {
  sidebar.classList.add("active");
};

closeMenu.onclick = () => {
  sidebar.classList.remove("active");
};

themeBtn.onclick = () => {
  themeModal.style.display = "flex";
};

closeTheme.onclick = () => {
  themeModal.style.display = "none";
};

document.querySelectorAll(".theme-grid button").forEach(btn => {
  btn.onclick = () => {
    const theme = btn.dataset.theme;

    document.body.dataset.theme = theme;
    localStorage.setItem("vortexTheme", theme);

    themeModal.style.display = "none";
  };
});

const savedTheme = localStorage.getItem("vortexTheme");

if (savedTheme) {
  document.body.dataset.theme = savedTheme;
}

fileBtn.onclick = () => {
  fileInput.click();
};

fileInput.onchange = async () => {
  const file = fileInput.files[0];

  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  filePreview.textContent = `Lendo arquivo: ${file.name}`;

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
    filePreview.textContent = "Erro ao enviar arquivo.";
  }
};

exportBtn.onclick = () => {
  if (!currentMessages.length) {
    alert("Nenhuma conversa para exportar.");
    return;
  }

  const text = currentMessages
    .map(m => `${m.role}:\n${m.content}`)
    .join("\n\n----------------\n\n");

  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "conversa-vortex.txt";
  a.click();

  URL.revokeObjectURL(url);
};

logoutBtn.onclick = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "/login.html";
};

loadChats();