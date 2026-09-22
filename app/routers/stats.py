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
    Handles weekly, interval, monthly, and weekly_times recurrence types.
    Does NOT check start_date -- callers do that separately.
    For weekly_times, always returns True (the habit can be done any day).
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

    if rtype == "weekly_times":
        return True  # can be done on any day of the week

    return False


def _iso_week(d: date_type) -> tuple[int, int]:
    """Returns (year, week_number) using ISO week convention (Mon-start)."""
    return d.isocalendar()[:2]


def _weeks_in_range(start: date_type, end: date_type) -> list[tuple[int, int]]:
    """Return all distinct ISO (year, week) tuples between start and end inclusive."""
    seen = []
    cursor = start
    while cursor <= end:
        yw = _iso_week(cursor)
        if not seen or seen[-1] != yw:
            seen.append(yw)
        cursor += timedelta(days=1)
    return seen


def _week_start(year: int, week: int) -> date_type:
    """Monday of a given ISO (year, week)."""
    # Jan 4 is always in week 1
    jan4 = date_type(year, 1, 4)
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    return week1_monday + timedelta(weeks=week - 1)


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
    # interval/monthly/weekly_times kept separate -- _habit_occurs_on_date() is called per day.
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

    Handles weekly, interval, monthly, and weekly_times recurrence types.
    A habit is only counted if d >= habit.start_date (or start_date is None).
    skipped is neutral.

    weekly_times habits are excluded from the per-day check — they are
    evaluated at the week level in compute_user_stats.
    """
    weekday = d.isoweekday() % 7

    scheduled = []
    for h in habits_by_weekday.get(weekday, []):
        effective_start = h.start_date or h.created_at.date()
        if d < effective_start:
            continue
        scheduled.append(h)
    for h in non_weekly:
        # weekly_times are handled at week level, not day level
        if (h.recurrence_type or "weekly") == "weekly_times":
            continue
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


def _weekly_times_week_status(
    h: models.Habit,
    week_start_date: date_type,
    status_by_date: dict,
) -> bool | None:
    """
    Returns True if the weekly_times habit met its quota in the given week,
    False if the week is over (or today) and quota was not met,
    None if the habit didn't exist yet that week.
    """
    target = h.recurrence_times_per_week or 1
    effective_start = h.start_date or h.created_at.date()
    week_end = week_start_date + timedelta(days=6)
    today = date_type.today()

    # If the habit didn't exist this week at all, skip
    if effective_start > week_end:
        return None

    # Count "done" logs in this week
    done_count = 0
    for i in range(7):
        d = week_start_date + timedelta(days=i)
        if d < effective_start:
            continue
        if d > today:
            break
        s = status_by_date.get(d, {}).get(h.id)
        if s == "done":
            done_count += 1

    if done_count >= target:
        return True
    # Only mark as failed if the week is over (last day has passed)
    if week_end < today or (week_end == today and date_type.today() == week_end):
        return False
    # Week still in progress — not a failure yet
    return None


def compute_user_stats(db: Session, user: models.User) -> schemas.StatsSummary:
    habits, logs, status_by_date, habits_by_weekday, non_weekly = _load_context(db, user)
    today = date_type.today()

    today_status = _day_status(today, habits_by_weekday, non_weekly, status_by_date)
    current_streak = 0
    # Si hoy ya está 100% completado, la racha cuenta desde hoy.
    # Si hoy aún no está completado, se calcula desde ayer para evitar que la racha caiga a 0 durante el día.
    if today_status is True:
        cursor = today
    else:
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
    end_date = today if today_status is True else today - timedelta(days=1)
    while cursor <= end_date:
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
    # weekly_times habits se evalúan a nivel de semana, no de día.
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
            # weekly_times se cuentan por semana abajo
            if (h.recurrence_type or "weekly") == "weekly_times":
                continue
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

    # weekly_times: contar cuotas vs completados en la semana anterior completa
    weekly_times_habits = [h for h in non_weekly if (h.recurrence_type or "") == "weekly_times"]
    if weekly_times_habits:
        ref_day = today - timedelta(days=1)
        mon = ref_day - timedelta(days=ref_day.weekday())  # lunes de esa semana
        for h in weekly_times_habits:
            effective_start = h.start_date or h.created_at.date()
            if effective_start > mon + timedelta(days=6):
                continue
            target = h.recurrence_times_per_week or 1
            done_count = 0
            for i in range(7):
                d = mon + timedelta(days=i)
                if d < effective_start or d >= today:
                    continue
                if status_by_date.get(d, {}).get(h.id) == "done":
                    done_count += 1
            total_scheduled += target
            total_done += min(done_count, target)

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
            # weekly_times: show on every day (can log any day)
            if (h.recurrence_type or "weekly") == "weekly_times":
                effective_start = h.start_date or h.created_at.date()
                if d < effective_start:
                    continue
                if day_logs.get(h.id) != "skipped":
                    effective.append(h)
                continue
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


@router.get("/habit/{habit_id}", response_model=schemas.HabitStatsOut)
def habit_stats(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Estadísticas detalladas de un hábito individual:
    racha actual, mejor racha, total completados, cumplimiento y logs históricos.
    """
    from fastapi import HTTPException as _HTTPException

    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise _HTTPException(status_code=404, detail="Hábito no encontrado.")

    logs = (
        db.query(models.HabitLog)
        .filter(models.HabitLog.habit_id == habit_id, models.HabitLog.user_id == current_user.id)
        .order_by(models.HabitLog.date.desc())
        .all()
    )

    today = date_type.today()
    effective_start = habit.start_date or habit.created_at.date()
    is_weekly_times = (habit.recurrence_type or "weekly") == "weekly_times"

    if is_weekly_times:
        # ── weekly_times: streak and stats are measured in weeks ─────────────
        # status_by_date for the week-level helper
        sbd_full: dict[date_type, dict[int, str]] = defaultdict(dict)
        for log in logs:
            sbd_full[log.date][habit.id] = log.status

        all_weeks = _weeks_in_range(effective_start, today)
        # Determine the "end week" — the week containing today
        cur_week = _iso_week(today)

        # Compute week statuses for all weeks
        week_statuses: list[bool | None] = []
        for yw in all_weeks:
            ws = _week_start(*yw)
            week_statuses.append(_weekly_times_week_status(habit, ws, sbd_full))

        # Current streak (weeks)
        current_streak = 0
        for ws in reversed(week_statuses):
            if ws is True:
                current_streak += 1
            elif ws is False:
                break
            # None = no data / in progress, skip

        # Best streak (weeks)
        best_streak = 0
        running = 0
        for ws in week_statuses:
            if ws is True:
                running += 1
                best_streak = max(best_streak, running)
            elif ws is False:
                running = 0
        best_streak = max(best_streak, current_streak)

        # Completion rate: done / (target * completed weeks)
        target = habit.recurrence_times_per_week or 1
        total_done = sum(1 for log in logs if log.status == "done")
        # Count weeks that have at least started (habit existed)
        completed_weeks = sum(1 for ws in week_statuses if ws is not None)
        total_scheduled = target * completed_weeks if completed_weeks else 0
        completion_rate = round((min(total_done, total_scheduled) / total_scheduled) * 100) if total_scheduled else 0

    else:
        # ── Índice rápido fecha → status ─────────────────────────────────────
        status_by_date: dict[date_type, str] = {log.date: log.status for log in logs}

        def occurs_on(d: date_type) -> bool:
            if d < effective_start:
                return False
            return _habit_occurs_on_date(habit, d)

        # ── Racha actual ──────────────────────────────────────────────────────
        current_streak = 0
        today_status = status_by_date.get(today)
        if occurs_on(today) and today_status in ("done", "skipped"):
            cursor = today
        else:
            cursor = today - timedelta(days=1)

        for _ in range(MAX_LOOKBACK_DAYS):
            if cursor < effective_start:
                break
            if not occurs_on(cursor):
                cursor -= timedelta(days=1)
                continue
            s = status_by_date.get(cursor)
            if s == "done" or s == "skipped":
                if s == "done":
                    current_streak += 1
                cursor -= timedelta(days=1)
            else:
                break

        # ── Mejor racha histórica ─────────────────────────────────────────────
        best_streak = 0
        running = 0
        cursor = effective_start
        end_date = today if (occurs_on(today) and today_status in ("done", "skipped")) else today - timedelta(days=1)
        while cursor <= end_date:
            if occurs_on(cursor):
                s = status_by_date.get(cursor)
                if s == "done":
                    running += 1
                    best_streak = max(best_streak, running)
                elif s == "skipped":
                    pass
                else:
                    running = 0
            cursor += timedelta(days=1)
        best_streak = max(best_streak, current_streak)

        # ── Cumplimiento total ────────────────────────────────────────────────
        total_scheduled = 0
        total_done = 0
        cursor = effective_start
        while cursor <= end_date:
            if occurs_on(cursor):
                s = status_by_date.get(cursor)
                if s == "skipped":
                    pass
                else:
                    total_scheduled += 1
                    if s == "done":
                        total_done += 1
            cursor += timedelta(days=1)

        completion_rate = round((total_done / total_scheduled) * 100) if total_scheduled else 0

    return schemas.HabitStatsOut(
        habit_id=habit.id,
        habit_name=habit.name,
        category=habit.category,
        current_streak=current_streak,
        best_streak=best_streak,
        total_done=total_done,
        total_scheduled=total_scheduled,
        completion_rate=completion_rate,
        logs=logs,
        days_of_week=habit.days_of_week,
        recurrence_type=habit.recurrence_type or "weekly",
        recurrence_interval=habit.recurrence_interval,
        recurrence_day_of_month=habit.recurrence_day_of_month,
        recurrence_times_per_week=habit.recurrence_times_per_week,
        start_date=habit.start_date,
        created_at=habit.created_at,
    )
