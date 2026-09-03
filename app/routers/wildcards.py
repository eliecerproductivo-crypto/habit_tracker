"""
Router de comodines (wildcards).

Reglas de negocio:
  - Saldo máximo: 2 comodines.
  - Se gana 1 comodín al alcanzar cada múltiplo de 15 días de racha
    (15, 30, 45 …) siempre que el saldo no sea 2.
  - Usar un comodín protege la racha marcando todos los hábitos del día
    como "skipped" (neutral). El saldo baja 1.
  - No se pueden usar dos comodines en días consecutivos.
  - Endpoint POST /wildcards/check-milestone: el frontend lo llama al
    registrar hábitos; si la racha acaba de cruzar un múltiplo de 15
    otorga el comodín y devuelve ganado=True (para mostrar la notificación).
"""

from datetime import date as date_type, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.routers.stats import compute_user_stats   # reutiliza el cálculo de racha

MAX_BALANCE = 2
MILESTONE_INTERVAL = 15  # días

router = APIRouter(prefix="/wildcards", tags=["wildcards"])


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_or_create_balance(db: Session, user_id: int) -> models.WildcardBalance:
    """Devuelve (o crea) el registro de saldo del usuario."""
    wb = (
        db.query(models.WildcardBalance)
        .filter(models.WildcardBalance.user_id == user_id)
        .first()
    )
    if not wb:
        wb = models.WildcardBalance(user_id=user_id, balance=0, last_milestone=0)
        db.add(wb)
        db.flush()   # obtiene el id sin commit completo
    return wb


def _build_status(wb: models.WildcardBalance, current_streak: int) -> schemas.WildcardStatus:
    """Construye el schema de respuesta a partir del modelo y la racha actual."""
    today = date_type.today()
    yesterday = today - timedelta(days=1)

    # El siguiente hito es el próximo múltiplo de 15 que aún no se ha otorgado.
    next_milestone = wb.last_milestone + MILESTONE_INTERVAL

    # No se puede usar si el último uso fue ayer (regla anti-consecutivo).
    can_use_today = not (wb.last_used_date == yesterday)

    return schemas.WildcardStatus(
        balance=wb.balance,
        last_milestone=wb.last_milestone,
        last_used_date=wb.last_used_date,
        max_balance=MAX_BALANCE,
        next_milestone=next_milestone,
        can_use_today=can_use_today,
        at_cap=(wb.balance >= MAX_BALANCE),
    )


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=schemas.WildcardStatus)
def get_wildcard_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Devuelve el estado actual de comodines del usuario.
    En la primera carga (last_milestone == 0 y balance == 0) sincroniza
    last_milestone con la racha existente para no mostrar "día 1 de 15"
    a usuarios que ya llevan días de racha. No otorga comodines
    retroactivos: solo pone el contador al día.
    """
    wb = _get_or_create_balance(db, current_user.id)
    stats = compute_user_stats(db, current_user)
    streak = stats.current_streak

    # ── Sincronización inicial ──────────────────────────────────────────────
    # Si el registro acaba de crearse (last_milestone == 0) y el usuario ya
    # tiene racha, alineamos last_milestone al múltiplo de 15 más alto ya
    # superado, sin otorgar comodines por esos hitos pasados.
    if wb.last_milestone == 0 and streak > 0:
        # Mayor múltiplo de 15 ya alcanzado (puede ser 0 si streak < 15)
        highest_completed = (streak // MILESTONE_INTERVAL) * MILESTONE_INTERVAL
        if highest_completed > 0:
            wb.last_milestone = highest_completed
            wb.updated_at = datetime.now(timezone.utc)

    db.commit()
    return _build_status(wb, streak)


@router.post("/check-milestone", response_model=schemas.WildcardStatus)
def check_milestone(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Evalúa si la racha actual ha cruzado un nuevo múltiplo de 15 días.
    Si es así, y el saldo no está al tope, otorga 1 comodín.
    Llámalo después de cada registro de hábito (el frontend lo decide).
    El campo `gained` no está en el schema de respuesta pero se puede
    inferir comparando `last_milestone` antes y después; si necesitas
    saber si se ganó uno, compara el balance retornado.
    """
    wb = _get_or_create_balance(db, current_user.id)
    stats = compute_user_stats(db, current_user)
    streak = stats.current_streak

    # ¿La racha actual supera el siguiente hito no otorgado?
    next_milestone = wb.last_milestone + MILESTONE_INTERVAL
    if streak >= next_milestone:
        if wb.balance < MAX_BALANCE:
            wb.balance += 1
        # Siempre avanzamos el hito aunque estemos al tope (para no regalarlo
        # en cuanto el usuario gaste un comodín).
        wb.last_milestone = next_milestone
        wb.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(wb)
    return _build_status(wb, streak)


@router.post("/use", response_model=schemas.WildcardStatus)
def use_wildcard(
    payload: schemas.WildcardUseRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Usa 1 comodín para la fecha indicada.
    Marca como 'skipped' todos los hábitos del usuario que estaban
    pendientes (sin log o con 'failed') en esa fecha.
    Reglas de rechazo:
      - Saldo == 0.
      - Se usó un comodín ayer (no se pueden usar dos días consecutivos).
      - La fecha está en el futuro.
      - La fecha es anterior a hace 7 días (ventana de uso razonable).
    """
    today = date_type.today()
    yesterday = today - timedelta(days=1)

    # ── Validaciones de fecha ───────────────────────────────────────────────
    if payload.date > today:
        raise HTTPException(status_code=400, detail="No puedes usar un comodín en una fecha futura.")
    if payload.date < today - timedelta(days=7):
        raise HTTPException(
            status_code=400,
            detail="Solo puedes usar un comodín para los últimos 7 días.",
        )

    wb = _get_or_create_balance(db, current_user.id)

    # ── Validaciones de saldo / regla anti-consecutivo ─────────────────────
    if wb.balance <= 0:
        raise HTTPException(status_code=400, detail="No tienes comodines disponibles.")
    if wb.last_used_date == yesterday:
        raise HTTPException(
            status_code=400,
            detail=(
                "No puedes usar dos comodines en días consecutivos. "
                "Debes completar tus hábitos hoy para mantener la racha."
            ),
        )

    # ── Aplicar comodín: marcar hábitos pendientes como 'skipped' ──────────
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.user_id == current_user.id, models.Habit.is_active.is_(True))
        .all()
    )

    for habit in habits:
        existing_log = (
            db.query(models.HabitLog)
            .filter(
                models.HabitLog.habit_id == habit.id,
                models.HabitLog.date == payload.date,
            )
            .first()
        )
        if existing_log:
            # Solo sobreescribir si no está 'done' — no quitamos logros ya marcados.
            if existing_log.status != "done":
                existing_log.status = "skipped"
                existing_log.logged_at = datetime.now(timezone.utc)
        else:
            # Crear log 'skipped' para hábitos sin registro ese día.
            new_log = models.HabitLog(
                habit_id=habit.id,
                user_id=current_user.id,
                date=payload.date,
                status="skipped",
                note="🃏 Comodín usado",
            )
            db.add(new_log)

    # ── Actualizar saldo ────────────────────────────────────────────────────
    wb.balance -= 1
    wb.last_used_date = payload.date
    wb.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(wb)

    stats = compute_user_stats(db, current_user)
    return _build_status(wb, stats.current_streak)
