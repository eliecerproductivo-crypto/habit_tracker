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
    start_time: str = Field(pattern=TIME_RE)
    end_time: str = Field(pattern=TIME_RE)
    is_active: bool = True

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

    class Config:
        from_attributes = True


# ---------- Logs ----------

class LogCreate(BaseModel):
    habit_id: int
    date: date
    completed: bool = True


class LogOut(BaseModel):
    id: int
    habit_id: int
    date: date
    completed: bool
    completed_at: datetime

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
