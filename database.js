import Database from 'better-sqlite3';

const db = new Database('./conversas_juridicas.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL
  );
`);

export const dbChat = {
  saveMessage(userId, role, content) {
    const stmt = db.prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)');
    stmt.run(userId, role, content);
  },

  getHistory(userId, limit = 20) {
    const stmt = db.prepare(`
      SELECT role, content FROM messages 
      WHERE user_id = ? 
      ORDER BY id DESC LIMIT ?
    `);
    
    const rows = stmt.all(userId, limit);
    return rows.reverse().map(row => ({
      role: row.role,
      parts: [{ text: row.content }]
    }));
  }
};
