"""
Telegram Notifier Agent — Agent 17
Sends FREE unlimited alert messages via Telegram Bot API.
100% free, no limits, no API keys to buy. Works forever.

Setup (one-time, 30 seconds):
1. Open Telegram, search @BotFather, type /newbot
2. Give it a name like "NirikshAmrita Alert Bot"  
3. Copy the bot token (looks like: 123456:ABC-DEF...)
4. Save it in Settings page
5. Doctor opens: https://t.me/<bot_username> and clicks START
6. Done! Alerts flow automatically with beep + vibration.
"""

import os
import urllib.request
import urllib.parse
import json

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_IDS  = os.getenv("TELEGRAM_CHAT_IDS", "")  # comma-separated chat IDs


def get_bot_updates(token: str = "") -> dict:
    """Get recent messages to the bot (to discover chat IDs)."""
    tok = token or TELEGRAM_BOT_TOKEN
    if not tok:
        return {"success": False, "message": "Bot token not configured."}
    
    url = f"https://api.telegram.org/bot{tok}/getUpdates"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data.get("ok"):
                chat_ids = set()
                for update in data.get("result", []):
                    msg = update.get("message", {})
                    chat = msg.get("chat", {})
                    if chat.get("id"):
                        chat_ids.add(str(chat["id"]))
                return {
                    "success": True,
                    "chat_ids": list(chat_ids),
                    "message": f"Found {len(chat_ids)} user(s) who started the bot."
                }
            return {"success": False, "message": str(data)}
    except Exception as e:
        return {"success": False, "message": f"Telegram API error: {str(e)}"}


def send_telegram_alert(
    patient_name: str,
    bed_number: str,
    news2_score: int,
    risk_level: str,
    details: str,
    ward_name: str = "Unknown Ward",
    custom_chat_id: str = "",
) -> dict:
    """Send a Telegram alert message. 100% FREE, unlimited."""
    # Re-read keys dynamically from .env so they update immediately
    bot_token = ""
    chat_ids_str = ""
    try:
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as env_f:
                for line in env_f:
                    if line.startswith("TELEGRAM_BOT_TOKEN="):
                        bot_token = line.split("=", 1)[1].strip()
                    elif line.startswith("TELEGRAM_CHAT_IDS="):
                        chat_ids_str = line.split("=", 1)[1].strip()
    except Exception:
        pass

    if not bot_token:
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN", TELEGRAM_BOT_TOKEN)
    if not chat_ids_str:
        chat_ids_str = os.getenv("TELEGRAM_CHAT_IDS", TELEGRAM_CHAT_IDS)

    if not bot_token:
        return {"success": False, "message": "Telegram bot token not configured."}

    # Build recipient list
    recipients = []
    if custom_chat_id:
        recipients.append(custom_chat_id)
    if chat_ids_str:
        recipients.extend([cid.strip() for cid in chat_ids_str.split(",") if cid.strip()])
    
    if not recipients:
        return {"success": False, "message": "No Telegram chat IDs configured. Doctor must open the bot link and click START."}

    # Build rich message
    risk_emoji = "🔴" if risk_level == "RED" else "🟠" if risk_level == "ORANGE" else "🟡"
    text = (
        f"{risk_emoji} *CLINICAL ALERT — NirikshAmrita*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Patient:* {patient_name}\n"
        f"🛏 *Bed:* {bed_number} | {ward_name}\n"
        f"📊 *NEWS2 Score:* {news2_score} — *{risk_level} RISK*\n"
        f"⚠️ *Alert:* {details[:200]}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"_Immediate clinical review required._\n"
        f"_— Amrita Hospital Surveillance System_"
    )

    sent_count = 0
    last_error = ""
    
    for chat_id in set(recipients):
        result = _send_message(chat_id, text, bot_token)
        if result.get("success"):
            sent_count += 1
        else:
            last_error = result.get("message", "Unknown error")

    if sent_count > 0:
        print(f"[Telegram] SUCCESS: Alert sent to {sent_count} recipient(s)")
        return {"success": True, "message": f"Telegram alert sent to {sent_count} doctor(s)!"}
    else:
        print(f"[Telegram] ERROR: Failed to send - {last_error}")
        return {"success": False, "message": last_error}


def send_test_telegram(token: str = "", chat_id: str = "") -> dict:
    """Send a test message to verify the bot works."""
    tok = token or TELEGRAM_BOT_TOKEN
    if not tok:
        return {"success": False, "message": "Bot token required."}
    if not chat_id:
        return {"success": False, "message": "Chat ID required. Doctor must open the bot and click START first."}
    
    text = (
        "✅ *NirikshAmrita — Test Message*\n\n"
        "Your Telegram alert system is working!\n"
        "Critical patient alerts will now be delivered here.\n\n"
        "_Messages arrive with sound and vibration._\n"
        "_— Amrita Hospital_"
    )
    
    return _send_message(chat_id, text, tok)


def _send_message(chat_id: str, text: str, token: str = "") -> dict:
    """Low-level: send a single Telegram message."""
    tok = token or TELEGRAM_BOT_TOKEN
    url = f"https://api.telegram.org/bot{tok}/sendMessage"
    
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json"
    })

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data.get("ok"):
                return {"success": True, "message": "Message sent!"}
            return {"success": False, "message": str(data.get("description", "Unknown error"))}
    except Exception as e:
        return {"success": False, "message": f"Connection error: {str(e)}"}
