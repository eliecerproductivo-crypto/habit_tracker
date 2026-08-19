from collections import defaultdict
from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/stats", tags=["stats"])

WEEKDAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
MAX_LOOKBACK_DAYS = 365


def _parse_days(days_of_week: str) -> set[int]:
    return {int(d) for d in days_of_week.split(",") if d.strip() != ""}


def _load_context(db: Session, user: models.User):
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.user_id == user.id, models.Habit.is_active.is_(True))
        .all()
    )
    logs = db.query(models.HabitLog).filter(models.HabitLog.user_id == user.id).all()

    completed_by_date: dict[date_type, set[int]] = defaultdict(set)
    for log in logs:
        if log.completed:
            completed_by_date[log.date].add(log.habit_id)

    habits_by_weekday: dict[int, list[models.Habit]] = defaultdict(list)
    for habit in habits:
        for wd in _parse_days(habit.days_of_week):
            habits_by_weekday[wd].append(habit)

    return habits, logs, completed_by_date, habits_by_weekday


def _day_status(d: date_type, habits_by_weekday, completed_by_date) -> bool | None:
    """True = all scheduled habits done, False = some missed, None = nothing scheduled."""
    weekday = d.isoweekday() % 7  # 0=domingo ... 6=sábado (matches JS Date#getDay())
    scheduled = habits_by_weekday.get(weekday, [])
    if not scheduled:
        return None
    done_ids = completed_by_date.get(d, set())
    return all(h.id in done_ids for h in scheduled)


@router.get("/summary", response_model=schemas.StatsSummary)
def summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    habits, logs, completed_by_date, habits_by_weekday = _load_context(db, current_user)
    today = date_type.today()

    # --- streaks ---
    current_streak = 0
    cursor = today
    for _ in range(MAX_LOOKBACK_DAYS):
        status = _day_status(cursor, habits_by_weekday, completed_by_date)
        if status is None:
            cursor -= timedelta(days=1)
            continue
        if status is True:
            current_streak += 1
            cursor -= timedelta(days=1)
        else:
            break

    best_streak = 0
    running = 0
    cursor = today - timedelta(days=MAX_LOOKBACK_DAYS)
    while cursor <= today:
        status = _day_status(cursor, habits_by_weekday, completed_by_date)
        if status is True:
            running += 1
            best_streak = max(best_streak, running)
        elif status is False:
            running = 0
        # status is None: day doesn't count, doesn't reset either
        cursor += timedelta(days=1)
    best_streak = max(best_streak, current_streak)

    # --- last 7 days completion rate ---
    total_scheduled = 0
    total_done = 0
    for i in range(7):
        d = today - timedelta(days=i)
        scheduled = habits_by_weekday.get(d.isoweekday() % 7, [])
        total_scheduled += len(scheduled)
        done_ids = completed_by_date.get(d, set())
        total_done += sum(1 for h in scheduled if h.id in done_ids)
    week_completion_rate = round((total_done / total_scheduled) * 100) if total_scheduled else 0

    total_completed = sum(1 for log in logs if log.completed)

    return schemas.StatsSummary(
        current_streak=current_streak,
        best_streak=best_streak,
        week_completion_rate=week_completion_rate,
        total_completed=total_completed,
    )


@router.get("/weekly", response_model=list[schemas.WeeklyStat])
def weekly(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _, _, completed_by_date, habits_by_weekday = _load_context(db, current_user)
    today = date_type.today()

    result = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        weekday = d.isoweekday() % 7  # 0=domingo ... 6=sábado (matches JS getDay())
        scheduled = habits_by_weekday.get(weekday, [])
        done_ids = completed_by_date.get(d, set())
        completed_count = sum(1 for h in scheduled if h.id in done_ids)
        result.append(
            schemas.WeeklyStat(
                date=d,
                label=f"{WEEKDAY_LABELS[weekday]} {d.day}",
                completed_count=completed_count,
                total_count=len(scheduled),
            )
        )
    return result


@router.get("/by-category", response_model=list[schemas.CategoryStat])
def by_category(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    habits = db.query(models.Habit).filter(models.Habit.user_id == current_user.id).all()
    habit_category = {h.id: h.category for h in habits}

    logs = (
        db.query(models.HabitLog)
        .filter(models.HabitLog.user_id == current_user.id, models.HabitLog.completed.is_(True))
        .all()
    )

    counts: dict[str, int] = defaultdict(int)
    for log in logs:
        category = habit_category.get(log.habit_id, "otro")
        counts[category] += 1

    return [
        schemas.CategoryStat(category=cat, completed_count=count)
        for cat, count in sorted(counts.items(), key=lambda kv: -kv[1])
    ]
