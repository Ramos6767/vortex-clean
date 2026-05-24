require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("Banco conectado");
}

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const token = header.replace("Bearer ", "");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/test", (req, res) => {
  res.json({
    ok: true,
    model: process.env.MODEL || null,
    hasKey: !!process.env.OPENROUTER_API_KEY,
    hasDatabase: !!process.env.DATABASE_URL,
    hasJwt: !!process.env.JWT_SECRET
  });
});

app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Preencha todos os campos" });
    }

    const exists = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (exists.rows.length) {
      return res.status(400).json({ error: "Usuário já existe" });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (name,email,password_hash)
      VALUES ($1,$2,$3)
      RETURNING id,name,email
      `,
      [name, email, hash]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });
  } catch (err) {
    console.log("Erro register:", err.message);
    res.status(500).json({ error: "Erro ao cadastrar" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(400).json({ error: "Senha inválida" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.log("Erro login:", err.message);
    res.status(500).json({ error: "Erro login" });
  }
});

app.get("/chats", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM chats
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch {
    res.json([]);
  }
});

app.delete("/chats/:id", auth, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM chats
      WHERE id = $1
      AND user_id = $2
      `,
      [req.params.id, req.user.id]
    );

    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

app.get("/chats/:id/messages", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at ASC
      `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch {
    res.json([]);
  }
});

const upload = multer({
  dest: "uploads/"
});

app.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ error: "Arquivo não enviado" });
    }

    let text = "";

    if (req.file.mimetype === "application/pdf") {
      const buffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(buffer);
      text = data.text;
    } else {
      text = fs.readFileSync(req.file.path, "utf-8");
    }

    fs.unlinkSync(req.file.path);

    res.json({
      filename: req.file.originalname,
      text: text.slice(0, 15000)
    });
  } catch (err) {
    console.log("Erro upload:", err.message);
    res.status(500).json({ error: "Erro upload" });
  }
});

app.post("/chat/stream", auth, async (req, res) => {
  try {
    const { message, chatId, fileContext } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).end("OPENROUTER_API_KEY ausente");
    }

    if (!process.env.MODEL) {
      return res.status(500).end("MODEL ausente");
    }

    let currentChatId = chatId;

    if (!currentChatId) {
      const chat = await pool.query(
        `
        INSERT INTO chats (user_id,title)
        VALUES ($1,$2)
        RETURNING id
        `,
        [req.user.id, message.substring(0, 40)]
      );

      currentChatId = chat.rows[0].id;
    }

    await pool.query(
      `
      INSERT INTO messages (chat_id,role,content)
      VALUES ($1,$2,$3)
      `,
      [currentChatId, "user", message]
    );

    const oldMessages = await pool.query(
      `
      SELECT role,content
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at ASC
      LIMIT 20
      `,
      [currentChatId]
    );

    const finalMessage = fileContext
      ? `${message}\n\nArquivo enviado:\n${fileContext}`
      : message;

    const messages = [
      {
        role: "system",
        content:
          "Você é a Vortex AI, uma IA futurista inteligente. Responda em português de forma clara e organizada."
      },
      ...oldMessages.rows.map(msg => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      })),
      {
        role: "user",
        content: finalMessage
      }
    ];

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.MODEL,
        stream: true,
        messages
      },
      {
        responseType: "stream",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    let fullReply = "";

    response.data.on("data", chunk => {
      const lines = chunk.toString().split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const data = line.replace("data: ", "").trim();

        if (data === "[DONE]") continue;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content || "";

          if (content) {
            fullReply += content;
            res.write(content);
          }
        } catch {}
      }
    });

    response.data.on("end", async () => {
      await pool.query(
        `
        INSERT INTO messages (chat_id,role,content)
        VALUES ($1,$2,$3)
        `,
        [currentChatId, "assistant", fullReply]
      );

      res.end(`[[CHAT_ID:${currentChatId}]]`);
    });

    response.data.on("error", () => {
      res.end("Erro ao conectar com a Vortex.");
    });
  } catch (err) {
    console.log("Erro OpenRouter:", err.message);
    res.status(500).end("Erro ao conectar com a Vortex.");
  }
});

createTables().then(() => {
  app.listen(process.env.PORT || 3000, () => {
    console.log("Vortex online");
  });
});