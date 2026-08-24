import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid, ListChecks, BarChart3, LogOut, CheckCircle2,
  UserRound, Users, BookOpen, Sparkles, UserCircle, MoreHorizontal, X,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificationToggle from "./NotificationToggle";
import AccountModal from "./AccountModal";
import { useAuth } from "../context/AuthContext";
import { useHabits } from "../hooks/useHabits";
import { useNotifications } from "../hooks/useNotifications";
import { useFriends } from "../hooks/useFriends";

// Items principales en la bottom bar
const PRIMARY_NAV = [
  { to: "/", label: "Hoy", icon: LayoutGrid, end: true },
  { to: "/habitos", label: "Hábitos", icon: ListChecks },
  { to: "/estadisticas", label: "Stats", icon: BarChart3 },
  { to: "/amigos", label: "Amigos", icon: Users },
];

// Items secundarios en el drawer "más"
const SECONDARY_NAV = [
  { to: "/diario", label: "Diario", icon: BookOpen },
  { to: "/coach", label: "Coach IA", icon: Sparkles },
  { to: "/perfil-ia", label: "Mi perfil IA", icon: UserCircle },
];

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

function SidebarNavItem({ to, label, icon: Icon, end, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-signal-soft text-signal"
            : "text-ink-soft hover:bg-panel-alt hover:text-ink",
        ].join(" ")
      }
    >
      <Icon size={18} strokeWidth={2} />
      {label}
      {badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 font-mono text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { habits } = useHabits();
  const { permission, advanceMinutes, requestPermission, setAdvanceMinutes } = useNotifications(habits);
  const { pending } = useFriends();
  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const pendingCount = pending.length;

  // Cerrar drawer al navegar
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const isSecondaryActive = SECONDARY_NAV.some((item) => location.pathname === item.to);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto flex max-w-screen">

        {/* ── Sidebar (desktop) ──────────────────────────────────────────── */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
          <div className="flex items-center gap-2 px-2 pb-8">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal text-panel">
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </span>
            <span className="font-mono text-[15px] font-semibold tracking-tight">rutina</span>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {ALL_NAV.map((item) => (
              <SidebarNavItem
                key={item.to}
                {...item}
                badge={item.to === "/amigos" ? pendingCount : 0}
              />
            ))}
          </nav>

          <div className="mt-auto flex items-center gap-2 border-t border-line pt-4 rounded-lg transition-colors hover:bg-panel-alt">
            <button
              onClick={() => setAccountOpen(true)}
              title="Configuración de la cuenta"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pl-2 text-left cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft font-mono text-xs font-semibold text-violet">
                {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name || "Cuenta"}</p>
                <p className="truncate text-xs text-ink-faint">{user?.email}</p>
              </div>
            </button>
            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral cursor-pointer mr-1"
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        {/* ── Main column ────────────────────────────────────────────────── */}
        <div className="flex min-h-dvh flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/80 px-5 py-3 backdrop-blur md:justify-end">
            <div className="flex items-center gap-2 md:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal text-panel">
                <CheckCircle2 size={15} strokeWidth={2.5} />
              </span>
              <span className="font-mono text-sm font-semibold">rutina</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAccountOpen(true)}
                aria-label="Cuenta"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer md:hidden"
              >
                <UserRound size={17} />
              </button>
              <NotificationToggle
                permission={permission}
                advanceMinutes={advanceMinutes}
                onRequest={requestPermission}
                onChangeMinutes={setAdvanceMinutes}
              />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 px-5 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
            {children}
          </main>

          {/* ── Bottom nav (mobile) ───────────────────────────────────────── */}
          <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center border-t border-line bg-panel md:hidden">
            {PRIMARY_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                    isActive ? "text-signal" : "text-ink-faint",
                  ].join(" ")
                }
              >
                <span className="relative">
                  <Icon size={20} />
                  {to === "/amigos" && pendingCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-0.5 font-mono text-[9px] font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </span>
                {label}
              </NavLink>
            ))}

            {/* Botón "más" */}
            <button
              onClick={() => setDrawerOpen((o) => !o)}
              className={[
                "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors cursor-pointer",
                isSecondaryActive || drawerOpen ? "text-signal" : "text-ink-faint",
              ].join(" ")}
            >
              {drawerOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
              Más
            </button>
          </nav>
        </div>
      </div>

      {/* ── Drawer "más" (mobile) ──────────────────────────────────────────── */}
      {/* Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sheet desde abajo */}
      <div className={[
        "fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-line bg-panel px-4 pb-8 pt-4 transition-transform duration-300 md:hidden",
        drawerOpen ? "translate-y-0" : "translate-y-full",
      ].join(" ")}>
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint px-1">
          Más secciones
        </p>

        <div className="flex flex-col gap-1">
          {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-signal-soft text-signal"
                    : "text-ink hover:bg-panel-alt",
                ].join(" ")
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
