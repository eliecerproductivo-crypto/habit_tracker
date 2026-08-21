from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/friends", tags=["friends"])


def get_friendship(db, user_id: int, other_id: int):
    return db.query(models.Friendship).filter(
        or_(
            and_(models.Friendship.requester_id == user_id, models.Friendship.addressee_id == other_id),
            and_(models.Friendship.requester_id == other_id, models.Friendship.addressee_id == user_id),
        )
    ).first()


def compute_stats(db: Session, user: models.User) -> dict:
    logs = db.query(models.HabitLog).filter(
        models.HabitLog.user_id == user.id,
        models.HabitLog.status == "done",
    ).all()

    total_completed = len(logs)

    # Week completion rate
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_logs = [l for l in logs if l.date >= week_start]
    habits = db.query(models.Habit).filter(
        models.Habit.user_id == user.id,
        models.Habit.is_active == True,
    ).all()
    week_days = [(week_start + timedelta(days=i)) for i in range(7) if (week_start + timedelta(days=i)) <= today]
    total_slots = sum(
        1 for h in habits for d in week_days
        if str(d.weekday()) in h.days_of_week.split(",") or h.recurrence_type != "weekly"
    )
    week_completion_rate = round(len(week_logs) / total_slots * 100) if total_slots > 0 else 0

    # Current streak (consecutive days with at least one done log)
    log_dates = sorted({l.date for l in logs}, reverse=True)
    streak = 0
    check = today
    for d in log_dates:
        if d == check:
            streak += 1
            check -= timedelta(days=1)
        elif d < check:
            break

    return {
        "current_streak": streak,
        "week_completion_rate": week_completion_rate,
        "total_completed": total_completed,
    }


@router.post("/request", status_code=status.HTTP_201_CREATED)
def send_request(
    payload: schemas.FriendRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.email == current_user.email:
        raise HTTPException(status_code=400, detail="No puedes agregarte a ti mismo.")

    target = db.query(models.User).filter(models.User.email == payload.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="No existe una cuenta con ese correo.")

    existing = get_friendship(db, current_user.id, target.id)
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Ya son amigos.")
        if existing.status == "pending":
            raise HTTPException(status_code=400, detail="Ya enviaste una solicitud o tienes una pendiente.")

    friendship = models.Friendship(requester_id=current_user.id, addressee_id=target.id)
    db.add(friendship)
    db.commit()
    return {"detail": "Solicitud enviada."}


@router.get("", response_model=list[schemas.FriendshipOut])
def list_friends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = db.query(models.Friendship).filter(
        or_(
            models.Friendship.requester_id == current_user.id,
            models.Friendship.addressee_id == current_user.id,
        )
    ).all()

    result = []
    for f in rows:
        i_am_requester = f.requester_id == current_user.id
        friend = f.addressee if i_am_requester else f.requester
        result.append(schemas.FriendshipOut(
            id=f.id,
            status=f.status,
            friend=schemas.FriendOut.model_validate(friend),
            i_am_requester=i_am_requester,
        ))
    return result


@router.put("/{friendship_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
def accept_request(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    f = db.query(models.Friendship).filter(models.Friendship.id == friendship_id).first()
    if not f or f.addressee_id != current_user.id:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    if f.status != "pending":
        raise HTTPException(status_code=400, detail="La solicitud ya fue procesada.")
    f.status = "accepted"
    db.commit()


@router.put("/{friendship_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_request(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    f = db.query(models.Friendship).filter(models.Friendship.id == friendship_id).first()
    if not f or f.addressee_id != current_user.id:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    f.status = "rejected"
    db.commit()


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    f = db.query(models.Friendship).filter(
        models.Friendship.id == friendship_id,
        or_(
            models.Friendship.requester_id == current_user.id,
            models.Friendship.addressee_id == current_user.id,
        )
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="Amistad no encontrada.")
    db.delete(f)
    db.commit()


@router.get("/leaderboard", response_model=list[schemas.FriendStatsOut])
def leaderboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    friendships = db.query(models.Friendship).filter(
        models.Friendship.status == "accepted",
        or_(
            models.Friendship.requester_id == current_user.id,
            models.Friendship.addressee_id == current_user.id,
        )
    ).all()

    results = []
    # Include yourself
    my_stats = compute_stats(db, current_user)
    results.append(schemas.FriendStatsOut(
        friend=schemas.FriendOut.model_validate(current_user),
        **my_stats,
    ))

    for f in friendships:
        friend = f.addressee if f.requester_id == current_user.id else f.requester
        stats = compute_stats(db, friend)
        results.append(schemas.FriendStatsOut(
            friend=schemas.FriendOut.model_validate(friend),
            **stats,
        ))

    results.sort(key=lambda x: (x.current_streak, x.week_completion_rate), reverse=True)
    return results
