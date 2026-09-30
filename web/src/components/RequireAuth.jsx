import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
