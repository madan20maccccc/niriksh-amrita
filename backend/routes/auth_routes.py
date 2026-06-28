from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from database import get_db
import models, schemas
from auth import hash_password, verify_password, create_access_token, get_current_user
from agents.audit import audit_login
from datetime import timedelta

router = APIRouter()


@router.post("/login", response_model=schemas.Token)
def login(request: Request, credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account disabled")

    token = create_access_token({"sub": user.email})
    audit_login(db, user.id, user.email, ip_address=request.client.host)

    return schemas.Token(
        access_token=token,
        token_type="bearer",
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/register", response_model=schemas.UserOut)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    """Admin-only: create new users"""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can create users")

    existing = db.query(models.User).filter(
        (models.User.email == user_data.email) | (models.User.employee_id == user_data.employee_id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or Employee ID already exists")

    user = models.User(
        employee_id=user_data.employee_id,
        full_name=user_data.full_name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        department=user_data.department,
        phone=user_data.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.UserOut.model_validate(user)


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserOut.model_validate(current_user)


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    user_data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can edit user accounts")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.full_name = user_data.full_name
    user.email = user_data.email
    user.role = user_data.role
    user.department = user_data.department
    user.phone = user_data.phone

    db.commit()
    db.refresh(user)
    return schemas.UserOut.model_validate(user)


@router.delete("/users/{user_id}")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can deactivate user accounts")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()
    return {"message": f"User {user.full_name} deactivated successfully"}


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    reset_data: schemas.PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can reset passwords")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(reset_data.password)
    db.commit()
    return {"message": f"Password for {user.full_name} reset successfully"}
