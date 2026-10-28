# Mapa del Backend — rutina (habit tracker)

## Stack
FastAPI · SQLAlchemy (SQLite dev / PostgreSQL prod via psycopg v3) · Pydantic v2 · bcrypt · python-jose · Google Gemini API (via urllib, sin SDK) · SMTP email

---

## `app/main.py` — Entrada de la aplicación

**Orden de arranque:**
1. `dotenv.load_dotenv()` al importar el módulo.
2. `CORSMiddleware` — orígenes desde `ALLOWED_ORIGINS` (default `"*"`). Cuando no es `"*"`, `allow_credentials=True`.
3. `@app.on_event("startup")` → `init_db()`.
4. Middleware HTTP `ensure_db` — seguro para Vercel cold starts: ejecuta `init_db()` exactamente una vez en el primer request real (flag `_db_initialized`).
5. `GET /health` → `{"status": "ok"}` sin auth.

**Routers registrados (en orden):**
```
auth → habits → logs → stats → friends → categories → journal → profile → timer → wildcards → todos
```
Cada router define su propio prefix. No hay prefix en `include_router`.

---

## `app/database.py` — Motor y sesión

**Configuración:**
- `DATABASE_URL` desde env, default `sqlite:///./habit_tracker.db`.
- Normalización de URL: `postgresql://` / `postgres://` → `postgresql+psycopg://` (psycopg v3). Parámetro `pgbouncer=true` eliminado (incompatible con prepared statements de psycopg3).
- SQLite: `check_same_thread=False`, pool por defecto.
- PostgreSQL (Supabase): `NullPool` (sin conexiones persistentes entre invocaciones serverless) + `prepare_threshold=None` (deshabilita prepared statements para PgBouncer transaction mode).
- `pool_pre_ping=True` siempre.

**Sesión:** `get_db()` — generador, cierra en `finally`.

**`init_db()`:**
1. Importa todos los modelos para registrarlos en `Base.metadata`.
2. `Base.metadata.create_all()` — crea tablas faltantes.
3. Corre `_migrate(conn)` — migrador incremental con `inspect()`. Maneja: renombrado de columnas (`completed` → `status`, `completed_at` → `logged_at`), añadir `mood`/`note` a logs, `start_time`/`end_time` nullable en habits, todas las columnas de recurrencia, columnas de wildcards, columnas `routine*` en perfiles, constraint unique de categorías.

---

## `app/auth.py` — JWT y dependencia de auth

- `SECRET_KEY` desde env (warning si no está; dev fallback inseguro).
- `ALGORITHM = "HS256"`. Token expira en 14 días (configurable con `ACCESS_TOKEN_EXPIRE_MINUTES`).
- `hash_password` / `verify_password` → bcrypt.
- `create_access_token(data)` → JWT con `{"sub": str(user_id), "exp": ...}`.
- `get_current_user(token, db)` → **dependencia FastAPI** usada por todos los endpoints protegidos. Decodifica JWT con jose, busca `User` por `sub`. Lanza 401 ante cualquier fallo.
- `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")` — extrae Bearer del header.

---

## Modelos SQLAlchemy (`app/models.py`)

| Tabla | Modelo | Puntos clave |
|---|---|---|
| `users` | `User` | email unique; cascade delete a habits y timer_sessions |
| `password_reset_tokens` | `PasswordResetToken` | token(64, unique), expires_at, used(bool) |
| `habits` | `Habit` | days_of_week (string CSV, 0=Dom…6=Sáb); start/end_time como string "HH:MM"; 4 tipos de recurrencia; `has_logs` es `@property` inyectado por el router para evitar N+1 |
| `habit_logs` | `HabitLog` | Unique constraint `(habit_id, date)`; status: `"done"\|"skipped"\|"failed"`; mood: `"great"\|"good"\|"neutral"\|"tired"\|"hard"` |
| `friendships` | `Friendship` | status: `"pending"\|"accepted"\|"rejected"` |
| `categories` | `Category` | Unique `(user_id, name)` |
| `journal_entries` | `JournalEntry` | content max 2000 chars |
| `journal_summaries` | `JournalSummary` | Cubre rango `date_from`–`date_to` |
| `user_profiles` | `UserProfile` | Unique por user; bio(5000), bio_summary(1000), routine(5000), routine_summary(1000) |
| `wildcard_balance` | `WildcardBalance` | Unique por user; balance 0–2, last_milestone, last_used_date |
| `user_insights` | `UserInsights` | Unique por user; `insights_json` — JSON string con claves: desires, goals, worries, facts, preferences |
| `todo_items` | `TodoItem` | text(500), done(bool), due_date?, priority(1–3)? |
| `timer_sessions` | `TimerSession` | habit_id nullable (CASCADE), duration_seconds, session_type |

---

## Schemas Pydantic (`app/schemas.py`)

| Dominio | Schemas |
|---|---|
| Auth | `UserCreate`, `UserOut`, `Token`, `UserUpdate`, `PasswordChange` |
| Habits | `HabitBase` / `HabitCreate` / `HabitUpdate` / `HabitOut` — valida `days_of_week` (CSV de ints 0–6), `recurrence_type` enum, `start_time`/`end_time` con regex `^([01]\d|2[0-3]):[0-5]\d$` |
| Logs | `LogCreate` (valida status contra `{"done","skipped","failed"}`), `LogOut` |
| Stats | `StatsSummary`, `HabitStatsOut` (incluye todos los campos de recurrencia para el heatmap del frontend), `WeeklyStat`, `CategoryStat` |
| Friends | `FriendRequest`, `FriendOut`, `FriendshipOut` (con `i_am_requester`), `FriendStatsOut` |
| Timer | `TimerSessionCreate` (habit_id?, auto_mark_done, log_date?, mood?), `TimerSessionOut`, `TimerStatsOut` |
| Wildcards | `WildcardStatus` (balance, next_milestone, can_use_today, at_cap), `WildcardUseRequest` |
| Todos | `TodoCreate`, `TodoUpdate` (todos opcionales), `TodoOut` |

---

## Routers — Endpoints por dominio

### `/auth`
| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/auth/register` | Crea usuario + `seed_default_categories` (5 categorías por defecto) |
| POST | `/auth/login` | OAuth2PasswordRequestForm → JWT |
| GET | `/auth/me` | Usuario actual |
| PUT | `/auth/me` | Actualiza nombre/email |
| PUT | `/auth/me/password` | Cambia contraseña (verifica la actual primero) |
| DELETE | `/auth/me` | Borra cuenta (cascade) |
| POST | `/auth/forgot-password` | Genera token reset (1h), `BackgroundTask` → `send_reset_email`. Siempre 204 (sin enumeración de emails) |
| POST | `/auth/reset-password` | Valida token, guarda nueva contraseña, marca token como usado |
| POST | `/auth/seed-categories` | Backfill idempotente para usuarios sin categorías |

### `/habits`
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/habits` | Lista hábitos del usuario, ordenados por `start_time nulls last`. Evita N+1 para `has_logs` con una sola query `DISTINCT` |
| POST | `/habits` | Crea hábito. Si `start_date` es None → default a hoy (evita backdating) |
| PUT | `/habits/{id}` | Actualiza. **Lógica clave:** si cambian campos de schedule Y hay logs existentes → auto-asigna `start_date` = hoy (o lunes próximo para weekly_times) para que la nueva regla solo aplique hacia adelante |
| DELETE | `/habits/{id}` | Elimina hábito + logs (cascade) |

### `/logs`
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/logs` | Filtrado por `?date=`, `?date_from=`, `?date_to=` |
| POST | `/logs` | **Upsert** — si existe log (habit_id, date) lo actualiza; si no, crea. Bloquea fechas > 1 día en el futuro (permite +1 para zonas UTC+) |
| DELETE | `/logs/{id}` | Elimina log |

### `/stats`
Función core: `compute_user_stats(db, user)` — compartida con `/friends/leaderboard` y `/wildcards`.

**Lógica de recurrencia en stats:** `_habit_occurs_on_date` espeja `habitOccursOnDate` del frontend. `weekly_times` se evalúa por semana (cuota), no por día. `_day_status` devuelve `True/False/None`. La racha recorre hasta 365 días hacia atrás.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/stats/summary` | `StatsSummary` (racha, mejor racha, tasa semanal, total completados) |
| GET | `/stats/weekly` | Últimos 7 días: completed_count, total_count |
| GET | `/stats/by-category` | Logs "done" agrupados por categoría de hábito |
| GET | `/stats/habit/{id}` | Stats completas de un hábito: rachas, totales, todos los logs |

### `/friends`
| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/friends/request` | Envía solicitud por email (verifica: no a sí mismo, existe, no hay amistad previa) |
| GET | `/friends` | Lista todas las amistades con flag `i_am_requester` |
| PUT | `/friends/{id}/accept` | Solo el addressee puede aceptar |
| PUT | `/friends/{id}/reject` | Solo el addressee puede rechazar |
| DELETE | `/friends/{id}` | Cualquiera de los dos puede eliminar |
| GET | `/friends/leaderboard` | Llama `compute_user_stats` para self + amigos aceptados; ordena por racha DESC, tasa semanal DESC |

### `/categories`
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/categories` | Categorías del usuario, ordenadas por nombre |
| POST | `/categories` | Crea; idempotente — retorna existente si el nombre ya existe (ilike) |
| DELETE | `/categories/{id}` | Elimina (no afecta hábitos que la usen) |

### `/journal`
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/journal` | Entradas + resúmenes. Dispara `_summarize_all_pending_bg` (BackgroundTask) |
| PUT | `/journal/entry` | Upsert de entrada. Dispara `_summarize_pending_bg` (BackgroundTask) |
| DELETE | `/journal/entry/{date}` | Elimina entrada + su resumen del mismo día |
| POST | `/journal/chat` | Chat IA con contexto completo (bio, rutina, insights, hábitos, notas, logs con mood, sesiones de timer, stats). Stateless — historial viene del frontend |

**Nota:** Las tareas de summarización en background abren su propio `SessionLocal`. No bloquean el response.

### `/profile`
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/profile` | Retorna perfil (vacío si no existe) |
| PUT | `/profile` | Guarda bio (sin llamar a la IA) |
| POST | `/profile/summarize` | Llama `ai.summarize_bio()`, guarda en `bio_summary` |
| PUT | `/profile/routine` | Guarda rutina, invalida `routine_summary` (→ None) |
| POST | `/profile/routine/summarize` | Llama `ai.summarize_routine()`, guarda en `routine_summary` |
| GET | `/profile/insights` | Retorna insights del usuario (JSON de 5 categorías) |
| POST | `/profile/insights` | Llama `ai.extract_insights(conversation, existing)`, merge inteligente, guarda |
| DELETE | `/profile/insights` | Limpia todos los insights |
| GET | `/profile/export` | Devuelve ZIP con 7 CSVs (UTF-8-BOM para Excel): hábitos, historial, sesiones timer, diario, resúmenes, categorías, perfil |

### `/timer`
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/timer/sessions` | Lista sesiones (joinedload de habit). `?habit_id=`, `?limit=` (1–200, default 50). Order: start_time DESC |
| POST | `/timer/sessions` | Crea sesión. Si `auto_mark_done=True`: hace upsert de `HabitLog` con status "done" para `log_date` (o fecha de start_time), propagando `mood` y `notes` |
| GET | `/timer/stats` | today_seconds (usa `?client_date=` para TZ), week_seconds (7 días desde ahora UTC), total_seconds, habits_breakdown |
| DELETE | `/timer/sessions/{id}` | Elimina sesión |

### `/wildcards`
**Reglas de negocio:**
- Se gana 1 comodín en cada múltiplo de 15 días de racha (hitos: 15, 30, 45…). Tope: balance ≤ 2.
- No se pueden usar dos comodines en días consecutivos (`last_used_date`).
- `last_milestone` evita otorgar el mismo hito dos veces.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/wildcards` | Estado actual. Primera llamada: sincroniza `last_milestone` con la racha actual para evitar grants retroactivos |
| POST | `/wildcards/check-milestone` | Llamado tras registrar un log. Si racha ≥ next_milestone → otorga +1 (si balance < 2) |
| POST | `/wildcards/use` | Usa 1 comodín para una fecha. Validaciones: fecha ≤ hoy, ≥ 7 días atrás, balance > 0, no usado ayer. Marca todos los hábitos pendientes/fallidos de esa fecha como "skipped" |

### `/todos`
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/todos` | Todas las tareas. Orden: pendientes primero (done ASC), luego created_at DESC |
| POST | `/todos` | Crea tarea (text, due_date?, priority?) |
| PATCH | `/todos/{id}` | Actualización parcial (cualquier campo opcional) |
| DELETE | `/todos/{id}` | Elimina una tarea |
| DELETE | `/todos` | Elimina todas las tareas completadas (done=True) |

---

## `app/ai.py` — Servicio de IA (Google Gemini)

**Provider:** Google Gemini via HTTP puro (`urllib.request`). Sin SDK. Convierte mensajes OpenAI-style (`role/content`) a formato Gemini (`parts`, rol `"model"` en vez de `"assistant"`).

**Keys:** Lee `GEMINI_API_KEY`, `OPENAI_API_KEY`, y variantes numeradas (`_2`, `_3`, etc.). Deduplica.

**Modelos:** `["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]`

**Fallback (`_call_with_fallback`):**
- Deadline global: 7 segundos.
- Loop: modelos × keys × 2 reintentos.
- 401/403/`API_KEY_INVALID` → skip key; 503/429/404/timeout → skip modelo.
- Retorna `None` si todo falla.

**Funciones públicas:**

| Función | Llamada desde | Qué hace |
|---|---|---|
| `summarize_bio(text)` | `POST /profile/summarize` | Comprime bio en perfil de contexto en tercera persona |
| `summarize_routine(text)` | `POST /profile/routine/summarize` | Comprime rutina a ~150 palabras |
| `summarize_entries(text)` | Journal background tasks | Resume una entrada: estado emocional, acciones, patrones |
| `extract_insights(conversation, existing)` | `POST /profile/insights` | Analiza conversación del coach, merge inteligente en 5 categorías. Limpia markdown que Gemini pueda agregar. Retorna `None` en fallo |
| `chat_with_context(...)` | `POST /journal/chat` | Chat con prompt de sistema rico: bio, rutina, insights, hábitos, timer, stats, notas de diario, logs con mood |

---

## `app/mailer.py` — Email

Única función: `send_reset_email(to_email, user_name, token)`.

Env vars: `SMTP_HOST` (default: smtp.gmail.com), `SMTP_PORT` (default: 587), `SMTP_USER`, `SMTP_PASSWORD`, `APP_URL`, `FROM_EMAIL`.

Sin `SMTP_USER`/`SMTP_PASSWORD` (dev local) → imprime el link en stdout, sin enviar. En prod: STARTTLS, autenticación, email HTML + texto plano. URL del reset: `{APP_URL}/reset-password?token={token}`, válida 1 hora.

---

## `api/index.py` — Vercel Serverless

Importa `app` de `app.main`. Añade middleware `StripApiPrefix`: Vercel envía `/api/habits` pero FastAPI espera `/habits` — el middleware elimina el prefijo `/api` de `scope["path"]` y `scope["raw_path"]`.

---

## Patrones cross-cutting

1. **Auth en todos los endpoints protegidos:** `Depends(get_current_user)`. Todas las queries filtran por `current_user.id`.

2. **`compute_user_stats` compartido:** Definido en `stats.py`, importado directamente por `friends.py` (leaderboard) y `wildcards.py` (check-milestone). Fuente única de verdad para rachas y tasas.

3. **Duplicación de lógica de recurrencia:** `_habit_occurs_on_date` en `stats.py` espeja `habitOccursOnDate` en el frontend (`schedule.js`). **Mantenerlos sincronizados** al cambiar reglas de recurrencia.

4. **Timer como punto de entrada a logs:** `POST /timer/sessions` con `auto_mark_done=True` escribe en `habit_logs` directamente (upsert), igual que `POST /logs`. El `mood` del timer se propaga al log.

5. **BackgroundTasks para IA en el diario:** Las llamadas a Gemini para resumir entradas se hacen en background (no bloquean el response). Abren su propio `SessionLocal`. La IA en el chat (`/journal/chat`) es síncrona (bloquea hasta respuesta).

6. **Variables de entorno clave:**
   - `DATABASE_URL` — SQLite (dev) o PostgreSQL+psycopg (prod)
   - `SECRET_KEY` — JWT signing key
   - `ALLOWED_ORIGINS` — CORS origins separados por coma
   - `GEMINI_API_KEY` / `OPENAI_API_KEY` — y variantes numeradas
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `APP_URL`
   - `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 20160 = 14 días)
