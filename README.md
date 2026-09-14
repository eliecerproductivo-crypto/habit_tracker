# Rutina — seguimiento de hábitos

App de seguimiento de hábitos con horarios: te dice qué deberías estar
haciendo *ahora mismo* según tu plan del día, llevas el check diario, editas
tus hábitos y ves tus estadísticas (racha, cumplimiento semanal, por
categoría).

- **Frontend:** Vite + React + Tailwind CSS v4, con modo claro/oscuro.
- **Backend:** Python + FastAPI, JWT para login, contraseñas con bcrypt.
- **Base de datos:** PostgreSQL (pensado para Supabase; también corre con
  SQLite en local sin configurar nada).
- **Despliegue objetivo:** Vercel (frontend estático + funciones serverless
  de Python) + Supabase (Postgres).

```
rutina-app/
├── frontend/          # App de React (Vite)
├── app/               # Backend FastAPI (paquete Python compartido)
│   ├── main.py        # Crea la app, monta routers y CORS
│   ├── database.py    # Conexión a Postgres/SQLite
│   ├── models.py       # Tablas: User, Habit, HabitLog
│   ├── schemas.py      # Validación de entrada/salida (Pydantic)
│   ├── auth.py         # Hash de contraseñas + JWT
│   └── routers/        # auth, habits, logs, stats
├── api/
│   └── index.py        # Punto de entrada para Vercel (importa app.main:app)
├── requirements.txt
├── vercel.json
└── .env.example
```

## 1. Desarrollo local

### Backend

```bash
cd rutina-app
python3 -m venv venv
source venv/bin/activate        # en Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edita .env: para empezar rápido, deja DATABASE_URL comentado (usa SQLite).

uvicorn app.main:app --reload   # http://localhost:8000
```

La primera vez que arranca, crea las tablas automáticamente (`init_db()` en
`database.py`). Puedes explorar y probar la API en
`http://localhost:8000/docs` (Swagger, generado por FastAPI).

### Frontend

En otra terminal:

```bash
cd rutina-app/frontend
npm install
npm run dev                     # http://localhost:5173
```

`vite.config.js` ya trae un proxy de `/api` → `http://localhost:8000`, así
que el frontend habla con tu backend local sin configuración extra.

## 2. Desplegar en Vercel + Supabase

### Paso 1 — Crear la base de datos en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **Project Settings → Database → Connection string** y copia la
   cadena del modo **"Connection pooling"** (puerto `6543`, no la de `5432`).
   Las funciones serverless abren y cierran conexiones todo el tiempo, y el
   pooler (pgbouncer) de Supabase es lo que evita que se agoten las
   conexiones directas a Postgres.
3. Guarda esa URL — la vas a necesitar en el paso 3.

### Paso 2 — Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Rutina app"
git remote add origin <tu-repo>
git push -u origin main
```

### Paso 3 — Importar el proyecto en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el
   repo.
2. El `vercel.json` incluido ya le dice a Vercel cómo construir el frontend
   (`frontend/dist`) y cómo servir el backend (`api/index.py` como función
   Python). No deberías tener que tocar la configuración de build.
3. En **Environment Variables**, agrega:
   - `DATABASE_URL` → la cadena de Supabase del paso 1
   - `SECRET_KEY` → genera una con `python -c "import secrets; print(secrets.token_hex(32))"`
   - `ALLOWED_ORIGINS` → el dominio que Vercel te asigne, por ejemplo
     `https://rutina-app.vercel.app` (puedes desplegar una vez primero para
     saber el dominio, y luego actualizar esta variable y redesplegar)
   - `ACCESS_TOKEN_EXPIRE_MINUTES` → opcional, por defecto 14 días
4. Deploy.

> **Nota sobre el runtime de Python en Vercel:** este proyecto usa el patrón
> estándar de exportar un objeto `app` de FastAPI desde `api/index.py`, que
> es lo que el runtime de Python de Vercel espera para servir aplicaciones
> ASGI. Si algo cambia en cómo Vercel maneja Python para cuando despliegues
> (las plataformas actualizan esto de vez en cuando), revisa su
> documentación oficial de Python — la estructura del proyecto (paquete
> `app/` + `api/index.py` delgado) no debería necesitar cambios grandes.

## 3. Cómo funciona "qué debo hacer ahora"

Cada hábito tiene `days_of_week` (días en que aplica), `start_time` y
`end_time`. El frontend calcula en el navegador, con la hora local del
usuario, cuál hábito está activo en este momento (`src/lib/schedule.js`) y lo
muestra en la tarjeta superior del panel, junto con una línea de tiempo de
24 horas con un marcador en vivo. Esto se recalcula solo, sin recargar la
página.

## 4. Modelo de datos

- **User** — cuenta (nombre, correo, contraseña con hash).
- **Habit** — nombre, descripción, categoría, días de la semana, hora de
  inicio/fin, activo o no.
- **HabitLog** — un registro por hábito y fecha (`completed: true/false`),
  con restricción única `(habit_id, date)` para que marcar dos veces el
  mismo día actualice el mismo registro en vez de duplicarlo.

## 5. Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Crear cuenta |
| POST | `/auth/login` | Login (form-urlencoded, devuelve JWT) |
| GET | `/auth/me` | Usuario actual |
| GET/POST | `/habits` | Listar / crear hábitos |
| PUT/DELETE | `/habits/{id}` | Editar / eliminar hábito |
| GET/POST | `/logs` | Ver / marcar cumplimiento por fecha |
| GET | `/stats/summary` | Racha actual, mejor racha, % semanal |
| GET | `/stats/weekly` | Serie de los últimos 7 días |
| GET | `/stats/by-category` | Cumplimiento agrupado por categoría |

Todas las rutas salvo `/auth/register` y `/auth/login` requieren el header
`Authorization: Bearer <token>`.
