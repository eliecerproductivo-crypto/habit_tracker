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

    # Maps: date -> habit_id -> status
    status_by_date: dict[date_type, dict[int, str]] = defaultdict(dict)
    for log in logs:
        status_by_date[log.date][log.habit_id] = log.status

    habits_by_weekday: dict[int, list[models.Habit]] = defaultdict(list)
    for habit in habits:
        for wd in _parse_days(habit.days_of_week):
            habits_by_weekday[wd].append(habit)

    return habits, logs, status_by_date, habits_by_weekday


def _day_status(d: date_type, habits_by_weekday, status_by_date) -> bool | None:
    """
    True  = all scheduled habits (that existed on d) are done or skipped.
    False = at least one habit failed or has no log.
    None  = nothing scheduled that day (or all habits started after d).

    A habit is only counted if d >= habit.start_date (or start_date is None).
    skipped is neutral: excluded from both sides of the check.
    """
    weekday = d.isoweekday() % 7  # 0=domingo ... 6=sabado (matches JS Date#getDay())
    all_scheduled = habits_by_weekday.get(weekday, [])

    # Filter out habits that had not started yet on date d
    scheduled = [h for h in all_scheduled if not (h.start_date and d < h.start_date)]
    if not scheduled:
        return None

    day_logs = status_by_date.get(d, {})
    for h in scheduled:
        s = day_logs.get(h.id)
        if s == 'done' or s == 'skipped':
            continue  # ok
        # failed or no log -> day is broken
        return False
    return True


@router.get("/summary", response_model=schemas.StatsSummary)
def summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    habits, logs, status_by_date, habits_by_weekday = _load_context(db, current_user)
    today = date_type.today()

    # --- streaks ---
    current_streak = 0
    cursor = today
    for _ in range(MAX_LOOKBACK_DAYS):
        status = _day_status(cursor, habits_by_weekday, status_by_date)
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
        status = _day_status(cursor, habits_by_weekday, status_by_date)
        if status is True:
            running += 1
            best_streak = max(best_streak, running)
        elif status is False:
            running = 0
        # status is None: day doesn't count, doesn't reset streak
        cursor += timedelta(days=1)
    best_streak = max(best_streak, current_streak)

    # --- last 7 days completion rate ---
    # Rules:
    #   - Today is excluded: the day has not ended so pending habits unfairly reduce the rate.
    #   - A habit only counts for a day if that day >= habit.start_date (or start_date is None).
    #   - Skipped habits are excluded from both numerator and denominator (neutral).
    total_scheduled = 0
    total_done = 0
    for i in range(1, 7):  # i=1..6 -> yesterday back to 6 days ago (today excluded)
        d = today - timedelta(days=i)
        scheduled = habits_by_weekday.get(d.isoweekday() % 7, [])
        day_logs = status_by_date.get(d, {})
        for h in scheduled:
            # Skip days before this habit existed
            if h.start_date and d < h.start_date:
                continue
            s = day_logs.get(h.id)
            if s == "skipped":
                continue
            total_scheduled += 1
            if s == "done":
                total_done += 1
    week_completion_rate = round((total_done / total_scheduled) * 100) if total_scheduled else 0

    total_completed = sum(1 for log in logs if log.status == "done")

    return schemas.StatsSummary(
        current_streak=current_streak,
        best_streak=best_streak,
        week_completion_rate=week_completion_rate,
        total_completed=total_completed,
    )


@router.get("/weekly", response_model=list[schemas.WeeklyStat])
def weekly(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _, _, status_by_date, habits_by_weekday = _load_context(db, current_user)
    today = date_type.today()

    result = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        weekday = d.isoweekday() % 7
        all_scheduled = habits_by_weekday.get(weekday, [])
        day_logs = status_by_date.get(d, {})

        # Exclude habits that had not started yet on this day.
        # Exclude skipped habits (neutral - not counted on either side).
        effective = [
            h for h in all_scheduled
            if not (h.start_date and d < h.start_date)
            and day_logs.get(h.id) != 'skipped'
        ]
        completed_count = sum(1 for h in effective if day_logs.get(h.id) == 'done')

        result.append(
            schemas.WeeklyStat(
                date=d,
                label=f"{WEEKDAY_LABELS[weekday]} {d.day}",
                completed_count=completed_count,
                total_count=len(effective),
            )
        )
    return result


@router.get("/by-category", response_model=list[schemas.CategoryStat])
def by_category(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    habits = db.query(models.Habit).filter(models.Habit.user_id == current_user.id).all()
    habit_category = {h.id: h.category for h in habits}

    logs = (
        db.query(models.HabitLog)
        .filter(models.HabitLog.user_id == current_user.id, models.HabitLog.status == "done")
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
