from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db
from app.schemas import TodoCreate, TodoOut, TodoUpdate

router = APIRouter(prefix="/todos", tags=["todos"])


@router.get("", response_model=list[TodoOut])
def list_todos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Devuelve todas las tareas del usuario, pendientes primero, luego por fecha de creación."""
    return (
        db.query(models.TodoItem)
        .filter(models.TodoItem.user_id == current_user.id)
        .order_by(models.TodoItem.done.asc(), models.TodoItem.created_at.desc())
        .all()
    )


@router.post("", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(
    payload: TodoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = models.TodoItem(
        user_id=current_user.id,
        text=payload.text,
        due_date=payload.due_date,
        priority=payload.priority,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = (
        db.query(models.TodoItem)
        .filter(models.TodoItem.id == todo_id, models.TodoItem.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")

    if payload.text is not None:
        item.text = payload.text
    if payload.done is not None:
        item.done = payload.done
    if payload.due_date is not None:
        item.due_date = payload.due_date
    if payload.priority is not None:
        item.priority = payload.priority

    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = (
        db.query(models.TodoItem)
        .filter(models.TodoItem.id == todo_id, models.TodoItem.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")

    db.delete(item)
    db.commit()
    return None


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_done_todos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Elimina todas las tareas ya completadas del usuario."""
    db.query(models.TodoItem).filter(
        models.TodoItem.user_id == current_user.id,
        models.TodoItem.done.is_(True),
    ).delete()
    db.commit()
    return None
