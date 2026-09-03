from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/timer", tags=["timer"])


@router.get("/sessions", response_model=list[schemas.TimerSessionOut])
def list_timer_sessions(
    habit_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.TimerSession)
        .options(joinedload(models.TimerSession.habit))
        .filter(models.TimerSession.user_id == current_user.id)
    )

    if habit_id is not None:
        query = query.filter(models.TimerSession.habit_id == habit_id)

    sessions = query.order_by(models.TimerSession.start_time.desc()).limit(limit).all()
    return sessions


@router.post("/sessions", response_model=schemas.TimerSessionOut)
def create_timer_session(
    payload: schemas.TimerSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    habit = None
    if payload.habit_id is not None:
        habit = (
            db.query(models.Habit)
            .filter(models.Habit.id == payload.habit_id, models.Habit.user_id == current_user.id)
            .first()
        )
        if not habit:
            raise HTTPException(status_code=404, detail="Hábito no encontrado.")

    session = models.TimerSession(
        user_id=current_user.id,
        habit_id=payload.habit_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        duration_seconds=payload.duration_seconds,
        session_type=payload.session_type,
        notes=payload.notes or "",
    )
    db.add(session)

    # Si se solicitó marcar el hábito como completado hoy
    if payload.auto_mark_done and payload.habit_id is not None:
        target_date = payload.log_date or payload.start_time.date()
        log = (
            db.query(models.HabitLog)
            .filter(
                models.HabitLog.habit_id == payload.habit_id,
                models.HabitLog.date == target_date,
            )
            .first()
        )
        if log:
            log.status = "done"
            log.logged_at = datetime.now(timezone.utc)
        else:
            log = models.HabitLog(
                habit_id=payload.habit_id,
                user_id=current_user.id,
                date=target_date,
                status="done",
            )
            db.add(log)

    db.commit()
    db.refresh(session)
    return session


@router.get("/stats", response_model=schemas.TimerStatsOut)
def get_timer_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now_utc = datetime.now(timezone.utc)
    start_of_today = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = now_utc - timedelta(days=7)

    all_sessions = (
        db.query(models.TimerSession)
        .options(joinedload(models.TimerSession.habit))
        .filter(models.TimerSession.user_id == current_user.id)
        .all()
    )

    today_seconds = 0
    today_sessions_count = 0
    week_seconds = 0
    total_seconds = 0

    habit_aggregates: dict[Optional[int], dict] = {}

    for s in all_sessions:
        dur = s.duration_seconds or 0
        total_seconds += dur

        st = s.start_time
        if st.tzinfo is None:
            st = st.replace(tzinfo=timezone.utc)

        if st >= start_of_today:
            today_seconds += dur
            today_sessions_count += 1

        if st >= seven_days_ago:
            week_seconds += dur

        hid = s.habit_id
        if hid not in habit_aggregates:
            hname = s.habit.name if s.habit else "General / Sin asignar"
            hcat = s.habit.category if s.habit else "otro"
            habit_aggregates[hid] = {
                "habit_id": hid,
                "habit_name": hname,
                "category": hcat,
                "total_seconds": 0,
                "session_count": 0,
            }
        habit_aggregates[hid]["total_seconds"] += dur
        habit_aggregates[hid]["session_count"] += 1

    breakdown = [
        schemas.HabitTimeStat(**agg)
        for agg in sorted(habit_aggregates.values(), key=lambda x: x["total_seconds"], reverse=True)
    ]

    return schemas.TimerStatsOut(
        today_seconds=today_seconds,
        week_seconds=week_seconds,
        total_seconds=total_seconds,
        today_sessions_count=today_sessions_count,
        habits_breakdown=breakdown,
    )


@router.delete("/sessions/{session_id}", status_code=204)
def delete_timer_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = (
        db.query(models.TimerSession)
        .filter(models.TimerSession.id == session_id, models.TimerSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")

    db.delete(session)
    db.commit()
    return None
