from collections import defaultdict
from datetime import date as date_type, timedelta
import calendar

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/stats", tags=["stats"])

WEEKDAY_LABELS = [
    "dom", "lun", "mar",
    "mi\u00e9", "jue", "vie", "s\u00e1b",
]
MAX_LOOKBACK_DAYS = 365


def _parse_days(days_of_week: str) -> set[int]:
    return {int(d) for d in days_of_week.split(",") if d.strip() != ""}


def _habit_occurs_on_date(h: models.Habit, d: date_type) -> bool:
    """
    Python equivalent of the frontend habitOccursOnDate().
    Returns True if habit h is scheduled to occur on date d.
    Handles weekly, interval, and monthly recurrence types.
    Does NOT check start_date -- callers do that separately.
    """
    rtype = h.recurrence_type or "weekly"

    if rtype == "weekly":
        wd = d.isoweekday() % 7
        return wd in _parse_days(h.days_of_week)

    if rtype == "interval":
        interval = h.recurrence_interval
        if not interval or interval < 1:
            return False
        ref = h.start_date or h.created_at.date()
        diff = (d - ref).days
        return diff >= 0 and diff % interval == 0

    if rtype == "monthly":
        dom = h.recurrence_day_of_month
        if dom is None:
            return False
        if dom == -1:
            last_day = calendar.monthrange(d.year, d.month)[1]
            return d.day == last_day
        return d.day == dom

    return False


def _load_context(db: Session, user: models.User):
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.user_id == user.id, models.Habit.is_active.is_(True))
        .all()
    )
    logs = db.query(models.HabitLog).filter(models.HabitLog.user_id == user.id).all()

    status_by_date: dict[date_type, dict[int, str]] = defaultdict(dict)
    for log in logs:
        status_by_date[log.date][log.habit_id] = log.status

    # Weekly habits indexed by weekday (0-6 JS convention).
    # interval/monthly kept separate -- _habit_occurs_on_date() is called per day.
    habits_by_weekday: dict[int, list[models.Habit]] = defaultdict(list)
    non_weekly: list[models.Habit] = []
    for habit in habits:
        if (habit.recurrence_type or "weekly") == "weekly":
            for wd in _parse_days(habit.days_of_week):
                habits_by_weekday[wd].append(habit)
        else:
            non_weekly.append(habit)

    return habits, logs, status_by_date, habits_by_weekday, non_weekly


def _day_status(
    d: date_type,
    habits_by_weekday,
    non_weekly,
    status_by_date,
) -> bool | None:
    """
    True  = all habits due on d (that existed on d) are done or skipped.
    False = at least one is missing or failed.
    None  = nothing scheduled that day.

    Handles weekly, interval, and monthly recurrence types.
    A habit is only counted if d >= habit.start_date (or start_date is None).
    skipped is neutral.
    """
    weekday = d.isoweekday() % 7

    scheduled = []
    for h in habits_by_weekday.get(weekday, []):
        effective_start = h.start_date or h.created_at.date()
        if d < effective_start:
            continue
        scheduled.append(h)
    for h in non_weekly:
        effective_start = h.start_date or h.created_at.date()
        if d < effective_start:
            continue
        if _habit_occurs_on_date(h, d):
            scheduled.append(h)

    if not scheduled:
        return None

    day_logs = status_by_date.get(d, {})
    for h in scheduled:
        s = day_logs.get(h.id)
        if s == "done" or s == "skipped":
            continue
        return False
    return True


def compute_user_stats(db: Session, user: models.User) -> schemas.StatsSummary:
    habits, logs, status_by_date, habits_by_weekday, non_weekly = _load_context(db, user)
    today = date_type.today()

    current_streak = 0
    # Hoy nunca se incluye en la racha: el día aún no ha terminado y los hábitos
    # pueden completarse hasta la medianoche. La racha siempre se calcula desde
    # ayer hacia atrás para evitar que la racha caiga a 0 durante el día.
    cursor = today - timedelta(days=1)
    for _ in range(MAX_LOOKBACK_DAYS):
        status = _day_status(cursor, habits_by_weekday, non_weekly, status_by_date)
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
    # No incluir hoy (el día no ha terminado)
    while cursor <= today - timedelta(days=1):
        status = _day_status(cursor, habits_by_weekday, non_weekly, status_by_date)
        if status is True:
            running += 1
            best_streak = max(best_streak, running)
        elif status is False:
            running = 0
        cursor += timedelta(days=1)
    best_streak = max(best_streak, current_streak)

    # Cumplimiento: últimos 6 días completados, pero solo desde que el primer hábito existe.
    # Esto evita penalizar días anteriores al inicio del usuario.
    oldest_habit_date = None
    for h in habits:
        effective = h.start_date or h.created_at.date()
        if oldest_habit_date is None or effective < oldest_habit_date:
            oldest_habit_date = effective

    total_scheduled = 0
    total_done = 0
    for i in range(1, 7):
        d = today - timedelta(days=i)
        # No contar días anteriores al primer hábito
        if oldest_habit_date and d < oldest_habit_date:
            continue
        weekday = d.isoweekday() % 7
        day_logs = status_by_date.get(d, {})

        for h in habits_by_weekday.get(weekday, []):
            effective_start = h.start_date or h.created_at.date()
            if d < effective_start:
                continue
            s = day_logs.get(h.id)
            if s == "skipped":
                continue
            total_scheduled += 1
            if s == "done":
                total_done += 1

        for h in non_weekly:
            effective_start = h.start_date or h.created_at.date()
            if d < effective_start:
                continue
            if not _habit_occurs_on_date(h, d):
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


@router.get("/summary", response_model=schemas.StatsSummary)
def summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return compute_user_stats(db, current_user)


@router.get("/weekly", response_model=list[schemas.WeeklyStat])
def weekly(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    _, _, status_by_date, habits_by_weekday, non_weekly = _load_context(db, current_user)
    today = date_type.today()

    result = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        weekday = d.isoweekday() % 7
        day_logs = status_by_date.get(d, {})

        effective = []
        for h in habits_by_weekday.get(weekday, []):
            effective_start = h.start_date or h.created_at.date()
            if d < effective_start:
                continue
            if day_logs.get(h.id) == "skipped":
                continue
            effective.append(h)
        for h in non_weekly:
            effective_start = h.start_date or h.created_at.date()
            if d < effective_start:
                continue
            if not _habit_occurs_on_date(h, d):
                continue
            if day_logs.get(h.id) == "skipped":
                continue
            effective.append(h)

        completed_count = sum(1 for h in effective if day_logs.get(h.id) == "done")

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