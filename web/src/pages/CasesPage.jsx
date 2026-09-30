import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function CasesPage() {
  const [cases, setCases] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [title, setTitle] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [casesData, specData] = await Promise.all([api.listCases(), api.specializations()]);
      setCases(casesData.cases);
      setSpecializations(specData.specializations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    try {
      await api.createCase(title, specialization || undefined);
      setTitle('');
      setSpecialization('');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSelect(id) {
    setError('');
    try {
      await api.selectCase(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="cases-page">
      <h1>Meus casos</h1>
      <form onSubmit={handleCreate} className="inline-form">
        <input
          type="text"
          placeholder="Título do caso (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
          <option value="">Especialidade (opcional)</option>
          {specializations.map((spec) => (
            <option key={spec.code} value={spec.code}>{spec.icon} {spec.name}</option>
          ))}
        </select>
        <button type="submit">Novo caso</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Carregando…</p> : (
        <ul className="case-list">
          {cases.map((item) => (
            <li key={item.id} className={item.isActive ? 'active' : ''}>
              <span>#{item.number} — {item.title}</span>
              {item.specialization ? <span className="tag">{item.specialization}</span> : null}
              {item.isActive ? <span className="tag active-tag">Ativo</span> : (
                <button type="button" onClick={() => handleSelect(item.id)}>Selecionar</button>
              )}
            </li>
          ))}
          {!cases.length ? <li>Nenhum caso criado ainda.</li> : null}
        </ul>
      )}
    </div>
  );
}
