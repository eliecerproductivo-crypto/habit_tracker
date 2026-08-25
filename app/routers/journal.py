from datetime import date, datetime, timezone
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/journal", tags=["journal"])

logger = logging.getLogger(__name__)


# ── Schemas ────────────────────────────────────────────────────────────────────

class EntryUpsert(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    entry_date: date


class EntryOut(BaseModel):
    id: int
    content: str
    entry_date: date
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SummaryOut(BaseModel):
    id: int
    summary: str
    date_from: date
    date_to: date
    created_at: datetime

    class Config:
        from_attributes = True


class JournalOverview(BaseModel):
    entries: list[EntryOut]
    summaries: list[SummaryOut]


# ── Background task ────────────────────────────────────────────────────────────

def _summarize_pending_bg(user_id: int, saved_date: date):
    """
    Se ejecuta en background al guardar una entrada.
    - Si la entrada guardada es de hoy: busca entradas anteriores sin resumen y las procesa.
    - Si la entrada guardada es de un día pasado: la resume directamente.
    Solo hace UNA llamada a la IA por ejecución para no gastar tokens.
    """
    from app.ai import summarize_entries
    from app.database import SessionLocal
    from datetime import date as date_type

    today = date_type.today()
    db = SessionLocal()
    try:
        if saved_date >= today:
            # Buscar la entrada pasada más reciente sin resumen
            entry_to_summarize = (
                db.query(models.JournalEntry)
                .filter(
                    models.JournalEntry.user_id == user_id,
                    models.JournalEntry.entry_date < today,
                )
                .outerjoin(
                    models.JournalSummary,
                    (models.JournalSummary.user_id == user_id) &
                    (models.JournalSummary.date_from == models.JournalEntry.entry_date) &
                    (models.JournalSummary.date_to == models.JournalEntry.entry_date),
                )
                .filter(models.JournalSummary.id.is_(None))
                .order_by(models.JournalEntry.entry_date.desc())
                .first()
            )
            if not entry_to_summarize:
                return  # Todo ya está resumido
        else:
            # La entrada guardada es de un día pasado — resumirla directamente
            entry_to_summarize = (
                db.query(models.JournalEntry)
                .filter(
                    models.JournalEntry.user_id == user_id,
                    models.JournalEntry.entry_date == saved_date,
                )
                .first()
            )
            if not entry_to_summarize:
                return

        entry_date = entry_to_summarize.entry_date
        content = entry_to_summarize.content
        entry_id = entry_to_summarize.id

        summary_text = summarize_entries(f"[{entry_date}] {content}")
        if not summary_text:
            logger.warning("AI summarization returned None for entry %d", entry_id)
            return

        existing = (
            db.query(models.JournalSummary)
            .filter(
                models.JournalSummary.user_id == user_id,
                models.JournalSummary.date_from == entry_date,
                models.JournalSummary.date_to == entry_date,
            )
            .first()
        )
        if existing:
            existing.summary = summary_text
            existing.created_at = datetime.now(timezone.utc)
        else:
            db.add(models.JournalSummary(
                user_id=user_id,
                summary=summary_text,
                date_from=entry_date,
                date_to=entry_date,
            ))
        db.commit()
        logger.info("Summary saved for user %d, date %s", user_id, entry_date)
    except Exception as e:
        logger.error("Background summarization failed: %s", e)
    finally:
        db.close()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=JournalOverview)
def get_journal(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entries = (
        db.query(models.JournalEntry)
        .filter(models.JournalEntry.user_id == current_user.id)
        .order_by(models.JournalEntry.entry_date.desc())
        .all()
    )
    summaries = (
        db.query(models.JournalSummary)
        .filter(models.JournalSummary.user_id == current_user.id)
        .order_by(models.JournalSummary.date_to.desc())
        .all()
    )
    return {"entries": entries, "summaries": summaries}


@router.put("/entry", response_model=EntryOut)
def upsert_entry(
    payload: EntryUpsert,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Crea o actualiza la entrada del día.
    Dispara automáticamente el resumen IA en background.
    """
    existing = (
        db.query(models.JournalEntry)
        .filter(
            models.JournalEntry.user_id == current_user.id,
            models.JournalEntry.entry_date == payload.entry_date,
        )
        .first()
    )
    if existing:
        existing.content = payload.content
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        entry = existing
    else:
        entry = models.JournalEntry(
            user_id=current_user.id,
            content=payload.content,
            entry_date=payload.entry_date,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

    # Disparar resumen en background — una llamada por guardado, no bloquea la respuesta
    background_tasks.add_task(
        _summarize_pending_bg,
        current_user.id,
        entry.entry_date,
    )

    return entry


@router.delete("/entry/{entry_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = (
        db.query(models.JournalEntry)
        .filter(
            models.JournalEntry.user_id == current_user.id,
            models.JournalEntry.entry_date == entry_date,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada no encontrada.")

    # Borrar también el resumen del día si existe
    db.query(models.JournalSummary).filter(
        models.JournalSummary.user_id == current_user.id,
        models.JournalSummary.date_from == entry_date,
        models.JournalSummary.date_to == entry_date,
    ).delete()

    db.delete(entry)
    db.commit()
    return None


# ── Chat ───────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str          # "user" o "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatMessage] = []  # historial de la sesión actual


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Chat con IA usando los últimos 7 resúmenes del diario + hábitos + stats como contexto.
    El historial de conversación se pasa desde el frontend (stateless).
    """
    from app.ai import chat_with_context
    from datetime import date, timedelta
    from collections import defaultdict

    # ── Perfil del usuario (bio resumida) ────────────────────────────────────
    user_profile = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.user_id == current_user.id)
        .first()
    )
    bio_summary = user_profile.bio_summary if user_profile and user_profile.bio_summary else None

    # ── Resúmenes del diario (últimos 7) ──────────────────────────────────────
    recent_summaries = (
        db.query(models.JournalSummary)
        .filter(models.JournalSummary.user_id == current_user.id)
        .order_by(models.JournalSummary.date_to.desc())
        .limit(7)
        .all()
    )
    diary_context = [
        f"[{s.date_from}] {s.summary}"
        for s in reversed(recent_summaries)
    ]

    # ── Hábitos activos ───────────────────────────────────────────────────────
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.user_id == current_user.id, models.Habit.is_active.is_(True))
        .order_by(models.Habit.start_time.nulls_last())
        .all()
    )

    DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

    def fmt_days(days_str: str) -> str:
        try:
            days = [int(d) for d in days_str.split(",") if d.strip()]
            return ", ".join(DAY_NAMES[d] for d in sorted(days))
        except Exception:
            return days_str

    habits_lines = []
    for h in habits:
        time_str = f"{h.start_time}–{h.end_time}" if h.start_time else "sin hora"
        habits_lines.append(
            f"  • {h.name} [{h.category}] — {time_str} — días: {fmt_days(h.days_of_week)}"
        )

    # ── Cumplimiento de los últimos 7 días por hábito ────────────────────────
    today = date.today()
    week_dates = [today - timedelta(days=i) for i in range(6, -1, -1)]

    logs_week = (
        db.query(models.HabitLog)
        .filter(
            models.HabitLog.user_id == current_user.id,
            models.HabitLog.date >= week_dates[0],
            models.HabitLog.date <= today,
        )
        .all()
    )
    log_map: dict = defaultdict(dict)  # habit_id -> date -> status
    for log in logs_week:
        log_map[log.habit_id][log.date] = log.status

    # Stats globales rápidas
    all_logs = db.query(models.HabitLog).filter(
        models.HabitLog.user_id == current_user.id
    ).all()
    total_done = sum(1 for l in all_logs if l.status == "done")

    # Racha actual - misma logica que stats.py:
    # solo contar dias donde TODOS los habitos (que existian ese dia) son done/skipped.
    habits_by_wd_chat: dict = {}
    for h in habits:
        for wd_str in h.days_of_week.split(","):
            wd_str = wd_str.strip()
            if wd_str.isdigit():
                wd_int = int(wd_str)
                habits_by_wd_chat.setdefault(wd_int, []).append(h)

    streak = 0
    cursor_d = today
    for _ in range(365):
        wd = cursor_d.isoweekday() % 7
        all_sched = habits_by_wd_chat.get(wd, [])
        sched = [h for h in all_sched if not (h.start_date and cursor_d < h.start_date)]
        if not sched:
            cursor_d -= timedelta(days=1)
            continue
        day_logs_map = {lg.habit_id: lg.status for lg in all_logs if lg.date == cursor_d}
        if all(day_logs_map.get(h.id) in ("done", "skipped") for h in sched):
            streak += 1
            cursor_d -= timedelta(days=1)
        else:
            break

    # Tasa de cumplimiento de la semana
    # - Hoy se excluye: el dia no ha terminado, los habitos pendientes bajan el % injustamente.
    # - Solo cuentan dias >= start_date del habito.
    # - Skipped se excluye de numerador y denominador.
    week_scheduled = week_done = 0
    for d in week_dates:
        if d == today:
            continue  # excluir hoy
        wd = d.isoweekday() % 7
        for h in habits:
            days_set = {int(x) for x in h.days_of_week.split(",") if x.strip()}
            if wd not in days_set:
                continue
            if h.start_date and d < h.start_date:
                continue  # habito no existia ese dia
            status = log_map.get(h.id, {}).get(d)
            if status == "skipped":
                continue
            week_scheduled += 1
            if status == "done":
                week_done += 1
    week_rate = round((week_done / week_scheduled) * 100) if week_scheduled else 0

    # Contexto temporal para la IA: cuantos dias han pasado desde que inicio el habito mas reciente
    newest_habit_date = None
    for h in habits:
        effective_start = h.start_date or h.created_at.date()
        if newest_habit_date is None or effective_start > newest_habit_date:
            newest_habit_date = effective_start
    days_since_newest = (today - newest_habit_date).days if newest_habit_date else None

    history = [{"role": m.role, "content": m.content} for m in payload.history]

    reply = chat_with_context(
        user_message=payload.message,
        context_summaries=diary_context,
        habits_text="\n".join(habits_lines) if habits_lines else "Sin hábitos registrados.",
        stats={
            "racha_actual": streak,
            "cumplimiento_semana": f"{week_rate}%" if week_scheduled else "Sin datos aún (hábitos muy recientes)",
            "total_completados_historico": total_done,
            "habitos_activos": len(habits),
            "dias_desde_inicio": days_since_newest,
            "nota_temporal": (
                f"El usuario lleva solo {days_since_newest} día(s) usando la app. "
                "No evalúes el cumplimiento como si fuera una tendencia consolidada."
            ) if days_since_newest is not None and days_since_newest < 7 else None,
        },
        history=history,
        bio_summary=bio_summary,
    )

    if not reply:
        raise HTTPException(
            status_code=503,
            detail="La IA no está disponible en este momento. Intenta de nuevo.",
        )

    return {"reply": reply}
