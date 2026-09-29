import Database from 'better-sqlite3';

const db = new Database('./conversas_juridicas.sqlite');

// Ativa o Write-Ahead Logging (WAL) para leitura/escrita ultrarrápidas concorrentes
db.pragma('journal_mode = WAL');

// Tabela de histórico de conversas
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL
  );
`);

// Prepared Statements estáticos para evitar desalocação de ponteiros C++ e crash no Node 24
const insertStmt = db.prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)');
const selectStmt = db.prepare(`
  SELECT role, content FROM messages 
  WHERE user_id = ? 
  ORDER BY id DESC LIMIT ?
`);

export const dbChat = {
  saveMessage(userId, role, content) {
    insertStmt.run(userId, role, content);
  },

  getHistory(userId, limit = 20) {
    const rows = selectStmt.all(userId, limit);
    return rows.reverse().map(row => ({
      role: row.role,
      parts: [{ text: row.content }]
    }));
  }
};
