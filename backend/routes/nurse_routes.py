from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[schemas.UserOut])
def list_nurses(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    nurses = db.query(models.User).filter(
        models.User.role.in_([models.UserRole.nurse, models.UserRole.supervisor])
    ).all()
    return [schemas.UserOut.model_validate(n) for n in nurses]

@router.get("/{nurse_id}", response_model=schemas.UserOut)
def get_nurse(nurse_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from fastapi import HTTPException
    n = db.query(models.User).filter(models.User.id == nurse_id).first()
    if not n: raise HTTPException(status_code=404, detail="Nurse not found")
    return schemas.UserOut.model_validate(n)
