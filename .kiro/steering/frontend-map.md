# Mapa del Frontend — rutina (habit tracker)

## Stack
React + Vite + TailwindCSS · Axios · React Router v6 · Lucide icons · Recharts

## API Client (`src/api/client.js`)
- Base URL: `/api` (Vite proxy en dev → FastAPI local; en prod → Vercel serverless).
- Timeout: 8 000 ms.
- Auth: JWT en `localStorage` (`habit_tracker_token`). Request interceptor inyecta `Authorization: Bearer <token>` en cada llamada.
- Response interceptor: 401 real → limpia token + llama `onUnauthorized` registrado por `AuthContext`. No dispara en errores de red.

---

## Routing (`src/App.jsx`)
Provider tree: `ThemeProvider` → `AuthProvider` → `AppRoutes`.

**Patrón lazy-mount / keep-alive:** las páginas protegidas se montan la primera vez que se visitan y se mantienen vivas con `className="hidden"` (CSS `display:none`). **Nunca se desmontan.** Esto mantiene el timer corriendo y el historial del chat vivo mientras se navega.

| Ruta | Página | Notas |
|---|---|---|
| `/` | `Dashboard` | `exact: true` |
| `/habitos` | `Habits` | |
| `/estadisticas` | `Stats` | |
| `/amigos` | `Friends` | |
| `/diario` | `Journal` | |
| `/coach` | `Coach` | Full-screen (sin padding, `overflow-hidden`) |
| `/perfil-ia` | `Profile` | |
| `/timer` | `Timer` | |
| `/pendientes` | `Todos` | |
| `/login` | `Login` | Público, redirige a `/` si ya hay sesión |
| `/registro` | `Register` | Público |
| `/recuperar` | `ForgotPassword` | |
| `/reset-password` | `ResetPassword` | Lee `?token=` de la URL |

---

## Contextos globales (`src/context/`)

| Contexto | Provee | Nota |
|---|---|---|
| `AuthContext` | `user`, `loading`, `login`, `register`, `logout`, `updateProfile`, `changePassword`, `deleteAccount` | Carga `GET /auth/me` al inicio; fallback a caché localStorage en error de red |
| `HabitsContext` | `habits`, `loading`, `error`, `refresh`, `createHabit`, `updateHabit`, `deleteHabit` | **Un solo `GET /habits`** compartido por toda la app. Montado dentro del auth guard. |
| `ThemeContext` | `theme`, `toggleTheme` | Persiste en localStorage; sincroniza con `document.documentElement.classList` para Tailwind dark mode |

---

## Páginas (`src/pages/`)

### `Dashboard` — `/`
Vista diaria principal. Navega fechas con `DateNavBar`. Filtra `allHabits` por `created_at`/`start_date` antes de mostrarlos.

Hooks: `useHabitsContext()`, `useDayLogs(selectedDate)`, `useStats()`, `useWildcard()`  
Renders: `DateNavBar` → `CurrentFocusCard` → 3× `StatCard` → `WildcardWidget` (solo hoy) → `MonthHeatmap` (solo hoy) → `TodayChecklist`  
Re-fresca en: navegación a `/`, `window focus`, evento `habits-updated`.

### `Habits` — `/habitos`
CRUD de hábitos. Estado local: `formOpen`, `editing`, `toDelete`, `statsHabit`.  
Usa `useHabitsContext()`. Renders: grid de `HabitCard`, `Modal`+`HabitForm`, `ConfirmDialog`, `HabitStatsModal`.

### `Stats` — `/estadisticas`
Dos tabs: "General" (Recharts BarChart + PieChart) y "Por hábito" (drill-down por hábito).  
Hooks: `useStats()`, `useHabitsContext()`, `useWildcard()`.

### `Friends` — `/amigos`
Enviar/aceptar/rechazar solicitudes de amistad + leaderboard.  
Hook: `useFriends()`. Renders: form envío, sección pendientes, sección enviadas, leaderboard, `ConfirmDialog`.

### `Journal` — `/diario`
Diario con resúmenes IA generados en background (FastAPI `BackgroundTasks`).  
Hook: `useJournal()` — auto-refresca a los 5 s para recoger resúmenes.

### `Coach` — `/coach`
Wrapper delgado que renderiza `AIChat` a pantalla completa. No tiene hooks propios.

### `Profile` — `/perfil-ia`
Bio + rutina del usuario con resumen IA. Dos tabs: "perfil" y "rutina".  
Hook: `useProfile()`. Descarga de datos via `GET /profile/export` (blob directo, sin hook).

### `Timer` — `/timer`
Timer pomodoro. Llama la API directamente (sin hook dedicado):  
`GET /timer/sessions`, `GET /timer/stats`, `POST /timer/sessions`, `DELETE /timer/sessions/:id`  
Guarda el estado de ánimo junto con la sesión. Dispara `CustomEvent("habits-updated")` tras guardar.

### `Todos` — `/pendientes`
Lista de tareas rápidas (no relacionadas con hábitos).  
Hook: `useTodos()`. Renders: `AddForm`, `TodoRow`, `EditRow` (edición inline), acordeón de completadas.

---

## Componentes clave (`src/components/`)

| Componente | Qué hace | Usado por |
|---|---|---|
| `AppShell` | Layout completo: sidebar (desktop), topbar, bottom nav + drawer "Más" (mobile). Inicializa `useNotifications` y `useFriends` (badge). Ruta `/coach` → layout fullscreen. | `ProtectedApp` |
| `AccountModal` | Modal de cuenta: cambiar nombre/email/contraseña, borrar cuenta. | `AppShell` |
| `CurrentFocusCard` | Hero card con el hábito activo ahora mismo + botones 3-estado + `DayRail`. Usa `useNow()`. **Ahora incluye `HabitMoodModal`.** | `Dashboard` |
| `TodayChecklist` | Lista de hábitos del día con toggles de estado. Gestiona `HabitMoodModal` internamente. | `Dashboard` |
| `HabitMoodModal` | Modal post-completar: selector de emoji (great/good/neutral/tired/hard) + nota. `onSave({mood, note})` re-escribe el log. | `CurrentFocusCard`, `TodayChecklist` |
| `HabitCard` | Card de un hábito (display + botones editar/borrar/stats). | `Habits` |
| `HabitForm` | Formulario crear/editar hábito. Maneja los 4 tipos de recurrencia. | `Habits` (dentro de `Modal`) |
| `HabitStatsModal` | Modal con mini-stats + heatmap anual de un hábito. | `Habits`, `Stats` |
| `MonthHeatmap` | Heatmap GitHub-style de 365 días (SVG). Recibe `habits` + `todayStatus` para override reactivo del día actual. | `Dashboard` |
| `WildcardWidget` | Widget de comodines (balance, progreso, botón usar). | `Dashboard`, `Stats` |
| `DayRail` | Línea de tiempo horizontal del día (visual, sin interacción). | `CurrentFocusCard` |
| `DateNavBar` | Navegación prev/next/hoy de fechas. Emite ISO date string. | `Dashboard` |
| `AIChat` | Chat completo con la IA. Persiste historial en localStorage. `POST /ai/chat`. | `Coach` |
| `StatCard` | Tarjeta de métrica (label, valor, sublabel, color acento). | `Dashboard`, `Stats` |
| `Modal` | Wrapper modal genérico accesible. | `Habits`, `HabitStatsModal` |
| `ConfirmDialog` | Diálogo de confirmación genérico. | `Habits`, `Friends` |
| `ThemeToggle` | Botón toggle tema. | `AppShell`, `Login`, `Register` |
| `NotificationToggle` | Botón + popover para notificaciones del navegador. | `AppShell` |
| `ErrorBoundary` | React error boundary. | Raíz de la app |

---

## Hooks (`src/hooks/`)

| Hook | API calls | Expone |
|---|---|---|
| `useDayLogs(date)` | `GET /logs?date=`, `GET /logs?date_from=&date_to=` | `logs`, `logsByHabitId`, `weekLogsByHabitId`, `completedHabitIds`, `setHabitStatus(id, status, extra)`. Actualizaciones optimistas en ambas listas (día + semana). `extra` acepta `{mood, note}`. |
| `useHabitStats(id)` | `GET /stats/habit/:id` | `data`, `loading`, `error`, `refresh` |
| `useStats()` | `GET /stats/summary`, `/stats/weekly`, `/stats/by-category` | `summary`, `weekly`, `byCategory` |
| `useYearHeatmap(habits)` | `GET /logs?date_from=&date_to=` (365 días) | `days[]({iso, status})`. Lógica compleja para `weekly_times`. |
| `useCategories()` | `GET /categories`, `POST`, `DELETE /categories/:id` | `categories`, `displayCategories`, `addCategory`, `deleteCategory` |
| `useFriends()` | `GET /friends`, `GET /friends/leaderboard`, más CRUD | `pending`, `accepted`, `sent`, `leaderboard`, acciones CRUD |
| `useJournal()` | `GET /journal`, `PUT /journal/entry`, `DELETE /journal/entry/:date` | `entries`, `summaries`, `saveEntry`, `deleteEntry`, `getEntry` |
| `useProfile()` | `GET /profile`, `PUT /profile`, `POST /profile/summarize`, `PUT/POST /profile/routine*` | `bio`, `bioSummary`, `routine`, `routineSummary`, funciones save/summarize |
| `useTodos()` | `GET /todos`, `POST /todos`, `PATCH /todos/:id`, `DELETE /todos/:id`, `DELETE /todos` | `todos`, `pending`, `done`, `addTodo`, `toggleDone`, `updateTodo`, `deleteTodo`, `clearDone` |
| `useWildcard()` | `GET /wildcards`, `POST /wildcards/check-milestone`, `POST /wildcards/use` | `wildcard`, `gained`, `checkMilestone`, `useWildcardForDate` |
| `useNotifications(habits)` | ❌ ninguno (Web Notifications API + SW) | `permission`, `advanceMinutes`, `requestPermission`, `setAdvanceMinutes` |
| `useNow(ms=30000)` | ❌ ninguno | `Date` actual, se actualiza cada 30 s |
| `useHabits(date)` | `GET /habits`, `GET /logs?date=` | Hook standalone (no usa `HabitsContext`). Disponible pero la mayoría de páginas usa el contexto. |

---

## Librerías utilitarias (`src/lib/`)

### `schedule.js` — lógica de recurrencia y tiempo
- `habitOccursOnDate(habit, isoDate, completedDatesInWeek?)` — función central. 4 tipos: `weekly` (bitmask de días), `interval` (cada N días desde `start_date`), `monthly` (día del mes, `-1` = último día), `weekly_times` (N veces por semana, oculta cuando se alcanza la cuota si se pasa `completedDatesInWeek`).
- `habitOccursOnDateRaw` — igual pero ignora cuota (para heatmaps/stats).
- `getCurrentAndNext(habits, now)` — devuelve `{current, next}` para `CurrentFocusCard`.
- `toLocalISODate(date)` / `todayLocalISODate()` — **siempre usar estas** para fechas locales (compensan el offset de zona horaria).
- `weekDatesOf(isoDate)` — array de 7 fechas ISO (Lun–Dom) de la semana.
- `formatTime(hhmm)` — `"14:30"` → `"2:30 p. m."`.

### `categories.js` — sistema de categorías
- `CATEGORIES` — mapa estático: `{trabajo, estudio, salud, lectura, personal, organizar, otro}`. Cada entrada: `{label, icon (Lucide), token}`. El `token` mapea a variables CSS `--<token>` y `--<token>-soft`.
- `categoryMeta(key)` — devuelve `{label, icon, token}`. Para claves desconocidas/personalizadas, asigna un token determinísticamente (hash del string) entre 5 colores.
- `CATEGORY_OPTIONS` — array `[{value, label}]` para selects de formularios.

---

## Patrones cross-cutting

1. **Store compartido de hábitos:** `HabitsContext` hace un solo `GET /habits`. `Dashboard` solo necesita `useDayLogs` encima. El resto de páginas leen del contexto.

2. **Actualizaciones optimistas:** `useDayLogs.setHabitStatus`, `useTodos.toggleDone/deleteTodo` aplican el cambio en estado local antes de que resuelva la API y revierten en caso de error.

3. **Bus de eventos para sync cross-página:** `Timer` y `Dashboard` usan `window.dispatchEvent(new CustomEvent("habits-updated"))` / `window.addEventListener("habits-updated", ...)` para sincronizar sin prop drilling.

4. **Flujo del modal de ánimo:** Al marcar un hábito como done/skipped/failed → se escribe el log inmediatamente (optimista) → se abre `HabitMoodModal` → `onSave({mood, note})` hace un segundo `setHabitStatus` con `extra` que sobreescribe el log con el ánimo. Este flujo existe en `TodayChecklist` Y en `CurrentFocusCard` (ambos tienen el modal propio).

5. **Fechas timezone-safe:** Todos los timestamps del backend en SQLite vienen sin zona (`"2026-08-20T15:30:00"`); el frontend normaliza añadiendo `"Z"` cuando no hay info de zona. Las fechas locales siempre pasan por `toLocalISODate()`.

6. **Colores del tema:** Se usan variables CSS (`--signal`, `--mint`, `--coral`, `--violet`, `--<token>-soft`). No usar colores hardcoded de Tailwind para elementos temáticos — usar `style={{ color: 'var(--token)' }}` o las clases utilitarias definidas en `index.css`.
