// server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const multer = require("multer");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static("public"));

/* =========================
   DATABASE
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================
   CREATE TABLES
========================= */

async function createTables() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER,
      role TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("Tabelas criadas");
}

/* =========================
   AUTH MIDDLEWARE
========================= */

function auth(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Token ausente"
    });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch {

    return res.status(401).json({
      error: "Token inválido"
    });
  }
}

/* =========================
   REGISTER
========================= */

app.post("/auth/register", async (req, res) => {

  try {

    const {
      name,
      email,
      password
    } = req.body;

    const userExists = await pool.query(
      `
      SELECT * FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (userExists.rows.length) {
      return res.status(400).json({
        error: "Usuário já existe"
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await pool.query(
      `
      INSERT INTO users
      (name,email,password)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [name, email, hash]
    );

    const token = jwt.sign(
      {
        id: user.rows[0].id,
        email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      token,
      name: user.rows[0].name
    });

  } catch (err) {

    console.log("Erro register:", err.message);

    res.status(500).json({
      error: "Erro ao cadastrar"
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/auth/login", async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    const user = await pool.query(
      `
      SELECT * FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (!user.rows.length) {
      return res.status(400).json({
        error: "Usuário não encontrado"
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.rows[0].password
    );

    if (!valid) {
      return res.status(400).json({
        error: "Senha inválida"
      });
    }

    const token = jwt.sign(
      {
        id: user.rows[0].id,
        email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      token,
      name: user.rows[0].name
    });

  } catch (err) {

    console.log("Erro login:", err.message);

    res.status(500).json({
      error: "Erro ao logar"
    });
  }
});

/* =========================
   GET CHATS
========================= */

app.get("/chats", auth, async (req, res) => {

  const chats = await pool.query(
    `
    SELECT *
    FROM chats
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [req.user.id]
  );

  res.json(chats.rows);
});

/* =========================
   GET MESSAGES
========================= */

app.get("/chats/:id/messages", auth, async (req, res) => {

  const messages = await pool.query(
    `
    SELECT *
    FROM messages
    WHERE chat_id = $1
    ORDER BY created_at ASC
    `,
    [req.params.id]
  );

  res.json(messages.rows);
});

/* =========================
   CHAT STREAM
========================= */

app.post("/chat/stream", auth, async (req, res) => {

  try {

    const {
      message,
      chatId
    } = req.body;

    let currentChatId = chatId;

    if (!currentChatId) {

      const newChat = await pool.query(
        `
        INSERT INTO chats
        (user_id,title)
        VALUES ($1,$2)
        RETURNING *
        `,
        [
          req.user.id,
          message.substring(0, 40)
        ]
      );

      currentChatId = newChat.rows[0].id;
    }

    await pool.query(
      `
      INSERT INTO messages
      (chat_id,role,content)
      VALUES ($1,$2,$3)
      `,
      [
        currentChatId,
        "user",
        message
      ]
    );

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.write(
      `[[CHAT_ID:${currentChatId}]]`
    );

    // RESPOSTA TESTE

    const responseText =
      "Olá 👋 Sou a Vortex AI futurista. Agora estou online no Railway funcionando em tempo real.";

    let i = 0;

    const interval = setInterval(async () => {

      if (i < responseText.length) {

        res.write(responseText[i]);

        i++;

      } else {

        clearInterval(interval);

        await pool.query(
          `
          INSERT INTO messages
          (chat_id,role,content)
          VALUES ($1,$2,$3)
          `,
          [
            currentChatId,
            "assistant",
            responseText
          ]
        );

        res.end();
      }

    }, 18);

  } catch (err) {

    console.log("Erro chat:", err.message);

    res.status(500).json({
      error: "Erro chat"
    });
  }
});

/* =========================
   FILE UPLOAD
========================= */

const upload = multer({
  dest: "uploads/"
});

app.post(
  "/upload",
  auth,
  upload.single("file"),
  async (req, res) => {

    try {

      const filePath = req.file.path;

      const text = fs.readFileSync(
        filePath,
        "utf-8"
      );

      fs.unlinkSync(filePath);

      res.json({
        filename: req.file.originalname,
        text
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error: "Erro upload"
      });
    }
  }
);

/* =========================
   START SERVER
========================= */

createTables().then(() => {

  app.listen(
    process.env.PORT || 3000,
    () => {

      console.log(
        `Vortex rodando`
      );
    }
  );

});