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


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


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
    # recurrence_type: "weekly" | "interval" | "monthly"
    recurrence_type = Column(String(10), nullable=False, default="weekly")
    # interval: repeat every N days (used when recurrence_type="interval")
    recurrence_interval = Column(Integer, nullable=True, default=None)
    # day_of_month: 1-28 or -1 for last day (used when recurrence_type="monthly")
    recurrence_day_of_month = Column(Integer, nullable=True, default=None)
    # duration in minutes for habits without a fixed time (e.g. "study 30 min any time")
    duration_minutes = Column(Integer, nullable=True, default=None)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="habits")
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")
    timer_sessions = relationship("TimerSession", back_populates="habit", cascade="all, delete-orphan")


class HabitLog(Base):
    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_habit_date"),)

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    date = Column(Date, nullable=False, default=date.today, index=True)
    # "done" = lo hice | "skipped" = no pude (omitido) | "failed" = no quise (fallido)
    status = Column(String(10), nullable=False, default="done")
    logged_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    habit = relationship("Habit", back_populates="logs")


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


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_category_user_name"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])


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


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    # Texto libre escrito por el usuario (bio, objetivos, intereses, valores)
    bio = Column(String(5000), nullable=False, default="")
    # Versión comprimida generada por IA — solo lo útil para contexto
    bio_summary = Column(String(1000), nullable=True, default=None)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])


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
