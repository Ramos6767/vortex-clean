const API = "";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token) {
  window.location.href = "/login.html";
}

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

document.getElementById("userName").textContent =
  user.name || "Gabriel";

document.getElementById("userAvatar").textContent =
  (user.name || "G")
    .slice(0, 1)
    .toUpperCase();

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
  chatContainer.scrollTop =
    chatContainer.scrollHeight;
}

div.appendChild(content);

if (role === "assistant") {

  const copyBtn =
    document.createElement("button");

  copyBtn.className =
    "copy-response";

  copyBtn.textContent =
    "Copiar";

  copyBtn.onclick = async () => {

    await navigator.clipboard.writeText(
      content.innerText
    );

    copyBtn.textContent =
      "Copiado";

    setTimeout(() => {

      copyBtn.textContent =
        "Copiar";

    }, 1200);

  };

  div.appendChild(copyBtn);

}

chatContainer.appendChild(div);

scrollBottom();

return content;

async function loadChats() {

  try {

    const res = await fetch(
      `${API}/chats`,
      {
        headers: onlyAuthHeader()
      }
    );

    allChats = await res.json();

    renderChats(allChats);

  } catch {

    chatList.innerHTML = "";

  }

}

function renderChats(chats) {

  chatList.innerHTML = "";

  chats.forEach(chat => {

    const item =
      document.createElement("div");

    item.className = "chat-item";

    const date =
      new Date(chat.created_at);

    item.innerHTML = `
      <div class="chat-info">
        <h3>
          ${chat.title || "Nova conversa"}
        </h3>

        <p>
          ${date.toLocaleDateString("pt-BR")}
          ${date.toLocaleTimeString(
            "pt-BR",
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          )}
        </p>
      </div>

      <button class="delete-chat">
        🗑
      </button>
    `;

    item.querySelector(
      ".chat-info"
    ).onclick = () => {

      openChat(chat.id);

    };

    /* DELETE SEM CONFIRM */

    item.querySelector(
      ".delete-chat"
    ).onclick = async (e) => {

      e.stopPropagation();

      await deleteChat(chat.id);

    };

    chatList.appendChild(item);

  });

}

async function deleteChat(id) {

  try {

    await fetch(
      `${API}/chats/${id}`,
      {
        method: "DELETE",
        headers: onlyAuthHeader()
      }
    );

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

    const res = await fetch(
      `${API}/chats/${id}/messages`,
      {
        headers: onlyAuthHeader()
      }
    );

    const messages =
      await res.json();

    messages.forEach(msg => {

      addMessage(
        msg.role,
        msg.content
      );

    });

  } catch {

    addMessage(
      "assistant",
      "Erro ao abrir conversa."
    );

  }

}

async function sendMessage() {

  const message = messageInput.value.trim();

  if (!message) return;

  messageInput.value = "";

  addMessage("user", message);

  /* =========================
     TYPING
  ========================= */

  const typing = document.createElement("div");

  typing.className = "typing";

  typing.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;

  chatContainer.appendChild(typing);

  scrollBottom();

  let botContent = null;

  try {

    const res = await fetch(
      `${API}/chat/stream`,
      {
        method: "POST",

        headers: authHeaders(),

        body: JSON.stringify({

          message,

          chatId: currentChatId,

          fileContext: uploadedText
            ? `
Arquivo:
${uploadedFileName}

${uploadedText}
`
            : ""

        })
      }
    );

    if (!res.ok) {

      typing.remove();

      addMessage(
        "assistant",
        "Erro ao conectar com a Vortex."
      );

      return;

    }

    const reader =
      res.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let fullText = "";

    /* REMOVE TYPING */

    typing.remove();

    botContent =
      addMessage(
        "assistant",
        ""
      );

    while (true) {

      const {
        done,
        value
      } = await reader.read();

      if (done) break;

      let chunk =
        decoder.decode(value);

      const match =
        chunk.match(
          /\[\[CHAT_ID:(\d+)\]\]/
        );

      if (match) {

        currentChatId =
          Number(match[1]);

        chunk = chunk.replace(
          /\n?\[\[CHAT_ID:\d+\]\]/,
          ""
        );

      }

      fullText += chunk;

      if (window.marked) {

        botContent.innerHTML =
          marked.parse(fullText);

      } else {

        botContent.textContent =
          fullText;

      }

      scrollBottom();

    }

    uploadedText = "";
    uploadedFileName = "";

    filePreview.textContent = "";

    await loadChats();

  } catch {

    typing.remove();

    addMessage(
      "assistant",
      "Erro ao conectar com a Vortex."
    );

  }

}

function newChat() {

  currentChatId = null;

  uploadedText = "";

  uploadedFileName = "";

  filePreview.textContent = "";

  chatContainer.innerHTML = `
    <div class="welcome">

      <h1>
        🌀 VORTEX AI
      </h1>

      <p>
        Comece uma nova conversa.
      </p>

    </div>
  `;

}

function logout() {

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.href =
    "/login.html";

}

function toggleSidebar() {

  sidebar.classList.toggle(
    "active"
  );

}

messageInput.addEventListener(
  "keydown",
  (e) => {

    if (e.key === "Enter") {

      sendMessage();

    }

  }
);

searchInput.addEventListener(
  "input",
  () => {

    const term =
      searchInput.value
        .toLowerCase()
        .trim();

    const filtered =
      allChats.filter(chat =>

        (chat.title || "")
          .toLowerCase()
          .includes(term)

      );

    renderChats(filtered);

  }
);

fileInput.addEventListener(
  "change",
  async () => {

    const file =
      fileInput.files[0];

    if (!file) return;

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    filePreview.textContent =
      `Enviando:
      ${file.name}`;

    try {

      const res = await fetch(
        `${API}/upload`,
        {
          method: "POST",

          headers: onlyAuthHeader(),

          body: formData
        }
      );

      const data =
        await res.json();

      if (data.error) {

        filePreview.textContent =
          data.error;

        return;

      }

      uploadedText =
        data.text || "";

      uploadedFileName =
        data.filename || file.name;

      filePreview.textContent =
        `Arquivo anexado:
        ${uploadedFileName}`;

    } catch {

      filePreview.textContent =
        "Erro upload.";

    }

  }
);

newChat();

loadChats();