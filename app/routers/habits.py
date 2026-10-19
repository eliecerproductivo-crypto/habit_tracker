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
    active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Habit).filter(models.Habit.user_id == current_user.id)
    if active is not None:
        query = query.filter(models.Habit.is_active.is_(active))
    habits = query.order_by(models.Habit.start_time.nulls_last()).all()
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
    from datetime import date as date_type, timedelta

    habit = _get_owned_habit(db, habit_id, current_user)
    has_logs = (
        db.query(models.HabitLog.id)
        .filter(models.HabitLog.habit_id == habit_id)
        .first()
        is not None
    )

    schedule_changed = (
        (payload.recurrence_type or "weekly") != (habit.recurrence_type or "weekly")
        or (payload.days_of_week or "") != (habit.days_of_week or "")
        or payload.recurrence_interval != habit.recurrence_interval
        or payload.recurrence_day_of_month != habit.recurrence_day_of_month
        or payload.recurrence_times_per_week != habit.recurrence_times_per_week
    )

    if payload.start_date != habit.start_date and has_logs and not schedule_changed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede cambiar la fecha de inicio porque ya existen registros de cumplimiento para este hábito.",
        )

    data = payload.model_dump()

    # Si la frecuencia o programación cambió y ya hay logs históricos,
    # ajustar start_date para que la nueva regla entre en vigencia desde ahora
    # y las semanas/días pasados no sean re-evaluados con la nueva regla.
    if schedule_changed and has_logs:
        today = date_type.today()
        new_type = payload.recurrence_type or "weekly"
        if new_type == "weekly_times":
            # Para cuotas semanales, la vigencia abarca la semana en curso (lunes a domingo)
            monday_this_week = today - timedelta(days=today.weekday())
            data["start_date"] = monday_this_week
        else:
            # Para días fijos (weekly), intervalo o mensual, entra en vigencia desde hoy
            # para no penalizar días anteriores de la misma semana
            data["start_date"] = today

    for field, value in data.items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    habit.has_logs = has_logs
    return habit


@router.put("/{habit_id}/archive", response_model=schemas.HabitOut)
def archive_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Archiva un hábito (is_active = False) sin borrar su historial de logs.
    El hábito deja de aparecer en el plan diario y en las stats activas,
    pero sus registros se preservan para contexto histórico.
    """
    habit = _get_owned_habit(db, habit_id, current_user)
    habit.is_active = False
    db.commit()
    db.refresh(habit)
    has_logs = (
        db.query(models.HabitLog.id)
        .filter(models.HabitLog.habit_id == habit_id)
        .first() is not None
    )
    habit.has_logs = has_logs
    return habit


@router.put("/{habit_id}/restore", response_model=schemas.HabitOut)
def restore_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Restaura un hábito archivado (is_active = True).
    Vuelve a aparecer en el plan diario desde hoy.
    """
    from datetime import date as date_type
    habit = _get_owned_habit(db, habit_id, current_user)
    if habit.is_active:
        raise HTTPException(status_code=400, detail="El hábito ya está activo.")
    habit.is_active = True
    # Actualizar start_date a hoy para que no retroactivamente marque días
    # pasados (desde que fue archivado) como incumplidos.
    habit.start_date = date_type.today()
    db.commit()
    db.refresh(habit)
    has_logs = (
        db.query(models.HabitLog.id)
        .filter(models.HabitLog.habit_id == habit_id)
        .first() is not None
    )
    habit.has_logs = has_logs
    return habit


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Elimina permanentemente un hábito y todos sus logs.
    Solo se puede eliminar si el hábito ya está archivado (is_active = False).
    Esto fuerza al usuario a archivar primero, evitando borrados accidentales
    de hábitos activos con historial.
    """
    habit = _get_owned_habit(db, habit_id, current_user)
    if habit.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archiva el hábito antes de eliminarlo definitivamente.",
        )
    db.delete(habit)
    db.commit()
    return None
