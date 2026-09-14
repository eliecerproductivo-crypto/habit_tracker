from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/habits", tags=["habits"])


def _get_owned_habit(db: Session, habit_id: int, user: models.User) -> models.Habit:
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == user.id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Hábito no encontrado.")
    return habit


@router.get("", response_model=list[schemas.HabitOut])
def list_habits(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.user_id == current_user.id)
        .order_by(models.Habit.start_time.nulls_last())
        .all()
    )
    if habits:
        habit_ids = [h.id for h in habits]
        logged_habit_ids = set(
            row[0]
            for row in db.query(models.HabitLog.habit_id)
            .filter(models.HabitLog.habit_id.in_(habit_ids))
            .distinct()
            .all()
        )
        for h in habits:
            h.has_logs = h.id in logged_habit_ids
    return habits


@router.post("", response_model=schemas.HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(
    payload: schemas.HabitCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from datetime import date as date_type
    data = payload.model_dump()
    # Si no se define fecha de inicio, se usa hoy para que el hábito
    # no se proyecte hacia días anteriores a su creación.
    if data.get("start_date") is None:
        data["start_date"] = date_type.today()
    habit = models.Habit(**data, user_id=current_user.id)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    habit.has_logs = False
    return habit


@router.put("/{habit_id}", response_model=schemas.HabitOut)
def update_habit(
    habit_id: int,
    payload: schemas.HabitUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    habit = _get_owned_habit(db, habit_id, current_user)
    has_logs = (
        db.query(models.HabitLog.id)
        .filter(models.HabitLog.habit_id == habit_id)
        .first()
        is not None
    )

    if payload.start_date != habit.start_date and has_logs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede cambiar la fecha de inicio porque ya existen registros de cumplimiento para este hábito.",
        )

    for field, value in payload.model_dump().items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    habit.has_logs = has_logs
    return habit


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    habit = _get_owned_habit(db, habit_id, current_user)
    db.delete(habit)
    db.commit()
    return None
