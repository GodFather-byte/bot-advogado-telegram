import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <h1>Olá, {user?.name || user?.email} 👋</h1>
      <p>Bem-vindo ao portal do Assistente Jurídico. Escolha uma opção abaixo para começar.</p>
      <div className="dashboard-grid">
        <Link className="dashboard-card" to="/chat">💬 Chat com IA jurídica</Link>
        <Link className="dashboard-card" to="/casos">🗂️ Meus casos</Link>
        <Link className="dashboard-card" to="/documentos/pdf">📄 Analisar um PDF</Link>
        <Link className="dashboard-card" to="/documentos/gerar">📝 Gerar documento</Link>
        <Link className="dashboard-card" to="/advogados">👩‍⚖️ Rede de advogados</Link>
      </div>
    </div>
  );
}
