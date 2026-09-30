import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function LawyersPage() {
  const [specializations, setSpecializations] = useState([]);
  const [specialization, setSpecialization] = useState('');
  const [state, setState] = useState('');
  const [lawyers, setLawyers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.specializations().then((data) => setSpecializations(data.specializations)).catch((err) => setError(err.message));
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    setError('');
    if (!specialization) {
      setError('Selecione uma especialidade para buscar.');
      return;
    }
    try {
      const data = await api.lawyers(specialization, state || undefined);
      setLawyers(data.lawyers);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="lawyers-page">
      <h1>Rede de advogados</h1>
      <form onSubmit={handleSearch} className="inline-form">
        <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
          <option value="">Especialidade</option>
          {specializations.map((spec) => (
            <option key={spec.code} value={spec.code}>{spec.icon} {spec.name}</option>
          ))}
        </select>
        <input type="text" placeholder="UF (opcional)" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
        <button type="submit">Buscar</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <ul className="lawyer-list">
        {lawyers.map((lawyer) => (
          <li key={lawyer._id}>
            <strong>{lawyer.name}</strong> — {lawyer.location?.city}/{lawyer.location?.state}
            <p>{lawyer.bio}</p>
            <p>Contato: {lawyer.phone}{lawyer.telegramUsername ? ` · @${lawyer.telegramUsername}` : ''}</p>
          </li>
        ))}
        {!lawyers.length ? <li>Nenhum advogado encontrado ainda para essa busca.</li> : null}
      </ul>
    </div>
  );
}
