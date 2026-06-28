import os
import json
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def translate_sbar(sbar: dict, target_lang: str) -> dict:
    """
    Multilingual SBAR (Innovation 4) that translates SBAR reports into Tamil, Hindi,
    Malayalam, Telugu, or Kannada using Gemini API translation capabilities.
    """
    supported_langs = {
        "tamil": "Tamil",
        "hindi": "Hindi",
        "malayalam": "Malayalam",
        "telugu": "Telugu",
        "kannada": "Kannada",
        "ta": "Tamil",
        "hi": "Hindi",
        "ml": "Malayalam",
        "te": "Telugu",
        "kn": "Kannada",
    }
    lang_name = supported_langs.get(target_lang.lower())
    if not lang_name:
        return {**sbar, "language": "english"}
        
    if not GEMINI_API_KEY:
        return {**sbar, "language": "english", "translation_error": "Gemini API key not configured for translation."}
        
    try:
        import google.generativeai as genai
        import time
        genai.configure(api_key=GEMINI_API_KEY)

        models_to_try = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash"]

        # Sanitize dictionary values (convert datetime or other non-serializable objects to string)
        serialized_sbar = {}
        from datetime import datetime
        for k, v in sbar.items():
            if isinstance(v, datetime) or hasattr(v, "isoformat"):
                serialized_sbar[k] = v.isoformat() if hasattr(v, "isoformat") else str(v)
            else:
                serialized_sbar[k] = v

        prompt = f"""You are a professional medical translator. 
Translate the following hospital shift handover report (SBAR) from English into {lang_name}.
Ensure you use accurate medical terminology commonly understood by Indian nurses and doctors.
Keep the JSON keys exactly the same.

SBAR REPORT IN ENGLISH:
{json.dumps(serialized_sbar, indent=2)}

Generate the translated SBAR in this exact JSON format:
{{
  "situation": "...",
  "background": "...",
  "assessment": "...",
  "recommendation": "..."
}}

Only output the JSON translation, no extra commentary."""

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                text = response.text.strip()

                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]

                translated_data = json.loads(text)
                return {
                    "situation": translated_data.get("situation", sbar.get("situation")),
                    "background": translated_data.get("background", sbar.get("background")),
                    "assessment": translated_data.get("assessment", sbar.get("assessment")),
                    "recommendation": translated_data.get("recommendation", sbar.get("recommendation")),
                    "language": lang_name.lower(),
                    "translated_by": f"gemini ({model_name})"
                }
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "quota" in err_str.lower():
                    print(f"[Multilingual] {model_name} quota exceeded, trying next...")
                    time.sleep(2)
                    continue
                else:
                    raise

        # All models exceeded quota — return English with notice
        return {
            **sbar,
            "language": "english",
            "translation_error": f"Translation temporarily unavailable (API quota limit reached). Showing English version."
        }

    except Exception as e:
        print(f"[Multilingual Error] Translation failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            **sbar,
            "language": "english",
            "translation_error": f"Translation failed: {str(e)}"
        }
