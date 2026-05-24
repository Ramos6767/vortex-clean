const nameInput =
document.getElementById("name");

const emailInput =
document.getElementById("email");

const passwordInput =
document.getElementById("password");

const authBtn =
document.getElementById("authBtn");

const toggleAuth =
document.getElementById("toggleAuth");

let isLogin = true;

/* ESCONDE NOME */

nameInput.style.display = "none";

/* TROCAR LOGIN/CADASTRO */

toggleAuth.onclick = ()=>{

  isLogin = !isLogin;

  if(isLogin){

    nameInput.style.display =
    "none";

    authBtn.textContent =
    "Entrar";

    toggleAuth.innerHTML =
    'Não tem conta? <span>Cadastrar</span>';

  }else{

    nameInput.style.display =
    "block";

    authBtn.textContent =
    "Cadastrar";

    toggleAuth.innerHTML =
    'Já tem conta? <span>Entrar</span>';

  }

};

/* LOGIN/CADASTRO */

authBtn.onclick = async ()=>{

  const endpoint =
  isLogin
  ? "/auth/login"
  : "/auth/register";

  const body = {

    email:
    emailInput.value,

    password:
    passwordInput.value
  };

  if(!isLogin){

    body.name =
    nameInput.value;

  }

  try{

    const res =
    await fetch(endpoint,{

      method:"POST",

      headers:{
        "Content-Type":
        "application/json"
      },

      body:JSON.stringify(body)

    });

    const data =
    await res.json();

    console.log(data);

    if(data.error){

      alert(data.error);
      return;

    }

    localStorage.setItem(
      "token",
      data.token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    window.location.href =
    "/index.html";

  }catch(err){

    console.log(err);

    alert(
      "Erro ao conectar."
    );

  }

};