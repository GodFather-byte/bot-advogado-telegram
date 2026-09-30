import { useState } from 'react';
import { api } from '../api/client.js';

export function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [stats, setStats] = useState(null);
  const [lawyers, setLawyers] = useState([]);
  const [error, setError] = useState('');

  async function handleUnlock(event) {
    event.preventDefault();
    setError('');
    try {
      const [statsData, lawyersData] = await Promise.all([
        api.adminStats(adminKey),
        api.adminLawyers(adminKey),
      ]);
      setStats(statsData);
      setLawyers(lawyersData.lawyers);
      setUnlocked(true);
    } catch (err) {
      setError(err.message);
      setUnlocked(false);
    }
  }

  async function handleAdvance(id, status) {
    setError('');
    try {
      await api.adminSetLawyerStatus(adminKey, id, status);
      const lawyersData = await api.adminLawyers(adminKey);
      setLawyers(lawyersData.lawyers);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!unlocked) {
    return (
      <div className="admin-page">
        <h1>Painel administrativo</h1>
        <p>Informe a chave administrativa (ADMIN_PANEL_KEY) para acessar. Ela nunca é salva no navegador nem enviada ao frontend — é usada apenas nesta requisição.</p>
        <form onSubmit={handleUnlock} className="inline-form">
          <input
            type="password"
            placeholder="Chave administrativa"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
          <button type="submit">Acessar</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Painel administrativo</h1>
      {error ? <p className="error">{error}</p> : null}
      {stats ? (
        <section className="stats-grid">
          <div className="stat-card"><span>{stats.totalMessages}</span><small>Mensagens</small></div>
          <div className="stat-card"><span>{stats.uniqueUsers}</span><small>Usuários únicos</small></div>
          <div className="stat-card"><span>{stats.available ? 'Online' : 'Indisponível'}</span><small>MongoDB</small></div>
        </section>
      ) : null}
      <h2>Advogados pendentes</h2>
      <ul className="admin-lawyer-list">
        {lawyers.map((lawyer) => (
          <li key={lawyer._id}>
            <strong>{lawyer.name}</strong> — OAB {lawyer.oabNumber} ({lawyer.status})
            <div className="actions">
              {lawyer.status === 'pending_verification' ? (
                <button type="button" onClick={() => handleAdvance(lawyer._id, 'verified')}>Verificar</button>
              ) : null}
              {lawyer.status === 'verified' ? (
                <button type="button" onClick={() => handleAdvance(lawyer._id, 'active')}>Ativar</button>
              ) : null}
            </div>
          </li>
        ))}
        {!lawyers.length ? <li>Nenhum cadastro pendente.</li> : null}
      </ul>
    </div>
  );
}
