from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
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
