let isRegister = false;

const nameBox = document.getElementById("registerFields");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const submitBtn = document.getElementById("submitBtn");
const switchBtn = document.getElementById("switchBtn");
const switchText = document.getElementById("switchText");

function isValidGmail(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
}

switchBtn.onclick = () => {
  isRegister = !isRegister;

  if (isRegister) {
    nameBox.classList.remove("hidden");
    submitBtn.textContent = "Cadastrar";
    switchText.textContent = "Já tem conta?";
    switchBtn.textContent = "Entrar";
  } else {
    nameBox.classList.add("hidden");
    submitBtn.textContent = "Entrar";
    switchText.textContent = "Não tem conta?";
    switchBtn.textContent = "Cadastrar";
  }
};

submitBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Preencha email e senha.");
    return;
  }

  if (!isValidGmail(email)) {
    alert("Use um Gmail válido. Exemplo: seunome@gmail.com");
    return;
  }

  if (password.length < 6) {
    alert("A senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  if (isRegister && !name) {
    alert("Digite seu nome.");
    return;
  }

  const url = isRegister ? "/auth/register" : "/auth/login";

  const body = isRegister
    ? { name, email, password }
    : { email, password };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    window.location.href = "/index.html";
  } catch {
    alert("Erro ao conectar.");
  }
};