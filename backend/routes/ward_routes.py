from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[schemas.WardOut])
def list_wards(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return [schemas.WardOut.model_validate(w) for w in db.query(models.Ward).all()]

@router.post("/", response_model=schemas.WardOut)
def create_ward(ward: schemas.WardCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    w = models.Ward(**ward.model_dump())
    db.add(w); db.commit(); db.refresh(w)
    return schemas.WardOut.model_validate(w)

@router.get("/{ward_id}", response_model=schemas.WardOut)
def get_ward(ward_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    w = db.query(models.Ward).filter(models.Ward.id == ward_id).first()
    if not w: raise HTTPException(status_code=404, detail="Ward not found")
    return schemas.WardOut.model_validate(w)
