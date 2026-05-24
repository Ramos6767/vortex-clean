const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

if (!user || !token) {
  window.location.href = "/login.html";
}

const form = document.getElementById("form");
const input = document.getElementById("input");
const chat = document.getElementById("chat");
const chatArea = document.getElementById("chatArea");
const emptyState = document.getElementById("emptyState");

const stopBtn = document.getElementById("stopBtn");

let controller = null;

/* ADD MESSAGE */

function addMessage(text, type) {

  emptyState.style.display = "none";
  chat.style.display = "flex";

  const wrap =
    document.createElement("div");

  wrap.className =
    `msg-wrap ${type}`;

  /* HEADER */

  const header =
    document.createElement("div");

  header.className =
    "msg-header";

  header.innerHTML =
    type === "user"

    ? `
      <span class="msg-user">
        Você
      </span>
    `

    : `
      <span class="msg-bot">
        🌀 Vortex
      </span>
    `;

  /* MESSAGE */

  const div =
    document.createElement("div");

  div.className =
    `msg ${type}`;

  if (type === "bot") {

    div.innerHTML =
      marked.parse(text);

    /* COPY */

    const copyBtn =
      document.createElement("button");

    copyBtn.className =
      "copy-btn";

    copyBtn.innerHTML =
      "📋";

    copyBtn.onclick =
      async () => {

        await navigator
          .clipboard
          .writeText(text);

        copyBtn.innerHTML =
          "✅";

        setTimeout(() => {

          copyBtn.innerHTML =
            "📋";

        }, 1500);

      };

    wrap.appendChild(copyBtn);

  }

  else {

    div.textContent = text;

  }

  wrap.appendChild(header);
  wrap.appendChild(div);

  chat.appendChild(wrap);

  chatArea.scrollTop =
    chatArea.scrollHeight;

  return div;

}

/* SEND */

form.addEventListener(
  "submit",

  async (e) => {

    e.preventDefault();

    const message =
      input.value.trim();

    if (!message) return;

    addMessage(
      message,
      "user"
    );

    input.value = "";

    const botDiv =
      addMessage("", "bot");

    stopBtn.style.display =
      "flex";

    controller =
      new AbortController();

    try {

      const res =
        await fetch(
          "/chat/stream",
          {

            method: "POST",

            headers: {
              "Content-Type":
              "application/json",

              Authorization:
              `Bearer ${token}`
            },

            body:
            JSON.stringify({
              message
            }),

            signal:
            controller.signal

          }
        );

      const reader =
        res.body.getReader();

      const decoder =
        new TextDecoder();

      let fullText = "";

      while (true) {

        const {
          done,
          value
        } = await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(value);

        fullText += chunk;

        botDiv.innerHTML =
          marked.parse(fullText);

        chatArea.scrollTop =
          chatArea.scrollHeight;

      }

    }

    catch(err){

      if(err.name !== "AbortError"){

        botDiv.innerHTML =
          "Erro ao conectar.";

      }

    }

    stopBtn.style.display =
      "none";

  }
);

/* STOP */

stopBtn.onclick = () => {

  if(controller){

    controller.abort();

  }

  stopBtn.style.display =
    "none";

};