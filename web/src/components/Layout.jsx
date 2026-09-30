import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/dashboard', label: 'Início' },
  { to: '/chat', label: 'Chat Jurídico' },
  { to: '/casos', label: 'Casos' },
  { to: '/documentos/pdf', label: 'Analisar PDF' },
  { to: '/documentos/gerar', label: 'Gerar Documento' },
  { to: '/advogados', label: 'Advogados' },
  { to: '/admin', label: 'Admin' },
];

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">⚖️ Assistente Jurídico</div>
        <nav className="main-nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          {user ? (
            <>
              <span>{user.name || user.email}</span>
              <button type="button" onClick={handleLogout}>Sair</button>
            </>
          ) : null}
        </div>
      </header>
      <main className="app-content">{children}</main>
      <footer className="app-footer">
        ⚠️ As respostas desta plataforma são educativas e não substituem a consulta a um advogado habilitado.
      </footer>
    </div>
  );
}
