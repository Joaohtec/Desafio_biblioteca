// ======================================================================
//  PROJETO: Sistema de Biblioteca Comunitária
//  ARQUIVO: server.js  (Express + MySQL com mysql2/promise)
//  ======================================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { query } from "./db.js"; // função para executar SQL (placeholders nomeados)

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Middlewares
app.use(cors({ origin: "*" })); // em produção, restrinja ao seu domínio
app.use(express.json());

// Helpers
const isEmail = (s) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
const notEmpty = (s) => String(s || "").trim().length > 0;

// Saúde
app.get("/", (_req, res) => res.send("API OK"));
app.get("/db-ping", async (_req, res) => {
  try {
    const [r] = await query("SELECT 1 AS ok");
    res.json({ db: "ok", result: r.ok });
  } catch (e) {
    res.status(500).json({ db: "erro", detail: e.message });
  }
});

/* =====================================================================
   USUÁRIOS
   ===================================================================== */
app.get("/api/usuarios", async (_req, res) => {
  try {
    const rows = await query(
      "SELECT id, nome, email FROM usuarios ORDER BY nome ASC"
    );
    res.json(rows);
  } catch (e) {
    console.error("[GET /api/usuarios]", e);
    res
      .status(500)
      .json({ error: "Falha ao listar usuários", detail: e.message });
  }
});

app.get("/api/usuarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });
    const rows = await query(
      "SELECT id, nome, email FROM usuarios WHERE id=:id",
      { id }
    );
    if (!rows.length)
      return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    console.error("[GET /api/usuarios/:id]", e);
    res
      .status(500)
      .json({ error: "Falha ao buscar usuário", detail: e.message });
  }
});

app.post("/api/usuarios", async (req, res) => {
  try {
    const { nome, email } = req.body;
    if (!notEmpty(nome))
      return res.status(400).json({ error: "Nome é obrigatório" });
    if (!isEmail(email))
      return res.status(400).json({ error: "E-mail inválido" });

    await query("INSERT INTO usuarios (nome, email) VALUES (:nome, :email)", {
      nome,
      email,
    });
    const [created] = await query(
      "SELECT id, nome, email FROM usuarios WHERE email=:email",
      { email }
    );
    res.status(201).json(created);
  } catch (e) {
    if (String(e.message).includes("Duplicate")) {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }
    console.error("[POST /api/usuarios]", e);
    res
      .status(500)
      .json({ error: "Falha ao criar usuário", detail: e.message });
  }
});

// DELETE (usado pelo front; bloqueia se houver empréstimos do usuário)
app.delete("/api/usuarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });
    const [{ n }] = await query(
      "SELECT COUNT(*) n FROM emprestimos WHERE usuario_id=:id",
      { id }
    );
    if (n > 0)
      return res
        .status(409)
        .json({ error: "Usuário com empréstimos vinculados" });
    await query("DELETE FROM usuarios WHERE id=:id", { id });
    res.status(204).end();
  } catch (e) {
    console.error("[DELETE /api/usuarios/:id]", e);
    res
      .status(500)
      .json({ error: "Falha ao excluir usuário", detail: e.message });
  }
});

/* =====================================================================
   LIVROS
   ===================================================================== */
app.get("/api/livros", async (_req, res) => {
  try {
    const rows = await query(
      "SELECT id, titulo, autor, categoria, ano FROM livros ORDER BY titulo ASC"
    );
    res.json(rows);
  } catch (e) {
    console.error("[GET /api/livros]", e);
    res
      .status(500)
      .json({ error: "Falha ao listar livros", detail: e.message });
  }
});

app.get("/api/livros/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });
    const rows = await query(
      "SELECT id, titulo, autor, categoria, ano FROM livros WHERE id=:id",
      { id }
    );
    if (!rows.length)
      return res.status(404).json({ error: "Livro não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    console.error("[GET /api/livros/:id]", e);
    res.status(500).json({ error: "Falha ao buscar livro", detail: e.message });
  }
});

app.post("/api/livros", async (req, res) => {
  try {
    const { titulo, autor, categoria, ano } = req.body;
    if (![titulo, autor, categoria].every(notEmpty))
      return res
        .status(400)
        .json({ error: "Título, Autor e Categoria são obrigatórios" });
    const anoNum = Number(ano);
    if (!Number.isInteger(anoNum) || anoNum < 0 || anoNum > 2100)
      return res.status(400).json({ error: "Ano inválido (0–2100)" });

    await query(
      "INSERT INTO livros (titulo, autor, categoria, ano) VALUES (:titulo, :autor, :categoria, :ano)",
      { titulo, autor, categoria, ano: anoNum }
    );
    const [created] = await query(
      "SELECT * FROM livros WHERE id=LAST_INSERT_ID()"
    );
    res.status(201).json(created);
  } catch (e) {
    console.error("[POST /api/livros]", e);
    res.status(500).json({ error: "Falha ao criar livro", detail: e.message });
  }
});

// DELETE (usado pelo front; bloqueia se houver empréstimos do livro)
app.delete("/api/livros/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });
    const [{ n }] = await query(
      "SELECT COUNT(*) n FROM emprestimos WHERE livro_id=:id",
      { id }
    );
    if (n > 0)
      return res
        .status(409)
        .json({ error: "Livro com empréstimos vinculados" });
    await query("DELETE FROM livros WHERE id=:id", { id });
    res.status(204).end();
  } catch (e) {
    console.error("[DELETE /api/livros/:id]", e);
    res
      .status(500)
      .json({ error: "Falha ao excluir livro", detail: e.message });
  }
});

/* =====================================================================
   EMPRÉSTIMOS
   ===================================================================== */

// Regra de negócio auxiliar
async function livroTemEmprestimoAtivo(livro_id) {
  const [{ n }] = await query(
    "SELECT COUNT(*) n FROM emprestimos WHERE livro_id=:livro_id AND status='Ativo'",
    { livro_id }
  );
  return n > 0;
}

// GET (com status calculado + dias corridos/restantes)
app.get("/api/emprestimos", async (req, res) => {
  try {
    const { status = "" } = req.query;
    if (!["Ativo", "Devolvido", "Atrasado", ""].includes(status))
      return res.status(400).json({ error: "Status inválido" });

    const base = `
      SELECT
        e.id, e.usuario_id, u.nome AS usuario_nome,
        e.livro_id,   l.titulo AS livro_titulo,
        e.data_emprestimo, e.data_prevista, e.data_devolucao,
        CASE
          WHEN e.status <> 'Devolvido' AND CURDATE() > e.data_prevista THEN 'Atrasado'
          ELSE e.status
        END AS status,
        DATEDIFF(COALESCE(e.data_devolucao, CURDATE()), e.data_emprestimo) AS dias_corridos,
        DATEDIFF(e.data_prevista, CURDATE()) AS dias_restantes
      FROM emprestimos e
      JOIN usuarios u ON u.id = e.usuario_id
      JOIN livros   l ON l.id = e.livro_id
    `;
    const where = status
      ? " WHERE (CASE WHEN e.status<>'Devolvido' AND CURDATE()>e.data_prevista THEN 'Atrasado' ELSE e.status END) = :status "
      : "";
    const order = " ORDER BY e.data_emprestimo DESC, e.id DESC";

    const rows = await query(base + where + order, { status });
    res.json(rows);
  } catch (e) {
    console.error("[GET /api/emprestimos]", e);
    res
      .status(500)
      .json({ error: "Falha ao listar empréstimos", detail: e.message });
  }
});

app.post("/api/emprestimos", async (req, res) => {
  try {
    const { usuario_id, livro_id, data_prevista } = req.body;
    if (![usuario_id, livro_id, data_prevista].every(notEmpty))
      return res
        .status(400)
        .json({
          error: "usuario_id, livro_id e data_prevista são obrigatórios",
        });

    const [u] = await query("SELECT id FROM usuarios WHERE id=:id", {
      id: usuario_id,
    });
    const [l] = await query("SELECT id FROM livros   WHERE id=:id", {
      id: livro_id,
    });
    if (!u || !l)
      return res.status(400).json({ error: "Usuário ou Livro inexistente" });

    if (await livroTemEmprestimoAtivo(livro_id))
      return res
        .status(409)
        .json({ error: "Livro já está em empréstimo Ativo" });

    const hoje = new Date().toISOString().slice(0, 10);
    if (data_prevista < hoje)
      return res
        .status(400)
        .json({ error: "Data prevista não pode ser no passado" });

    await query(
      "INSERT INTO emprestimos (usuario_id, livro_id, data_prevista, status) VALUES (:usuario_id, :livro_id, :data_prevista, 'Ativo')",
      { usuario_id, livro_id, data_prevista }
    );
    const [created] = await query(`
      SELECT e.*, u.nome AS usuario_nome, l.titulo AS livro_titulo
      FROM emprestimos e
      JOIN usuarios u ON u.id = e.usuario_id
      JOIN livros   l ON l.id = e.livro_id
      WHERE e.id = LAST_INSERT_ID()
    `);
    res.status(201).json(created);
  } catch (e) {
    console.error("[POST /api/emprestimos]", e);
    res
      .status(500)
      .json({ error: "Falha ao criar empréstimo", detail: e.message });
  }
});

// PATCH (devolver / renovar +N / reagendar para DATA)
app.patch("/api/emprestimos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });

    const { action, status, days, nova_data } = req.body;

    if (action === "devolver") {
      await query(
        "UPDATE emprestimos SET status='Devolvido', data_devolucao=CURDATE() WHERE id=:id",
        { id }
      );
      const [row] = await query("SELECT * FROM emprestimos WHERE id=:id", {
        id,
      });
      return res.json(row);
    }

    if (action === "renovar") {
      const add = Number(days || 7);
      await query(
        "UPDATE emprestimos SET data_prevista = DATE_ADD(data_prevista, INTERVAL :add DAY) WHERE id=:id",
        { id, add }
      );
      const [row] = await query("SELECT * FROM emprestimos WHERE id=:id", {
        id,
      });
      return res.json(row);
    }

    if (action === "reagendar") {
      if (!nova_data)
        return res
          .status(400)
          .json({ error: "nova_data é obrigatória (YYYY-MM-DD)" });
      const hoje = new Date().toISOString().slice(0, 10);
      if (nova_data < hoje)
        return res
          .status(400)
          .json({ error: "Data prevista não pode ser no passado" });

      await query(
        "UPDATE emprestimos SET data_prevista = :nova_data WHERE id=:id",
        { id, nova_data }
      );
      const [row] = await query("SELECT * FROM emprestimos WHERE id=:id", {
        id,
      });
      return res.json(row);
    }

    if (status) {
      if (!["Ativo", "Devolvido", "Atrasado"].includes(status))
        return res.status(400).json({ error: "Status inválido" });
      await query("UPDATE emprestimos SET status=:status WHERE id=:id", {
        id,
        status,
      });
      const [row] = await query("SELECT * FROM emprestimos WHERE id=:id", {
        id,
      });
      return res.json(row);
    }

    res
      .status(400)
      .json({ error: "Nada para atualizar. Envie {action} ou {status}." });
  } catch (e) {
    console.error("[PATCH /api/emprestimos/:id]", e);
    res
      .status(500)
      .json({ error: "Falha ao atualizar empréstimo", detail: e.message });
  }
});

app.delete("/api/emprestimos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });
    await query("DELETE FROM emprestimos WHERE id=:id", { id });
    res.status(204).end();
  } catch (e) {
    console.error("[DELETE /api/emprestimos/:id]", e);
    res
      .status(500)
      .json({ error: "Falha ao excluir empréstimo", detail: e.message });
  }
});

/* =====================================================================
   RESUMOS (status por usuário/livro, sem apagar nada)
   ===================================================================== */
async function resumoEmprestimosPor(chave, id) {
  const rows = await query(
    `
    SELECT
      CASE
        WHEN e.status <> 'Devolvido' AND CURDATE() > e.data_prevista THEN 'Atrasado'
        ELSE e.status
      END AS status_calc,
      COUNT(*) AS n
    FROM emprestimos e
    WHERE e.${chave} = :id
    GROUP BY status_calc
    `,
    { id }
  );
  const out = { Ativo: 0, Devolvido: 0, Atrasado: 0, total: 0 };
  for (const r of rows) {
    if (r.status_calc === "Ativo") out.Ativo = r.n;
    else if (r.status_calc === "Devolvido") out.Devolvido = r.n;
    else if (r.status_calc === "Atrasado") out.Atrasado = r.n;
    out.total += r.n;
  }
  out.pode_excluir = out.total === 0;
  return out;
}

app.get("/api/usuarios/:id/resumo-emprestimos", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });
    const resumo = await resumoEmprestimosPor("usuario_id", id);
    res.json(resumo);
  } catch (e) {
    console.error("[GET /api/usuarios/:id/resumo-emprestimos]", e);
    res.status(500).json({ error: "Falha ao obter resumo", detail: e.message });
  }
});

app.get("/api/livros/:id/resumo-emprestimos", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "ID inválido" });
    const resumo = await resumoEmprestimosPor("livro_id", id);
    res.json(resumo);
  } catch (e) {
    console.error("[GET /api/livros/:id/resumo-emprestimos]", e);
    res.status(500).json({ error: "Falha ao obter resumo", detail: e.message });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`API da Biblioteca rodando em http://localhost:${PORT}`);
});
