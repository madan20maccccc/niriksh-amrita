from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
import models, schemas, os
from auth import get_current_user
from agents.closure import acknowledge_alert
from agents.audit import audit_alert_acknowledged
from agents.whatsapp_notifier import send_test_message
from agents.sms_notifier import send_sms_alert
from agents.telegram_notifier import send_telegram_alert, send_test_telegram, get_bot_updates
from websocket_manager import manager

router = APIRouter()

class TelegramConfig(BaseModel):
    bot_token: str
    chat_ids: str

class TelegramTestRequest(BaseModel):
    chat_id: str
    bot_token: Optional[str] = ""



class SMSConfig(BaseModel):
    twilio_sid: str
    twilio_token: str
    twilio_from: str


class SMSTestRequest(BaseModel):
    to_phone: str
    twilio_sid: Optional[str] = ""
    twilio_token: Optional[str] = ""
    twilio_from: Optional[str] = ""


class Fast2SMSConfig(BaseModel):
    api_key: str


class Fast2SMSTestRequest(BaseModel):
    to_phone: str
    api_key: Optional[str] = ""



class WhatsAppConfig(BaseModel):
    phone: str
    apikey: str


class WhatsAppTestRequest(BaseModel):
    phone: str
    apikey: str


@router.get("/", response_model=List[schemas.AlertOut])
def list_alerts(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    patient_id: Optional[int] = None,
    ward_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Alert)

    if status:
        query = query.filter(models.Alert.status == status)
    if risk_level:
        query = query.filter(models.Alert.risk_level == risk_level)
    if patient_id:
        query = query.filter(models.Alert.patient_id == patient_id)
    if ward_id:
        # Filter alerts where patient is in that ward
        patient_ids = [
            p.id for p in db.query(models.Patient).filter(models.Patient.ward_id == ward_id).all()
        ]
        query = query.filter(models.Alert.patient_id.in_(patient_ids))

    alerts = query.order_by(models.Alert.created_at.desc()).limit(limit).all()
    return [schemas.AlertOut.model_validate(a) for a in alerts]


@router.post("/{alert_id}/acknowledge", response_model=schemas.AlertOut)
async def acknowledge_alert_endpoint(
    alert_id: int,
    ack_data: schemas.AlertAcknowledge,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    alert = acknowledge_alert(db, alert_id, current_user.id, ack_data.action_taken)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Audit
    audit_alert_acknowledged(db, current_user.id, alert.patient_id, alert_id, ack_data.action_taken)

    # Broadcast
    patient = db.query(models.Patient).filter(models.Patient.id == alert.patient_id).first()
    if patient:
        background_tasks.add_task(
            manager.broadcast_alert_acknowledged,
            str(patient.ward_id),
            alert_id,
            current_user.full_name,
        )

    return schemas.AlertOut.model_validate(alert)


@router.get("/patient/{patient_id}", response_model=List[schemas.AlertOut])
def get_patient_alerts(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    alerts = (
        db.query(models.Alert)
        .filter(models.Alert.patient_id == patient_id)
        .order_by(models.Alert.created_at.desc())
        .limit(20)
        .all()
    )
    return [schemas.AlertOut.model_validate(a) for a in alerts]


@router.get("/active/count")
def active_alert_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from sqlalchemy import func
    counts = (
        db.query(models.Alert.risk_level, func.count(models.Alert.id))
        .filter(models.Alert.status == models.AlertStatus.active)
        .group_by(models.Alert.risk_level)
        .all()
    )
    return {level.value: count for level, count in counts}


@router.post("/whatsapp/test")
def test_whatsapp(
    req: WhatsAppTestRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Send a test WhatsApp message to verify CallMeBot setup."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    result = send_test_message(req.phone, req.apikey)
    return result


@router.post("/whatsapp/save-config")
def save_whatsapp_config(
    cfg: WhatsAppConfig,
    current_user: models.User = Depends(get_current_user),
):
    """Save WhatsApp phone + apikey to .env file (persists between restarts)."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")

    # Read existing .env
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    # Remove old WhatsApp lines
    lines = [l for l in lines if not l.startswith("WHATSAPP_PHONE=") and not l.startswith("WHATSAPP_APIKEY=")]
    lines.append(f"WHATSAPP_PHONE={cfg.phone}\n")
    lines.append(f"WHATSAPP_APIKEY={cfg.apikey}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    # Also update environment for current process
    import agents.whatsapp_notifier as wn
    wn.WHATSAPP_PHONE  = cfg.phone
    wn.WHATSAPP_APIKEY = cfg.apikey

    return {"success": True, "message": "WhatsApp configuration saved. Alerts will now be sent to +" + cfg.phone}


@router.get("/whatsapp/config")
def get_whatsapp_config(current_user: models.User = Depends(get_current_user)):
    """Get current WhatsApp config (masked)."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    phone  = os.getenv("WHATSAPP_PHONE",  "")
    apikey = os.getenv("WHATSAPP_APIKEY", "")
    return {
        "configured": bool(phone and apikey),
        "phone":  phone[:4] + "****" + phone[-2:] if len(phone) > 6 else "",
        "apikey": apikey[:4] + "****" if len(apikey) > 4 else "",
    }


@router.post("/sms/test")
def test_sms(
    req: SMSTestRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Send a test SMS message to verify setup (Twilio or Textbelt)."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Temporarily set credentials if testing specific config
    if req.twilio_sid and req.twilio_token and req.twilio_from:
        import agents.sms_notifier as sn
        sn.TWILIO_ACCOUNT_SID = req.twilio_sid
        sn.TWILIO_AUTH_TOKEN = req.twilio_token
        sn.TWILIO_FROM_NUMBER = req.twilio_from
        
    result = send_sms_alert(
        to_phone=req.to_phone,
        patient_name="Test Patient",
        bed_number="Bed-99",
        news2_score=7,
        risk_level="RED",
        details="SMS Telemetry Test Message",
        ward_name="Emergency"
    )
    return result


@router.post("/sms/save-config")
def save_sms_config(
    cfg: SMSConfig,
    current_user: models.User = Depends(get_current_user),
):
    """Save Twilio SMS config to .env file (persists between restarts)."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    # Strip existing Twilio lines
    lines = [l for l in lines if not l.startswith("TWILIO_ACCOUNT_SID=") and not l.startswith("TWILIO_AUTH_TOKEN=") and not l.startswith("TWILIO_FROM_NUMBER=")]
    lines.append(f"TWILIO_ACCOUNT_SID={cfg.twilio_sid}\n")
    lines.append(f"TWILIO_AUTH_TOKEN={cfg.twilio_token}\n")
    lines.append(f"TWILIO_FROM_NUMBER={cfg.twilio_from}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    # Set in current runtime env
    import agents.sms_notifier as sn
    sn.TWILIO_ACCOUNT_SID = cfg.twilio_sid
    sn.TWILIO_AUTH_TOKEN  = cfg.twilio_token
    sn.TWILIO_FROM_NUMBER = cfg.twilio_from

    return {"success": True, "message": "SMS Twilio Configuration saved successfully."}


@router.get("/sms/config")
def get_sms_config(current_user: models.User = Depends(get_current_user)):
    """Get current Twilio SMS configuration (masked)."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    sid   = os.getenv("TWILIO_ACCOUNT_SID", "")
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    frm   = os.getenv("TWILIO_FROM_NUMBER", "")
    return {
        "configured": bool(sid and token and frm),
        "twilio_sid": sid[:6] + "****" if len(sid) > 6 else "",
        "twilio_from": frm[:4] + "****" + frm[-2:] if len(frm) > 6 else "",
    }


# ─── FAST2SMS (FREE INDIA) ────────────────────────────────────────────

@router.post("/sms/fast2sms/save-config")
def save_fast2sms_config(
    cfg: Fast2SMSConfig,
    current_user: models.User = Depends(get_current_user),
):
    """Save Fast2SMS API key to .env (free Indian SMS gateway)."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    lines = [l for l in lines if not l.startswith("FAST2SMS_API_KEY=")]
    lines.append(f"FAST2SMS_API_KEY={cfg.api_key}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    import agents.sms_notifier as sn
    sn.FAST2SMS_API_KEY = cfg.api_key
    os.environ["FAST2SMS_API_KEY"] = cfg.api_key

    return {"success": True, "message": "Fast2SMS API key saved! Free Indian SMS alerts are now active."}


@router.post("/sms/fast2sms/test")
def test_fast2sms(
    req: Fast2SMSTestRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Send a test SMS via Fast2SMS free Indian gateway."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")

    import agents.sms_notifier as sn
    if req.api_key:
        sn.FAST2SMS_API_KEY = req.api_key

    result = send_sms_alert(
        to_phone=req.to_phone,
        patient_name="Test Patient",
        bed_number="Test-Bed",
        news2_score=8,
        risk_level="RED",
        details="This is a test SMS from NirikshAmrita hospital system.",
        ward_name="Emergency"
    )
    return result


@router.get("/sms/fast2sms/config")
def get_fast2sms_config(current_user: models.User = Depends(get_current_user)):
    """Get current Fast2SMS config status."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    key = os.getenv("FAST2SMS_API_KEY", "")
    return {
        "configured": bool(key),
        "api_key": key[:6] + "****" if len(key) > 6 else "",
    }


# ─── TELEGRAM BOT ALERTS (FREE & UNLIMITED) ───────────────────────────

@router.post("/telegram/save-config")
def save_telegram_config(
    cfg: TelegramConfig,
    current_user: models.User = Depends(get_current_user),
):
    """Save Telegram Bot Token and Chat IDs to .env file."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, "r") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    lines = [l for l in lines if not l.startswith("TELEGRAM_BOT_TOKEN=") and not l.startswith("TELEGRAM_CHAT_IDS=")]
    lines.append(f"TELEGRAM_BOT_TOKEN={cfg.bot_token}\n")
    lines.append(f"TELEGRAM_CHAT_IDS={cfg.chat_ids}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    import agents.telegram_notifier as tn
    tn.TELEGRAM_BOT_TOKEN = cfg.bot_token
    tn.TELEGRAM_CHAT_IDS = cfg.chat_ids
    os.environ["TELEGRAM_BOT_TOKEN"] = cfg.bot_token
    os.environ["TELEGRAM_CHAT_IDS"] = cfg.chat_ids

    return {"success": True, "message": "Telegram Bot Configuration saved successfully."}


@router.post("/telegram/test")
def test_telegram(
    req: TelegramTestRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Send a test message to a Telegram chat ID."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")

    result = send_test_telegram(token=req.bot_token, chat_id=req.chat_id)
    return result


@router.get("/telegram/config")
def get_telegram_config(current_user: models.User = Depends(get_current_user)):
    """Get current Telegram Bot configuration status."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_ids = os.getenv("TELEGRAM_CHAT_IDS", "")
    return {
        "configured": bool(token and chat_ids),
        "bot_token": token[:6] + "****" if len(token) > 6 else "",
        "chat_ids": chat_ids,
    }


@router.get("/telegram/discover-chats")
def discover_telegram_chats(
    token: Optional[str] = "",
    current_user: models.User = Depends(get_current_user)
):
    """Call Telegram getUpdates to automatically find active chat IDs."""
    if current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return get_bot_updates(token)

