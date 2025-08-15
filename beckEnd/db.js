// db.js — conexão MySQL (senha fixa no código)

import mysql from "mysql2/promise"; // (1) driver MySQL com suporte a async/await
import dotenv from "dotenv"; // (2) lê variáveis do arquivo .env (host, user, database)
dotenv.config(); // (3) carrega o .env para process.env

// (4) cria um pool de conexões (melhor que abrir/fechar a cada query)
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost", // (5) host do MySQL
  user: process.env.DB_USER || "root", // (6) usuário do MySQL
  password: "123456", // (7) *** SENHA FIXA AQUI ***
  database: process.env.DB_DATABASE || "biblioteca_db", // (8) nome do banco
  waitForConnections: true, // (9) faz fila quando o pool estiver cheio
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10), // (10) tamanho do pool
  namedPlaceholders: true, // (11) permite usar :nome nas queries
});

// (12) helper para executar SQL com parâmetros nomeados (:id, :email, etc.)
export async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params); // (13) executa a query e pega só as linhas
  return rows; // (14) retorna as linhas para as rotas usarem
}
