import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { dbChat, dbCases } from '../database.js';

// Sem MONGODB_URI configurado, mongoose nunca se conecta neste teste, então
// mongoose.connection.readyState permanece diferente de 1 (conectado).
// Isso simula o cenário de "MongoDB indisponível" descrito na tarefa,
// garantindo que as operações de reset sejam no-op seguro (sem lançar erro).
describe('reset de dados do usuário sem MongoDB disponível', () => {
  it('mongoose não está conectado neste ambiente de teste', () => {
    expect(mongoose.connection.readyState).not.toBe(1);
  });

  it('dbChat.clearHistory retorna false sem lançar erro', async () => {
    await expect(dbChat.clearHistory('usuario-teste')).resolves.toBe(false);
  });

  it('dbCases.deleteAllForUser retorna false sem lançar erro', async () => {
    await expect(dbCases.deleteAllForUser('usuario-teste')).resolves.toBe(false);
  });

  it('dbChat.getHistory retorna lista vazia sem lançar erro', async () => {
    await expect(dbChat.getHistory('usuario-teste')).resolves.toEqual([]);
  });

  it('dbCases.listCases retorna lista vazia sem lançar erro', async () => {
    await expect(dbCases.listCases('usuario-teste')).resolves.toEqual([]);
  });
});
