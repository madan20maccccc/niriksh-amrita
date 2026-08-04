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
        
    # Load keys dynamically to support settings updates
    gemini_key = ""
    hf_token = ""
    try:
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        gemini_key = line.split("=", 1)[1].strip()
                    elif line.startswith("HUGGINGFACE_API_KEY="):
                        hf_token = line.split("=", 1)[1].strip()
    except Exception:
        pass

    if not gemini_key:
        gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not hf_token:
        hf_token = os.getenv("HF_TOKEN", "") or os.getenv("HUGGINGFACE_API_KEY", "")

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

    # 1. Attempt Google Gemini translation
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)

            models_to_try = [
                "gemini-2.0-flash",
                "gemini-flash-latest",
                "gemini-pro-latest",
                "gemini-2.5-flash", 
                "gemini-2.5-flash-lite", 
                "gemini-1.5-flash", 
                "gemini-1.5-pro"
            ]

            for model_name in models_to_try:
                try:
                    model = genai.GenerativeModel(model_name)
                    response = model.generate_content(prompt)
                    text = response.text.strip()

                    if text.startswith("```"):
                        text = text.split("```")[1]
                        if text.startswith("json"):
                            text = text[4:]

                    translated_data = json.loads(text.strip())
                    return {
                        "situation": translated_data.get("situation", sbar.get("situation")),
                        "background": translated_data.get("background", sbar.get("background")),
                        "assessment": translated_data.get("assessment", sbar.get("assessment")),
                        "recommendation": translated_data.get("recommendation", sbar.get("recommendation")),
                        "language": lang_name.lower(),
                        "translated_by": f"Google Gemini ({model_name})"
                    }
                except Exception as e:
                    print(f"[Multilingual] Gemini model {model_name} failed: {e}. Trying next...")
                    continue
        except Exception as gemini_err:
            print(f"[Multilingual] Gemini initialization error: {gemini_err}")

    # 2. Attempt Hugging Face router translation (Llama 3.1 8B - fast & reliable)
    if hf_token and hf_token != "hf_placeholder":
        try:
            import httpx

            url = "https://router.huggingface.co/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {hf_token}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "meta-llama/Llama-3.1-8B-Instruct",
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }

            print(f"[Multilingual] Querying Hugging Face Llama 3.1 8B for SBAR translation to {lang_name}...")
            response = httpx.post(url, headers=headers, json=payload, timeout=30.0, verify=False)
            response.raise_for_status()
            res_json = response.json()
            text = res_json["choices"][0]["message"]["content"].strip()

            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]

            translated_data = json.loads(text.strip())
            return {
                "situation": translated_data.get("situation", sbar.get("situation")),
                "background": translated_data.get("background", sbar.get("background")),
                "assessment": translated_data.get("assessment", sbar.get("assessment")),
                "recommendation": translated_data.get("recommendation", sbar.get("recommendation")),
                "language": lang_name.lower(),
                "translated_by": "Hugging Face (Llama-3.1-8B)"
            }
        except Exception as hf_err:
            print(f"[Multilingual Error] Hugging Face translation failed: {hf_err}")

    # All providers failed or not configured — return English with notice
    return {
        **sbar,
        "language": "english",
        "translation_error": "Translation temporarily unavailable (API key not configured or quota limit reached). Showing English version."
    }
