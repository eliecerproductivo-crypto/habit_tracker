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
    start_time = Column(String(5), nullable=False, default="08:00")
    end_time = Column(String(5), nullable=False, default="09:00")

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="habits")
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")


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
