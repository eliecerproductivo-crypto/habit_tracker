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


def _summarize_all_pending_bg(user_id: int):
    """
    Se ejecuta en background al abrir el diario (GET /journal).
    Resume todas las entradas pasadas que aún no tienen resumen.
    Solo se llama a la IA si hay algo pendiente.
    """
    from app.ai import summarize_entries
    from app.database import SessionLocal
    from datetime import date as date_type

    today = date_type.today()
    db = SessionLocal()
    try:
        pending = (
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
            .order_by(models.JournalEntry.entry_date.asc())
            .all()
        )

        if not pending:
            return  # Nada pendiente, sin llamadas a la IA

        for entry in pending:
            summary_text = summarize_entries(f"[{entry.entry_date}] {entry.content}")
            if not summary_text:
                logger.warning("AI summarization returned None for entry %d", entry.id)
                continue
            db.add(models.JournalSummary(
                user_id=user_id,
                summary=summary_text,
                date_from=entry.entry_date,
                date_to=entry.entry_date,
            ))
            db.commit()
            logger.info("Summary saved for user %d, date %s", user_id, entry.entry_date)
    except Exception as e:
        logger.error("Background summarization (all pending) failed: %s", e)
    finally:
        db.close()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=JournalOverview)
def get_journal(
    background_tasks: BackgroundTasks,
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

    # Resumir en background cualquier entrada pasada sin resumen
    background_tasks.add_task(_summarize_all_pending_bg, current_user.id)

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
    Chat con IA usando perfil, hábitos, estadísticas, notas recientes y
    resúmenes del diario como contexto. El historial se pasa desde el frontend (stateless).
    """
    from app.ai import chat_with_context
    from datetime import date, timedelta

    today = date.today()

    # ── 1. Días en la app (desde registro del usuario) ────────────────────────
    days_in_app = (today - current_user.created_at.date()).days

    # ── 2. Perfil del usuario ─────────────────────────────────────────────────
    user_profile = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.user_id == current_user.id)
        .first()
    )
    # Usar resumen IA si existe, si no la bio cruda como fallback
    if user_profile and user_profile.bio_summary:
        bio_summary = user_profile.bio_summary
    elif user_profile and user_profile.bio:
        bio_summary = user_profile.bio[:600]  # limitar para no inflar el prompt
    else:
        bio_summary = None

    # ── 3. Hábitos activos ────────────────────────────────────────────────────
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
        time_str = (
            f"{h.start_time}–{h.end_time}" if h.start_time
            else (f"{h.duration_minutes} min" if h.duration_minutes else "sin hora fija")
        )
        rtype = h.recurrence_type or "weekly"
        if rtype == "interval":
            freq_str = f"cada {h.recurrence_interval} días"
        elif rtype == "monthly":
            freq_str = (
                "último día del mes" if h.recurrence_day_of_month == -1
                else f"día {h.recurrence_day_of_month} del mes"
            )
        else:
            freq_str = f"días: {fmt_days(h.days_of_week)}"

        desc_str = f" — {h.description}" if h.description else ""
        habits_lines.append(
            f"  • {h.name} [{h.category}]{desc_str} — {time_str} — {freq_str}"
        )

    # ── 4. Notas recientes en texto completo (hoy y últimos 3 días) ───────────
    recent_entries = (
        db.query(models.JournalEntry)
        .filter(
            models.JournalEntry.user_id == current_user.id,
            models.JournalEntry.entry_date >= today - timedelta(days=7),
        )
        .order_by(models.JournalEntry.entry_date.asc())
        .all()
    )
    recent_notes_lines = [
        f"  [{e.entry_date}] {e.content}"
        for e in recent_entries
    ]

    # ── 5. Resúmenes del diario (últimos 7, para contexto histórico) ──────────
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

    # ── 6. Estadísticas ───────────────────────────────────────────────────────
    from app.routers.stats import compute_user_stats
    user_stats = compute_user_stats(db, current_user)

    nota_temporal = (
        f"El usuario lleva solo {days_in_app} día(s) en la app. "
        "No evalúes el cumplimiento como si fuera una tendencia consolidada."
    ) if days_in_app < 7 else None

    history = [{"role": m.role, "content": m.content} for m in payload.history]

    reply = chat_with_context(
        user_message=payload.message,
        context_summaries=diary_context,
        habits_text="\n".join(habits_lines) if habits_lines else "Sin hábitos registrados.",
        recent_notes=recent_notes_lines,
        stats={
            "dias_en_app": days_in_app,
            "racha_actual": user_stats.current_streak,
            "mejor_racha": user_stats.best_streak,
            "cumplimiento_semana": f"{user_stats.week_completion_rate}%",
            "total_completados_historico": user_stats.total_completed,
            "habitos_activos": len(habits),
            "nota_temporal": nota_temporal,
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
