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
    """
    Compute streak, week_completion_rate, and total_completed for a user.
    Uses the same logic as stats.py:
    - Days convention: JS getDay() (0=Sunday..6=Saturday), stored as comma-separated string.
    - A habit only counts on a day if day >= habit.start_date (or start_date is None).
    - Skipped is neutral (excluded from both numerator and denominator of week rate).
    - Streak: consecutive days where ALL scheduled habits are done or skipped.
    - Week rate: last 6 completed days (today excluded, day not finished yet).
    """
    from collections import defaultdict

    today = date.today()
    MAX_LOOKBACK = 365

    habits = db.query(models.Habit).filter(
        models.Habit.user_id == user.id,
        models.Habit.is_active.is_(True),
    ).all()

    all_logs = db.query(models.HabitLog).filter(
        models.HabitLog.user_id == user.id,
    ).all()

    total_completed = sum(1 for lg in all_logs if lg.status == "done")

    # Build lookup: date -> habit_id -> status
    status_by_date: dict = defaultdict(dict)
    for lg in all_logs:
        status_by_date[lg.date][lg.habit_id] = lg.status

    # Build lookup: weekday (0-6 JS convention) -> [habits]
    habits_by_weekday: dict = defaultdict(list)
    for h in habits:
        for wd_str in h.days_of_week.split(","):
            wd_str = wd_str.strip()
            if wd_str.isdigit():
                habits_by_weekday[int(wd_str)].append(h)

    def day_status(d):
        """True=all done/skipped, False=at least one missing, None=nothing scheduled."""
        wd = d.isoweekday() % 7  # 0=Sun..6=Sat matching JS getDay()
        all_sched = habits_by_weekday.get(wd, [])
        sched = [h for h in all_sched if not (h.start_date and d < h.start_date)]
        if not sched:
            return None
        day_logs = status_by_date.get(d, {})
        for h in sched:
            s = day_logs.get(h.id)
            if s in ("done", "skipped"):
                continue
            return False
        return True

    # Current streak (walk backwards from today)
    current_streak = 0
    cursor = today
    for _ in range(MAX_LOOKBACK):
        st = day_status(cursor)
        if st is None:
            cursor -= timedelta(days=1)
            continue
        if st is True:
            current_streak += 1
            cursor -= timedelta(days=1)
        else:
            break

    # Week completion rate: last 6 days (today excluded)
    week_scheduled = 0
    week_done = 0
    for i in range(1, 7):
        d = today - timedelta(days=i)
        wd = d.isoweekday() % 7
        for h in habits_by_weekday.get(wd, []):
            if h.start_date and d < h.start_date:
                continue
            s = status_by_date.get(d, {}).get(h.id)
            if s == "skipped":
                continue
            week_scheduled += 1
            if s == "done":
                week_done += 1
    week_completion_rate = round((week_done / week_scheduled) * 100) if week_scheduled else 0

    return {
        "current_streak": current_streak,
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
