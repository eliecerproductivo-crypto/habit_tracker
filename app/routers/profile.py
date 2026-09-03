import csv
import io
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileOut(BaseModel):
    bio: str
    bio_summary: str | None

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    bio: str = Field(max_length=5000)


@router.get("", response_model=ProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        return ProfileOut(bio="", bio_summary=None)
    return profile


@router.put("", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Guarda la bio del usuario. No llama a la IA — eso se hace en /profile/summarize."""
    profile = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.user_id == current_user.id)
        .first()
    )
    if profile:
        profile.bio = payload.bio
        profile.updated_at = datetime.now(timezone.utc)
    else:
        profile = models.UserProfile(
            user_id=current_user.id,
            bio=payload.bio,
        )
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/summarize", response_model=ProfileOut)
def summarize_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Genera un resumen comprimido de la bio usando IA.
    Solo extrae lo relevante para dar contexto al coach.
    """
    from app.ai import summarize_bio

    profile = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.user_id == current_user.id)
        .first()
    )
    if not profile or not profile.bio.strip():
        raise HTTPException(status_code=400, detail="Escribe tu bio antes de resumirla.")

    summary = summarize_bio(profile.bio)
    if not summary:
        raise HTTPException(
            status_code=503,
            detail="La IA no está disponible. Intenta de nuevo.",
        )

    profile.bio_summary = summary
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile


# ──────────────────────────────────────────────────────────────────────────────
# Exportación completa de datos → ZIP con 5 CSVs
# ──────────────────────────────────────────────────────────────────────────────

_MOOD_LABELS = {
    "great": "😄 Excelente",
    "good": "🙂 Bien",
    "neutral": "😐 Neutral",
    "tired": "😴 Cansado/a",
    "hard": "😤 Difícil",
}

_STATUS_LABELS = {
    "done": "Hecho",
    "skipped": "Omitido",
    "failed": "Fallido",
}

_DAYS_MAP = {
    "0": "Dom",
    "1": "Lun",
    "2": "Mar",
    "3": "Mié",
    "4": "Jue",
    "5": "Vie",
    "6": "Sáb",
}


def _make_csv(headers: list[str], rows: list[list]) -> bytes:
    """Genera un CSV codificado en UTF-8 con BOM para compatibilidad con Excel."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8-sig")


@router.get("/export")
def export_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Exporta todos los datos del usuario en un archivo ZIP que contiene 5 CSVs:
      - habitos.csv
      - historial_habitos.csv
      - sesiones_temporizador.csv
      - diario.csv
      - perfil.csv
    """
    uid = current_user.id
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── 1. habitos.csv ──────────────────────────────────────────────────────
    habits = db.query(models.Habit).filter(models.Habit.user_id == uid).all()
    habits_csv = _make_csv(
        [
            "ID",
            "Nombre",
            "Descripción",
            "Categoría",
            "Días",
            "Hora inicio",
            "Hora fin",
            "Duración (min)",
            "Recurrencia",
            "Intervalo (días)",
            "Día del mes",
            "Fecha inicio",
            "Activo",
            "Creado en",
        ],
        [
            [
                h.id,
                h.name,
                h.description or "",
                h.category,
                ", ".join(
                    _DAYS_MAP.get(d.strip(), d.strip())
                    for d in (h.days_of_week or "").split(",")
                    if d.strip()
                ),
                h.start_time or "",
                h.end_time or "",
                h.duration_minutes if h.duration_minutes is not None else "",
                h.recurrence_type,
                h.recurrence_interval if h.recurrence_interval is not None else "",
                h.recurrence_day_of_month if h.recurrence_day_of_month is not None else "",
                str(h.start_date) if h.start_date else "",
                "Sí" if h.is_active else "No",
                h.created_at.strftime("%Y-%m-%d %H:%M") if h.created_at else "",
            ]
            for h in habits
        ],
    )

    # ── 2. historial_habitos.csv ────────────────────────────────────────────
    # Join con Habit para incluir el nombre
    logs = (
        db.query(models.HabitLog, models.Habit.name)
        .join(models.Habit, models.HabitLog.habit_id == models.Habit.id)
        .filter(models.HabitLog.user_id == uid)
        .order_by(models.HabitLog.date.desc())
        .all()
    )
    logs_csv = _make_csv(
        ["Fecha", "Hábito", "Estado", "Estado de ánimo", "Nota", "Registrado en"],
        [
            [
                str(log.date),
                habit_name,
                _STATUS_LABELS.get(log.status, log.status),
                _MOOD_LABELS.get(log.mood, log.mood or ""),
                log.note or "",
                log.logged_at.strftime("%Y-%m-%d %H:%M") if log.logged_at else "",
            ]
            for log, habit_name in logs
        ],
    )

    # ── 3. sesiones_temporizador.csv ────────────────────────────────────────
    sessions = (
        db.query(models.TimerSession)
        .filter(models.TimerSession.user_id == uid)
        .order_by(models.TimerSession.start_time.desc())
        .all()
    )
    # Pre-cargar nombres de hábitos para evitar N+1
    habit_ids = {s.habit_id for s in sessions if s.habit_id}
    habit_names: dict[int, str] = {}
    if habit_ids:
        habit_names = {
            h.id: h.name
            for h in db.query(models.Habit).filter(models.Habit.id.in_(habit_ids)).all()
        }
    sessions_csv = _make_csv(
        [
            "Tipo",
            "Hábito asociado",
            "Inicio",
            "Fin",
            "Minutos dedicados",
            "Notas",
        ],
        [
            [
                s.session_type,
                habit_names.get(s.habit_id, "") if s.habit_id else "",
                s.start_time.strftime("%Y-%m-%d %H:%M") if s.start_time else "",
                s.end_time.strftime("%Y-%m-%d %H:%M") if s.end_time else "",
                round(s.duration_seconds / 60, 1) if s.duration_seconds else 0,
                s.notes or "",
            ]
            for s in sessions
        ],
    )

    # ── 4. diario.csv ───────────────────────────────────────────────────────
    entries = (
        db.query(models.JournalEntry)
        .filter(models.JournalEntry.user_id == uid)
        .order_by(models.JournalEntry.entry_date.desc())
        .all()
    )
    journal_csv = _make_csv(
        ["Fecha", "Reflexión", "Creado en", "Actualizado en"],
        [
            [
                str(e.entry_date),
                e.content,
                e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else "",
                e.updated_at.strftime("%Y-%m-%d %H:%M") if e.updated_at else "",
            ]
            for e in entries
        ],
    )

    # ── 5. perfil.csv ───────────────────────────────────────────────────────
    profile = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.user_id == uid)
        .first()
    )
    profile_csv = _make_csv(
        ["Campo", "Valor"],
        [
            ["Nombre", current_user.name],
            ["Correo", current_user.email],
            ["Cuenta creada", current_user.created_at.strftime("%Y-%m-%d") if current_user.created_at else ""],
            ["Bio", profile.bio if profile else ""],
            ["Resumen IA", profile.bio_summary if profile and profile.bio_summary else ""],
            ["Perfil actualizado", profile.updated_at.strftime("%Y-%m-%d %H:%M") if profile and profile.updated_at else ""],
        ],
    )

    # ── Empaquetar en ZIP ───────────────────────────────────────────────────
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("habitos.csv", habits_csv)
        zf.writestr("historial_habitos.csv", logs_csv)
        zf.writestr("sesiones_temporizador.csv", sessions_csv)
        zf.writestr("diario.csv", journal_csv)
        zf.writestr("perfil.csv", profile_csv)

    return Response(
        content=zip_buf.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="rutina_export_{today_str}.zip"',
        },
    )
