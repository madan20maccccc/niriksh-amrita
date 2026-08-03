from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
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


class GeminiKeyRequest(BaseModel):
    key: str


@router.post("/update-gemini-key")
def update_gemini_key(
    req: GeminiKeyRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Admin only: updates the GEMINI_API_KEY inside .env and current process environment."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can configure system API keys")

    import os
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    # Strip existing GEMINI_API_KEY lines
    lines = [l for l in lines if not l.startswith("GEMINI_API_KEY=")]
    lines.append(f"GEMINI_API_KEY={req.key}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    # Set in current runtime env
    os.environ["GEMINI_API_KEY"] = req.key
    import routes.vital_routes as vr
    vr.GEMINI_API_KEY = req.key

    return {"success": True, "message": "Gemini API key updated successfully."}


class HFTokenRequest(BaseModel):
    token: str

@router.post("/update-hf-token")
def update_hf_token(
    req: HFTokenRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Admin only: updates the HUGGINGFACE_API_KEY inside .env and environment."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can configure system API keys")

    import os
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    lines = [l for l in lines if not l.startswith("HUGGINGFACE_API_KEY=")]
    lines.append(f"HUGGINGFACE_API_KEY={req.token}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    os.environ["HUGGINGFACE_API_KEY"] = req.token
    return {"success": True, "message": "Hugging Face API token updated successfully."}


class AIProviderRequest(BaseModel):
    provider: str  # "gemini" or "huggingface"

@router.post("/update-ai-provider")
def update_ai_provider(
    req: AIProviderRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Admin only: updates the active AI_PROVIDER inside .env and environment."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can configure system API keys")

    if req.provider not in ["gemini", "huggingface"]:
        raise HTTPException(status_code=400, detail="Invalid provider. Choose 'gemini' or 'huggingface'")

    import os
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    lines = [l for l in lines if not l.startswith("AI_PROVIDER=")]
    lines.append(f"AI_PROVIDER={req.provider}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    os.environ["AI_PROVIDER"] = req.provider
    return {"success": True, "message": f"Active AI Provider switched to {req.provider}."}


@router.get("/ai-config")
def get_ai_config(
    current_user: models.User = Depends(get_current_user),
):
    """Returns current active AI configurations."""
    import os
    # Read directly from .env to avoid process sync issues
    gemini_key = ""
    hf_token = ""
    provider = "gemini"
    
    try:
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        gemini_key = line.split("=", 1)[1].strip()
                    elif line.startswith("HUGGINGFACE_API_KEY="):
                        hf_token = line.split("=", 1)[1].strip()
                    elif line.startswith("AI_PROVIDER="):
                        provider = line.split("=", 1)[1].strip()
    except Exception:
        pass
        
    return {
        "gemini_api_key": gemini_key,
        "huggingface_api_key": hf_token,
        "ai_provider": provider
    }


class EmailConfigRequest(BaseModel):
    doctor_email: str
    smtp_user: str = ""
    smtp_pass: str = ""


@router.post("/update-email-config")
def update_email_config(
    req: EmailConfigRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Admin only: saves doctor email and SMTP config to .env"""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can configure system settings")

    import os
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    lines = [l for l in lines if not l.startswith("DOCTOR_EMAIL=") and not l.startswith("SMTP_USER=") and not l.startswith("SMTP_PASS=")]
    lines.append(f"DOCTOR_EMAIL={req.doctor_email}\n")
    if req.smtp_user:
        lines.append(f"SMTP_USER={req.smtp_user}\n")
    if req.smtp_pass:
        lines.append(f"SMTP_PASS={req.smtp_pass}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    os.environ["DOCTOR_EMAIL"] = req.doctor_email
    if req.smtp_user:
        os.environ["SMTP_USER"] = req.smtp_user
    if req.smtp_pass:
        os.environ["SMTP_PASS"] = req.smtp_pass

    return {"success": True, "message": f"Email config saved. Alerts will go to {req.doctor_email}"}


class TestEmailRequest(BaseModel):
    to_email: str


@router.post("/test-email")
def test_email_alert(
    req: TestEmailRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Admin only: sends a test email alert"""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can send test alerts")

    from agents.email_notifier import send_email_alert
    result = send_email_alert(
        patient_name="Test Patient",
        bed_number="DEMO-01",
        news2_score=7,
        risk_level="RED",
        details="This is a test alert from NurseWatch AI. Your email notifications are working correctly!",
        ward_name="Test Ward",
        to_email=req.to_email
    )
    return result
