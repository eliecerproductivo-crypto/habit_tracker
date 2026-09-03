from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Auth / Users ----------

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Habits ----------

TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"


class HabitBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = ""
    category: str = Field(default="otro", max_length=50)
    days_of_week: str = Field(
        default="0,1,2,3,4,5,6",
        description="Comma-separated weekdays, 0=domingo ... 6=sábado",
    )
    start_time: Optional[str] = Field(default=None, pattern=TIME_RE)
    end_time: Optional[str] = Field(default=None, pattern=TIME_RE)
    is_active: bool = True
    start_date: Optional[date] = None
    recurrence_type: str = Field(default="weekly", pattern="^(weekly|interval|monthly)$")
    recurrence_interval: Optional[int] = Field(default=None, ge=1, le=365)
    recurrence_day_of_month: Optional[int] = Field(default=None, ge=-1, le=31)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=480)

    @field_validator("days_of_week")
    @classmethod
    def validate_days(cls, v: str) -> str:
        parts = [p.strip() for p in v.split(",") if p.strip() != ""]
        if not parts:
            raise ValueError("days_of_week must include at least one day")
        for p in parts:
            if not p.isdigit() or not (0 <= int(p) <= 6):
                raise ValueError("days_of_week entries must be integers 0-6")
        return ",".join(parts)


class HabitCreate(HabitBase):
    pass


class HabitUpdate(HabitBase):
    pass


class HabitOut(HabitBase):
    id: int
    user_id: int
    created_at: datetime
    start_date: Optional[date] = None
    recurrence_type: str = "weekly"
    recurrence_interval: Optional[int] = None
    recurrence_day_of_month: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- Logs ----------

LOG_STATUSES = {"done", "skipped", "failed"}


class LogCreate(BaseModel):
    habit_id: int
    date: date
    status: str = "done"

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in LOG_STATUSES:
            raise ValueError("status must be one of: done, skipped, failed")
        return v


class LogOut(BaseModel):
    id: int
    habit_id: int
    date: date
    status: str
    logged_at: datetime

    class Config:
        from_attributes = True


# ---------- Stats ----------

class StatsSummary(BaseModel):
    current_streak: int
    best_streak: int
    week_completion_rate: int
    total_completed: int


class WeeklyStat(BaseModel):
    date: date
    label: str
    completed_count: int
    total_count: int


class CategoryStat(BaseModel):
    category: str
    completed_count: int

class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr

class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=200)


# ---------- Friends ----------

class FriendRequest(BaseModel):
    email: EmailStr

class FriendOut(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True

class FriendshipOut(BaseModel):
    id: int
    status: str
    friend: FriendOut
    i_am_requester: bool

    class Config:
        from_attributes = True

class FriendStatsOut(BaseModel):
    friend: FriendOut
    current_streak: int
    week_completion_rate: int
    total_completed: int


# ---------- Timer ----------

class TimerHabitInfo(BaseModel):
    id: int
    name: str
    category: str

    class Config:
        from_attributes = True


class TimerSessionCreate(BaseModel):
    habit_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    duration_seconds: int = Field(ge=1)
    session_type: str = Field(default="pomodoro", max_length=30)
    notes: Optional[str] = Field(default="", max_length=500)
    auto_mark_done: bool = False
    log_date: Optional[date] = None


class TimerSessionOut(BaseModel):
    id: int
    user_id: int
    habit_id: Optional[int] = None
    habit: Optional[TimerHabitInfo] = None
    start_time: datetime
    end_time: datetime
    duration_seconds: int
    session_type: str
    notes: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True


class HabitTimeStat(BaseModel):
    habit_id: Optional[int] = None
    habit_name: str
    category: str
    total_seconds: int
    session_count: int


class TimerStatsOut(BaseModel):
    today_seconds: int
    week_seconds: int
    total_seconds: int
    today_sessions_count: int
    habits_breakdown: list[HabitTimeStat]

