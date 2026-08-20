import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, ListChecks, BarChart3, LogOut, CheckCircle2, UserRound } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificationToggle from "./NotificationToggle";
import AccountModal from "./AccountModal";
import { useAuth } from "../context/AuthContext";
import { useHabits } from "../hooks/useHabits";
import { useNotifications } from "../hooks/useNotifications";

const NAV_ITEMS = [
  { to: "/", label: "Hoy", icon: LayoutGrid, end: true },
  { to: "/habitos", label: "Hábitos", icon: ListChecks },
  { to: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
];

function NavItem({ to, label, icon: Icon, end }) {
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
    </NavLink>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { habits } = useHabits();
  const { permission, advanceMinutes, requestPermission, setAdvanceMinutes } =
    useNotifications(habits);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
          <div className="flex items-center gap-2 px-2 pb-8">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal text-panel">
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </span>
            <span className="font-mono text-[15px] font-semibold tracking-tight">
              rutina
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          <div className="mt-auto flex items-center gap-2 border-t border-line pt-4">
            <button
              onClick={() => setAccountOpen(true)}
              title="Configuración de la cuenta"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left transition-colors hover:bg-panel-alt cursor-pointer"
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
              title="Cerrar sesión"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        {/* Main column */}
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
                title="Cuenta"
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

          {/* Bottom nav (mobile) */}
          <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-line bg-panel px-2 py-2 md:hidden">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "flex flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-[11px] font-medium",
                    isActive ? "text-signal" : "text-ink-faint",
                  ].join(" ")
                }
              >
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
