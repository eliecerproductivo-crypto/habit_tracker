import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Habits from "./pages/Habits";
import Stats from "./pages/Stats";
import Friends from "./pages/Friends";
import Journal from "./pages/Journal";
import Coach from "./pages/Coach";
import Profile from "./pages/Profile";
import Timer from "./pages/Timer";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <p className="font-mono text-sm text-ink-faint">Cargando…</p>
    </div>
  );
}

// Páginas protegidas con sus rutas. Se renderizan TODAS siempre;
// la que no está activa se oculta con CSS (display:none) para que
// el estado interno (timer corriendo, chat, etc.) nunca se destruya.
const PROTECTED_PAGES = [
  { path: "/",            Page: Dashboard,  exact: true },
  { path: "/habitos",     Page: Habits },
  { path: "/estadisticas",Page: Stats },
  { path: "/amigos",      Page: Friends },
  { path: "/diario",      Page: Journal },
  { path: "/coach",       Page: Coach },
  { path: "/perfil-ia",   Page: Profile },
  { path: "/timer",       Page: Timer },
];

function ProtectedApp() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppShell activePath={location.pathname}>
      {PROTECTED_PAGES.map(({ path, Page, exact }) => {
        const isActive = exact
          ? location.pathname === path
          : location.pathname === path || location.pathname.startsWith(path + "/");
        return (
          <div key={path} className={isActive ? "contents" : "hidden"}>
            <Page />
          </div>
        );
      })}
    </AppShell>
  );
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/registro" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/recuperar"    element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Todas las rutas protegidas van a ProtectedApp */}
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
