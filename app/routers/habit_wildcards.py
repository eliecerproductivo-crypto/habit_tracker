"""
Router de comodines de hábito (descanso individual por hábito).

Reglas de negocio:
  - Cuota base: 1 comodín por quincena (fija: días 1-15 y 16-fin de mes).
  - Segundo comodín: se gana si los primeros 7 días de la quincena no tienen
    ningún hábito 'failed' ni sin registrar (done, skipped y rest cuentan).
  - No se puede usar en dos días consecutivos para el mismo hábito.
  - El hábito debe tener al menos 14 días de vida (MIN_FORMATION_DAYS).
  - Solo se puede usar hoy (no retroactivo).
  - No se puede usar si el hábito ya está marcado done o skipped ese día.
  - El uso se registra en habit_wildcard_uses (quota per quincena).
  - Si se deshace (DELETE /habit-wildcards/undo/{habit_id}), se devuelve 1 a la cuota
    y se elimina el log de rest, solo si el log es de hoy.
"""

from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.quincena import (
    quincena_key,
    quincena_start,
    quincena_first_half_end,
)
from app.routers.stats import _habit_occurs_on_date, _parse_days

router = APIRouter(prefix="/habit-wildcards", tags=["habit-wildcards"])

MIN_FORMATION_DAYS = 14   # días mínimos desde created_at para poder usar comodín
BASE_QUOTA = 1            # comodines base por quincena siempre disponibles
MAX_QUOTA = 2             # máximo posible con el bono


# ── Helpers internos ──────────────────────────────────────────────────────────

def _get_quota_used(db: Session, user_id: int, quincena: str) -> int:
    """Cuántos comodines de hábito ya se usaron en esta quincena."""
    return (
        db.query(models.HabitWildcardUse)
        .filter(
            models.HabitWildcardUse.user_id == user_id,
            models.HabitWildcardUse.quincena == quincena,
        )
        .count()
    )


def _second_earned(db: Session, user_id: int, today: date_type) -> bool:
    """
    True si el usuario completó todos los hábitos en la primera mitad de la
    quincena actual (primeros 7 días del período).
    'Completó' = done, skipped o rest en cada hábito programado.
    Fallido o sin registro cuenta como incumplimiento.
    Si aún no terminó la primera mitad, devuelve False (no ganado todavía).
    """
    first_half_end = quincena_first_half_end(today)

    # Solo evaluar si la primera mitad ya terminó
    if today <= first_half_end:
        return False

    start = quincena_start(today)
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.user_id == user_id, models.Habit.is_active.is_(True))
        .all()
    )
    if not habits:
        return False

    # Cargar logs de la primera mitad de la quincena
    logs = (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.user_id == user_id,
            models.HabitLog.date >= start,
            models.HabitLog.date <= first_half_end,
        )
        .all()
    )
    status_by_date: dict[date_type, dict[int, str]] = {}
    for log in logs:
        status_by_date.setdefault(log.date, {})[log.habit_id] = log.status

    PASSING = {"done", "skipped", "rest"}

    cursor = start
    while cursor <= first_half_end:
        for h in habits:
            effective_start = h.start_date or h.created_at.date()
            if cursor < effective_start:
                continue
            rtype = h.recurrence_type or "weekly"
            if rtype == "weekly":
                wd = cursor.isoweekday() % 7
                if wd not in _parse_days(h.days_of_week):
                    continue
            elif not _habit_occurs_on_date(h, cursor):
                continue
            s = status_by_date.get(cursor, {}).get(h.id)
            if s not in PASSING:
                return False
        cursor += timedelta(days=1)

    return True


def _build_status(
    db: Session,
    user_id: int,
    today: date_type,
    habit: models.Habit | None = None,
) -> schemas.HabitWildcardStatus:
    """Construye el schema de respuesta con estado de cuota y disponibilidad."""
    q = quincena_key(today)
    used = _get_quota_used(db, user_id, q)
    earned = _second_earned(db, user_id, today)
    total = MAX_QUOTA if earned else BASE_QUOTA
    remaining = max(0, total - used)

    habit_can_rest: bool | None = None
    habit_rest_reason: str | None = None

    if habit is not None:
        if remaining <= 0:
            habit_can_rest = False
            habit_rest_reason = "Agotaste tus descansos de esta quincena"
        elif habit.created_at and (today - habit.created_at.date()).days < MIN_FORMATION_DAYS:
            days_left = MIN_FORMATION_DAYS - (today - habit.created_at.date()).days
            habit_can_rest = False
            habit_rest_reason = f"Este hábito aún está en formación ({days_left} {'día' if days_left == 1 else 'días'} restantes)"
        else:
            # Comprobar si se usó ayer para este hábito
            yesterday = today - timedelta(days=1)
            used_yesterday = (
                db.query(models.HabitWildcardUse)
                .filter(
                    models.HabitWildcardUse.user_id == user_id,
                    models.HabitWildcardUse.habit_id == habit.id,
                    models.HabitWildcardUse.date == yesterday,
                )
                .first()
            )
            if used_yesterday:
                habit_can_rest = False
                habit_rest_reason = "Este hábito ya descansó ayer"
            else:
                # Comprobar si ya tiene log done/skipped hoy
                existing_log = (
                    db.query(models.HabitLog)
                    .filter(
                        models.HabitLog.habit_id == habit.id,
                        models.HabitLog.date == today,
                    )
                    .first()
                )
                if existing_log and existing_log.status in ("done", "skipped"):
                    habit_can_rest = False
                    habit_rest_reason = "Ya registraste este hábito hoy"
                elif existing_log and existing_log.status == "rest":
                    habit_can_rest = False
                    habit_rest_reason = "Ya descansaste este hábito hoy"
                else:
                    habit_can_rest = True

    return schemas.HabitWildcardStatus(
        quincena=q,
        quota_total=total,
        quota_used=used,
        quota_remaining=remaining,
        second_earned=earned,
        habit_can_rest=habit_can_rest,
        habit_rest_reason=habit_rest_reason,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=schemas.HabitWildcardStatus)
def get_habit_wildcard_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Estado global de cuota de comodines de hábito para la quincena actual."""
    today = date_type.today()
    return _build_status(db, current_user.id, today)


@router.get("/check/{habit_id}", response_model=schemas.HabitWildcardStatus)
def check_habit_wildcard(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Devuelve si un hábito concreto puede descansar hoy y el motivo si no puede.
    Útil para el frontend antes de mostrar el botón activo/desactivado.
    """
    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Hábito no encontrado.")

    today = date_type.today()
    return _build_status(db, current_user.id, today, habit=habit)


@router.post("/use", response_model=schemas.HabitWildcardUseOut)
def use_habit_wildcard(
    payload: schemas.HabitWildcardUseRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Usa 1 comodín de hábito para el hábito y fecha indicados.
    Crea un log con status='rest' y registra el uso en habit_wildcard_uses.
    Solo se puede usar hoy.
    """
    today = date_type.today()

    # Solo se puede usar hoy (no retroactivo)
    if payload.date != today:
        raise HTTPException(
            status_code=400,
            detail="El comodín de hábito solo puede usarse el mismo día.",
        )

    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == payload.habit_id, models.Habit.user_id == current_user.id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Hábito no encontrado.")

    q = quincena_key(today)
    used = _get_quota_used(db, current_user.id, q)
    earned = _second_earned(db, current_user.id, today)
    total = MAX_QUOTA if earned else BASE_QUOTA

    # ── Validaciones (RD-04: todas en servidor) ────────────────────────────
    if used >= total:
        raise HTTPException(
            status_code=400,
            detail="Agotaste tus descansos de esta quincena.",
        )

    if habit.created_at and (today - habit.created_at.date()).days < MIN_FORMATION_DAYS:
        days_left = MIN_FORMATION_DAYS - (today - habit.created_at.date()).days
        raise HTTPException(
            status_code=400,
            detail=f"Este hábito aún está en formación ({days_left} días restantes).",
        )

    yesterday = today - timedelta(days=1)
    used_yesterday = (
        db.query(models.HabitWildcardUse)
        .filter(
            models.HabitWildcardUse.user_id == current_user.id,
            models.HabitWildcardUse.habit_id == habit.id,
            models.HabitWildcardUse.date == yesterday,
        )
        .first()
    )
    if used_yesterday:
        raise HTTPException(
            status_code=400,
            detail="Este hábito ya descansó ayer. No puedes descansar dos días seguidos.",
        )

    existing_log = (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.habit_id == habit.id,
            models.HabitLog.date == today,
        )
        .first()
    )
    if existing_log and existing_log.status in ("done", "skipped"):
        raise HTTPException(
            status_code=400,
            detail="Ya registraste este hábito hoy. No puedes aplicar un descanso.",
        )
    if existing_log and existing_log.status == "rest":
        raise HTTPException(
            status_code=400,
            detail="Este hábito ya tiene un descanso registrado hoy.",
        )

    # ── Crear/actualizar log con status='rest' ─────────────────────────────
    now = datetime.now(timezone.utc)
    if existing_log:
        existing_log.status = "rest"
        existing_log.logged_at = now
        log = existing_log
    else:
        log = models.HabitLog(
            habit_id=habit.id,
            user_id=current_user.id,
            date=today,
            status="rest",
            note="",
        )
        db.add(log)

    # ── Registrar uso en habit_wildcard_uses ───────────────────────────────
    use_record = models.HabitWildcardUse(
        user_id=current_user.id,
        habit_id=habit.id,
        date=today,
        quincena=q,
    )
    db.add(use_record)

    db.commit()
    db.refresh(log)

    status = _build_status(db, current_user.id, today, habit=habit)
    return schemas.HabitWildcardUseOut(log=log, status=status)


@router.delete("/undo/{habit_id}", status_code=200, response_model=schemas.HabitWildcardStatus)
def undo_habit_wildcard(
    habit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Deshace el comodín de hábito del día de hoy para un hábito específico.
    Elimina el log 'rest' de hoy y devuelve 1 a la cuota de la quincena.
    Solo se puede deshacer el mismo día (CL-04).
    """
    today = date_type.today()

    log = (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.habit_id == habit_id,
            models.HabitLog.user_id == current_user.id,
            models.HabitLog.date == today,
            models.HabitLog.status == "rest",
        )
        .first()
    )
    if not log:
        raise HTTPException(
            status_code=404,
            detail="No hay un descanso activo hoy para este hábito.",
        )

    # Eliminar registro de uso (devuelve 1 a la cuota)
    q = quincena_key(today)
    use_record = (
        db.query(models.HabitWildcardUse)
        .filter(
            models.HabitWildcardUse.user_id == current_user.id,
            models.HabitWildcardUse.habit_id == habit_id,
            models.HabitWildcardUse.date == today,
            models.HabitWildcardUse.quincena == q,
        )
        .first()
    )
    if use_record:
        db.delete(use_record)

    db.delete(log)
    db.commit()

    habit = (
        db.query(models.Habit)
        .filter(models.Habit.id == habit_id, models.Habit.user_id == current_user.id)
        .first()
    )
    return _build_status(db, current_user.id, today, habit=habit)
