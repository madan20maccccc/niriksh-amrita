import os
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

DEFAULT_DOCTOR_EMAIL = "madan.m200607@gmail.com"
RESEND_ACCOUNT_EMAIL = "madanthegreat39@gmail.com"

def send_email_alert(
    patient_name: str,
    bed_number: str,
    news2_score: int,
    risk_level: str,
    details: str,
    ward_name: str,
    to_email: str = None
) -> dict:
    """
    Sends an automated clinical alert email to the assigned doctor using Resend API.
    Falls back to SMTP if configured, or writing to a local audit log file.
    """
    target_email = to_email or os.getenv("DOCTOR_EMAIL", DEFAULT_DOCTOR_EMAIL)
        
    subject = f"[CRITICAL ALERT] {risk_level} Risk - Patient {patient_name} (Bed {bed_number})"
    
    body = f"""🏥 NURSEWATCH AI - CLINICAL ALERT SYSTEM
===================================================
Timestamp: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Patient Name: {patient_name}
Bed Number: {bed_number}
Ward/Location: {ward_name}

NEWS2 Score: {news2_score}
Risk Classification: {risk_level}

ALERT DETAILS:
{details}
===================================================
This is an automated clinical notification. Please review the patient immediately.
— NirikshAmrita Hospital Alert System
"""

    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()

    # 1. Try sending via Resend API (Fast & Reliable)
    if resend_api_key:
        recipients = [target_email]
        # If target_email is different, we try target_email first
        try:
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "from": "NirikshAmrita Alert <onboarding@resend.dev>",
                "to": recipients,
                "subject": subject,
                "text": body
            }
            response = httpx.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code in [200, 201]:
                res_data = response.json()
                print(f"[Email Notifier - Resend] Real email alert successfully sent to {target_email}. ID: {res_data.get('id')}")
                return {
                    "success": True,
                    "simulated": False,
                    "provider": "resend",
                    "message": f"Real email alert sent via Resend to {target_email}",
                    "id": res_data.get("id")
                }
            elif response.status_code == 403 and target_email != RESEND_ACCOUNT_EMAIL:
                # Resend free tier restricts test sending to account owner email (madanthegreat39@gmail.com)
                print(f"[Email Notifier - Resend] Testing restriction: redirecting to Resend account owner ({RESEND_ACCOUNT_EMAIL})")
                payload["to"] = [RESEND_ACCOUNT_EMAIL]
                payload["subject"] = f"[FOR: {target_email}] {subject}"
                res2 = httpx.post(url, headers=headers, json=payload, timeout=10.0)
                if res2.status_code in [200, 201]:
                    res_data2 = res2.json()
                    print(f"[Email Notifier - Resend] Sent to {RESEND_ACCOUNT_EMAIL}. ID: {res_data2.get('id')}")
                    return {
                        "success": True,
                        "simulated": False,
                        "provider": "resend",
                        "message": f"Real email alert sent via Resend to {RESEND_ACCOUNT_EMAIL} (Resend test account)",
                        "id": res_data2.get("id")
                    }
            else:
                print(f"[Email Notifier - Resend Warning] Status {response.status_code}: {response.text}")
        except Exception as resend_err:
            print(f"[Email Notifier - Resend Error] {resend_err}")

    # 2. Fallback to SMTP if configured
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_user
            msg["To"] = target_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, target_email, msg.as_string())
            server.quit()
            
            print(f"[Email Notifier - SMTP] Real email alert successfully sent to {target_email}")
            return {
                "success": True, 
                "simulated": False, 
                "provider": "smtp",
                "message": f"Real email alert sent via SMTP to {target_email}"
            }
        except Exception as e:
            print(f"[Email Notifier - SMTP Error] {e}")

    # 3. Log fallback
    log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "emails_sent_log.txt")
    log_entry = f"--- EMAIL SENT TO {target_email} ---\nSubject: {subject}\n{body}\n\n"
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as log_err:
        print(f"[Email Notifier] Logging failed: {log_err}")

    return {
        "success": True, 
        "simulated": True, 
        "message": f"Email alert logged to emails_sent_log.txt for {target_email}"
    }
