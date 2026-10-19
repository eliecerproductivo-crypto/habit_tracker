from datetime import datetime, date, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    habits = relationship("Habit", back_populates="owner", cascade="all, delete-orphan")
    sent_requests = relationship("Friendship", foreign_keys="Friendship.requester_id", back_populates="requester", cascade="all, delete-orphan")
    received_requests = relationship("Friendship", foreign_keys="Friendship.addressee_id", back_populates="addressee", cascade="all, delete-orphan")
    timer_sessions = relationship("TimerSession", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} email={self.email!r}>"


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")

    def __repr__(self):
        return f"<PasswordResetToken id={self.id} user_id={self.user_id} used={self.used}>"


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True, default="")
    category = Column(String(50), nullable=False, default="otro")

    # Comma-separated weekdays, JS Date#getDay() convention: 0=domingo ... 6=sábado
    days_of_week = Column(String(20), nullable=False, default="0,1,2,3,4,5,6")

    # Stored as "HH:MM" 24h strings for simplicity across DB backends
    start_time = Column(String(5), nullable=True, default=None)
    end_time = Column(String(5), nullable=True, default=None)

    is_active = Column(Boolean, default=True, nullable=False)
    start_date = Column(Date, nullable=True, default=None)
    # recurrence_type: "weekly" | "interval" | "monthly" | "weekly_times"
    recurrence_type = Column(String(14), nullable=False, default="weekly")
    # interval: repeat every N days (used when recurrence_type="interval")
    recurrence_interval = Column(Integer, nullable=True, default=None)
    # day_of_month: 1-28 or -1 for last day (used when recurrence_type="monthly")
    recurrence_day_of_month = Column(Integer, nullable=True, default=None)
    # times_per_week: how many times per week the habit must be done (used when recurrence_type="weekly_times")
    recurrence_times_per_week = Column(Integer, nullable=True, default=None)
    # duration in minutes for habits without a fixed time (e.g. "study 30 min any time")
    duration_minutes = Column(Integer, nullable=True, default=None)
    # priority: 1=Baja, 2=Intermedia, 3=Alta (None = Sin prioridad)
    priority = Column(Integer, nullable=True, default=None)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="habits")
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")
    timer_sessions = relationship("TimerSession", back_populates="habit", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Habit id={self.id} name={self.name!r} user_id={self.user_id}>"

    @property
    def has_logs(self) -> bool:
        if "_has_logs" in self.__dict__:
            return self.__dict__["_has_logs"]
        return bool(self.logs)

    @has_logs.setter
    def has_logs(self, value: bool):
        self.__dict__["_has_logs"] = bool(value)


class HabitLog(Base):
    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_habit_date"),)

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    date = Column(Date, nullable=False, default=date.today, index=True)
    # "done" = lo hice | "skipped" = no pude (omitido) | "failed" = no quise (fallido)
    status = Column(String(10), nullable=False, default="done")
    mood = Column(String(20), nullable=True, default=None)  # "great", "good", "neutral", "tired", "hard"
    note = Column(String(500), nullable=True, default="")
    logged_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    habit = relationship("Habit", back_populates="logs")

    def __repr__(self):
        return f"<HabitLog id={self.id} habit_id={self.habit_id} date={self.date} status={self.status!r}>"


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    addressee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # "pending" | "accepted" | "rejected"
    status = Column(String(10), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    requester = relationship("User", foreign_keys=[requester_id], back_populates="sent_requests")
    addressee = relationship("User", foreign_keys=[addressee_id], back_populates="received_requests")

    def __repr__(self):
        return f"<Friendship id={self.id} requester={self.requester_id} addressee={self.addressee_id} status={self.status!r}>"


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_category_user_name"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<Category id={self.id} name={self.name!r} user_id={self.user_id}>"


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(String(2000), nullable=False)
    entry_date = Column(Date, nullable=False, default=date.today, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<JournalEntry id={self.id} user_id={self.user_id} date={self.entry_date}>"


class JournalSummary(Base):
    __tablename__ = "journal_summaries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    summary = Column(String(4000), nullable=False)
    # Rango de fechas que cubre este resumen
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<JournalSummary id={self.id} user_id={self.user_id} {self.date_from}–{self.date_to}>"


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    # Texto libre escrito por el usuario (bio, objetivos, intereses, valores)
    bio = Column(String(5000), nullable=False, default="")
    # Versión comprimida generada por IA — solo lo útil para contexto
    bio_summary = Column(String(1000), nullable=True, default=None)
    # Descripción de la rutina diaria del usuario (horarios, estructura del día)
    routine = Column(String(5000), nullable=False, default="")
    # Versión comprimida de la rutina generada por IA
    routine_summary = Column(String(1000), nullable=True, default=None)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<UserProfile id={self.id} user_id={self.user_id}>"


class HabitWildcardUse(Base):
    """
    Registro de cada uso de comodín de hábito (descanso individual).
    Una fila por (usuario, hábito, fecha). Si el hábito se elimina,
    habit_id queda en NULL para preservar el conteo de cuota de la quincena (CL-03).
    """
    __tablename__ = "habit_wildcard_uses"
    __table_args__ = (UniqueConstraint("user_id", "habit_id", "date", name="uq_hwc_user_habit_date"),)

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # SET NULL cuando se elimina el hábito — el uso sigue contando en la cuota
    habit_id   = Column(Integer, ForeignKey("habits.id", ondelete="SET NULL"), nullable=True, index=True)
    date       = Column(Date, nullable=False)
    # Clave de quincena: "2026-10A" (días 1–15) o "2026-10B" (días 16–31)
    quincena   = Column(String(8), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<HabitWildcardUse id={self.id} user_id={self.user_id} habit_id={self.habit_id} date={self.date}>"


class WildcardBalance(Base):
    """
    Saldo de comodines del usuario.
    Un comodín protege la racha cuando el usuario no puede completar todos
    sus hábitos un día determinado.

    Reglas de negocio:
      - Se gana 1 comodín cada 15 días de racha (hitos: 15, 30, 45, …).
      - Tope máximo de 2 comodines en cualquier momento.
      - No se pueden usar dos comodines en días consecutivos.
      - last_milestone: el último múltiplo de 15 por el que ya se otorgó comodín,
        para no otorgar el mismo hito dos veces.
      - last_used_date: fecha en la que se usó el último comodín (control anti-consecutivo).
    """
    __tablename__ = "wildcard_balance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    balance = Column(Integer, nullable=False, default=0)          # 0–2
    last_milestone = Column(Integer, nullable=False, default=0)   # último múltiplo de 15 otorgado
    last_used_date = Column(Date, nullable=True, default=None)     # para regla anti-consecutivo
    updated_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<WildcardBalance id={self.id} user_id={self.user_id} balance={self.balance}>"


class UserInsights(Base):
    """
    Conocimiento acumulado del usuario extraído de conversaciones con el coach.
    Se guarda como JSON con listas de strings por categoría.
    Ejemplo:
    {
      "desires": ["quiere comprar un monitor ultrawide"],
      "goals": ["correr una maratón en 2025"],
      "worries": ["siente que no duerme bien"],
      "facts": ["trabaja desde casa", "tiene 2 hijos"],
      "preferences": ["aprende mejor leyendo", "le cuesta madrugar"]
    }
    """
    __tablename__ = "user_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    insights_json = Column(String(8000), nullable=False, default="{}")
    updated_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<UserInsights id={self.id} user_id={self.user_id}>"


class TodoItem(Base):
    """
    Tarea simple de lista de pendientes (to-do).
    No está vinculada a hábitos — sirve para recordatorios generales.
    """
    __tablename__ = "todo_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    text = Column(String(500), nullable=False)
    done = Column(Boolean, nullable=False, default=False)
    # Fecha límite opcional (solo la fecha, sin hora)
    due_date = Column(Date, nullable=True, default=None)
    # Prioridad: 1=Baja, 2=Media, 3=Alta (None = sin prioridad)
    priority = Column(Integer, nullable=True, default=None)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<TodoItem id={self.id} user_id={self.user_id} done={self.done} text={self.text[:30]!r}>"


class TimerSession(Base):
    __tablename__ = "timer_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id", ondelete="CASCADE"), nullable=True, index=True)

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    session_type = Column(String(30), nullable=False, default="pomodoro")
    notes = Column(String(500), nullable=True, default="")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="timer_sessions")
    habit = relationship("Habit", back_populates="timer_sessions")

    def __repr__(self):
        return f"<TimerSession id={self.id} user_id={self.user_id} habit_id={self.habit_id} duration={self.duration_seconds}s>"
