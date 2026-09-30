import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { Layout } from './components/Layout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { ChatPage } from './pages/ChatPage.jsx';
import { CasesPage } from './pages/CasesPage.jsx';
import { PdfUploadPage } from './pages/PdfUploadPage.jsx';
import { DocumentGeneratorPage } from './pages/DocumentGeneratorPage.jsx';
import { LawyersPage } from './pages/LawyersPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

function Protected({ children }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registrar" element={<RegisterPage />} />
        <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/chat" element={<Protected><ChatPage /></Protected>} />
        <Route path="/casos" element={<Protected><CasesPage /></Protected>} />
        <Route path="/documentos/pdf" element={<Protected><PdfUploadPage /></Protected>} />
        <Route path="/documentos/gerar" element={<Protected><DocumentGeneratorPage /></Protected>} />
        <Route path="/advogados" element={<Protected><LawyersPage /></Protected>} />
        <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
