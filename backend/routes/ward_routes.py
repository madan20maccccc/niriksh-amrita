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

@router.put("/{ward_id}", response_model=schemas.WardOut)
def update_ward(ward_id: int, ward: schemas.WardCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    w = db.query(models.Ward).filter(models.Ward.id == ward_id).first()
    if not w: raise HTTPException(status_code=404, detail="Ward not found")
    
    for field, value in ward.model_dump().items():
        if hasattr(w, field):
            setattr(w, field, value)
            
    db.commit()
    db.refresh(w)
    return schemas.WardOut.model_validate(w)

@router.delete("/{ward_id}")
def delete_ward(ward_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    w = db.query(models.Ward).filter(models.Ward.id == ward_id).first()
    if not w: raise HTTPException(status_code=404, detail="Ward not found")
    
    # Check if there are active patients in the ward before deleting
    has_patients = db.query(models.Patient).filter(models.Patient.ward_id == ward_id, models.Patient.is_active == True).first()
    if has_patients:
        raise HTTPException(status_code=400, detail="Cannot delete ward with active admitted patients. Discharge patients first.")
        
    db.delete(w)
    db.commit()
    return {"success": True, "message": "Ward deleted successfully"}

