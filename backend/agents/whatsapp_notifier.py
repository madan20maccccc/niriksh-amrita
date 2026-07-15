"""
WhatsApp Notifier — Agent 15
Sends real WhatsApp messages via CallMeBot free API.

Setup (one-time per recipient):
  The person who wants to receive alerts must:
  1. Save +34 644 10 30 77 in their WhatsApp contacts as "CallMeBot"
  2. Send this message to that number: "I allow callmebot to send me messages"
  3. They will receive an API key within 2 minutes
  4. Put that key in .env as WHATSAPP_APIKEY
  5. Put their phone number (international, no +) as WHATSAPP_PHONE

This is 100% free, no business account required.
"""

import os
import urllib.request
import urllib.parse
import urllib.error

WHATSAPP_PHONE  = os.getenv("WHATSAPP_PHONE",  "")
WHATSAPP_APIKEY = os.getenv("WHATSAPP_APIKEY", "")


def send_whatsapp_alert(
    patient_name: str,
    bed_number: str,
    news2_score: int,
    risk_level: str,
    details: str,
    ward_name: str = "Unknown Ward",
    custom_phone: str = "",
    custom_apikey: str = "",
) -> dict:
    """
    Send a real WhatsApp message to the duty doctor/nurse via CallMeBot.
    Returns a dict with success: True/False and message.
    """
    phone = custom_phone or WHATSAPP_PHONE
    apikey = custom_apikey or WHATSAPP_APIKEY

    if not phone or not apikey:
        return {
            "success": False,
            "message": "WhatsApp not configured. Set phone number and API key in settings.",
        }

    emoji = "🔴" if risk_level == "RED" else "🟠"
    text = (
        f"{emoji} *CLINICAL ALERT — NirikshAmrita*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Patient:* {patient_name}\n"
        f"🛏 *Bed:* {bed_number} | {ward_name}\n"
        f"📊 *NEWS2 Score:* {news2_score} — *{risk_level} RISK*\n"
        f"⚠️ *Alert:* {details}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Immediate clinical review required.\n"
        f"_— Amrita Hospital Surveillance System_"
    )

    encoded_text = urllib.parse.quote(text)
    url = (
        f"https://api.callmebot.com/whatsapp.php"
        f"?phone={phone}"
        f"&text={encoded_text}"
        f"&apikey={apikey}"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NirikshAmrita/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8", errors="ignore")
            if response.status == 200 and "Message queued" in body:
                print(f"[WhatsApp] ✅ Alert sent to +{WHATSAPP_PHONE}: {patient_name} NEWS2={news2_score}")
                return {"success": True, "message": "WhatsApp alert sent successfully"}
            else:
                print(f"[WhatsApp] ⚠️ Unexpected response: {body[:200]}")
                return {"success": False, "message": f"Unexpected response: {body[:100]}"}
    except urllib.error.URLError as e:
        print(f"[WhatsApp] ❌ Network error: {e}")
        return {"success": False, "message": f"Network error: {str(e)}"}
    except Exception as e:
        print(f"[WhatsApp] ❌ Error: {e}")
        return {"success": False, "message": str(e)}


def send_test_message(phone: str, apikey: str) -> dict:
    """Test endpoint — send a sample message to verify setup."""
    text = (
        "✅ *NirikshAmrita — Test Message*\n"
        "Your WhatsApp alert system is configured correctly!\n"
        "Critical patient alerts will now be delivered here.\n"
        "_— Amrita Hospital_"
    )
    encoded_text = urllib.parse.quote(text)
    url = (
        f"https://api.callmebot.com/whatsapp.php"
        f"?phone={phone}"
        f"&text={encoded_text}"
        f"&apikey={apikey}"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NirikshAmrita/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8", errors="ignore")
            if response.status == 200:
                return {"success": True, "message": "Test message sent! Check your WhatsApp."}
            return {"success": False, "message": body[:200]}
    except Exception as e:
        return {"success": False, "message": str(e)}
