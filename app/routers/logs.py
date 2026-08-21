from datetime import date as date_type, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=list[schemas.LogOut])
def list_logs(
    date: date_type | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.HabitLog).filter(models.HabitLog.user_id == current_user.id)
    if date is not None:
        query = query.filter(models.HabitLog.date == date)
    return query.all()


@router.post("", response_model=schemas.LogOut)
def upsert_log(
    payload: schemas.LogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == payload.habit_id, models.Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Hábito no encontrado.")

    today = datetime.now(timezone.utc).date()
    if payload.date > today:
        raise HTTPException(status_code=400, detail="No puedes registrar un hábito en una fecha futura.")

    log = (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.habit_id == payload.habit_id,
            models.HabitLog.date == payload.date,
        )
        .first()
    )

    if log:
        log.status = payload.status
        log.logged_at = datetime.now(timezone.utc)
    else:
        log = models.HabitLog(
            habit_id=payload.habit_id,
            user_id=current_user.id,
            date=payload.date,
            status=payload.status,
        )
        db.add(log)

    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=204)
def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Elimina el log (vuelve el hábito a estado 'sin registrar' para ese día)."""
    log = (
        db.query(models.HabitLog)
        .filter(models.HabitLog.id == log_id, models.HabitLog.user_id == current_user.id)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Log no encontrado.")
    db.delete(log)
    db.commit()
    return None
