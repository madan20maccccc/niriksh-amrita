"""
SMS Notifier Agent — Agent 16
Sends real carrier SMS text messages directly to the doctor's native Messages app.
Supports:
1. Twilio SMS Gateway (requires Account SID, Auth Token, and Sender number in .env)
2. Textbelt Free API Gateway (zero config, sends 1 free carrier SMS message per day, no login required)
"""

import os
import urllib.request
import urllib.parse
import urllib.error
import json
import base64

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN  = os.getenv("TWILIO_AUTH_TOKEN",  "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")


def send_sms_alert(
    to_phone: str,
    patient_name: str,
    bed_number: str,
    news2_score: int,
    risk_level: str,
    details: str,
    ward_name: str = "Unknown Ward",
) -> dict:
    """
    Send a real carrier SMS message directly to the doctor's phone.
    """
    if not to_phone:
        return {"success": False, "message": "Recipient phone number is required."}

    # Format the SMS message (keep under 160 characters to fit in 1 SMS segment)
    emoji = "🚨" if risk_level == "RED" else "⚠️"
    text = (
        f"{emoji} NirikshAmrita Alert\n"
        f"Patient: {patient_name}\n"
        f"Bed: {bed_number} ({ward_name})\n"
        f"NEWS2: {news2_score} ({risk_level})\n"
        f"Alert: {details}\n"
        f"Immediate review required."
    )

    # 1. Try Twilio if configured
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER:
        print(f"[SMS] Using Twilio Gateway to send alert to {to_phone}...")
        return _send_via_twilio(to_phone, text)

    # 2. Fallback to Textbelt Free API (1 free SMS per day)
    print(f"[SMS] Using Textbelt Free Gateway to send alert to {to_phone}...")
    return _send_via_textbelt(to_phone, text)


def _send_via_twilio(to_phone: str, message: str) -> dict:
    # Ensure format has '+'
    to_number = to_phone if to_phone.startswith("+") else f"+{to_phone}"
    from_number = TWILIO_FROM_NUMBER if TWILIO_FROM_NUMBER.startswith("+") else f"+{TWILIO_FROM_NUMBER}"

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    
    payload = urllib.parse.urlencode({
        "To": to_number,
        "From": from_number,
        "Body": message
    }).encode("utf-8")
    
    auth_str = f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}"
    auth_header = "Basic " + base64.b64encode(auth_str.encode("ascii")).decode("ascii")

    req = urllib.request.Request(url, data=payload, headers={
        "Authorization": auth_header,
        "Content-Type": "application/x-www-form-urlencoded"
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            if response.status == 201 or res_json.get("sid"):
                print(f"[SMS] ✅ Alert sent via Twilio: {res_json.get('sid')}")
                return {"success": True, "message": "SMS alert sent via Twilio!"}
            return {"success": False, "message": f"Twilio returned status {response.status}"}
    except Exception as e:
        print(f"[SMS] ❌ Twilio failed: {e}")
        return {"success": False, "message": f"Twilio error: {str(e)}"}


def _send_via_textbelt(to_phone: str, message: str) -> dict:
    # Textbelt expects international phone number format (e.g. +919876543210 or 919876543210)
    phone_clean = to_phone.replace("+", "").replace(" ", "")
    
    url = "https://textbelt.com/text"
    payload = urllib.parse.urlencode({
        "phone": phone_clean,
        "message": message,
        "key": "textbelt"
    }).encode("utf-8")
    
    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/x-www-form-urlencoded"
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            if res_json.get("success"):
                print(f"[SMS] ✅ SMS sent via Textbelt: quota remaining {res_json.get('quotaRemaining')}")
                return {"success": True, "message": f"SMS sent via Textbelt! (Remaining quota: {res_json.get('quotaRemaining')})"}
            else:
                err_msg = res_json.get("error", "Quota exceeded or daily limit hit.")
                print(f"[SMS] ⚠️ Textbelt rejected: {err_msg}")
                return {"success": False, "message": err_msg}
    except Exception as e:
        print(f"[SMS] ❌ Textbelt connection failed: {e}")
        return {"success": False, "message": f"SMS connection failed: {str(e)}"}
