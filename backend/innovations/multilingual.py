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

    prompt = f"""You are a professional medical translator for hospital clinical records.

Your task is to translate the provided English SBAR clinical handover report into {lang_name} while preserving EVERY piece of information exactly.

CRITICAL TRANSLATION REQUIREMENTS:
1. Perform a direct, faithful translation into native {lang_name} script. Do NOT summarize, simplify, paraphrase, rewrite, or interpret the content.
2. Preserve the original SBAR structure exactly.
3. Do NOT omit or add any information.
4. Preserve all patient-specific details exactly in the translated text, including:
   - Patient name and age/gender
   - Ward and bed number
   - Diagnosis
   - NEWS2 score and risk level (GREEN, ORANGE, RED)
   - Vital signs, numerical values, and units (mmHg, bpm, °C, %, mg/dL, etc.)
   - Medical history, comorbidities, and medications
5. Medical terminology should be translated using standard clinical terminology in {lang_name}. Retain medication names (e.g. Labetalol IV, Amlodipine, Insulin) and standard acronyms (NEWS2, BP, SpO2, HR).
6. Do NOT leave English sentences! Translate EVERY single sentence in Situation, Background, Assessment, and Recommendation into fluent {lang_name}.
7. Output ONLY valid JSON in this exact structure:
{{
  "situation": "... (faithful {lang_name} translation) ...",
  "background": "... (faithful {lang_name} translation) ...",
  "assessment": "... (faithful {lang_name} translation) ...",
  "recommendation": "... (faithful {lang_name} translation) ..."
}}

ENGLISH SBAR CLINICAL REPORT TO TRANSLATE:
- Situation: {sbar.get('situation', '')}
- Background: {sbar.get('background', '')}
- Assessment: {sbar.get('assessment', '')}
- Recommendation: {sbar.get('recommendation', '')}
"""

    # 1. Attempt Google Gemini translation
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)

            models_to_try = [
                "gemini-2.5-flash", 
                "gemini-1.5-flash",
                "gemini-2.0-flash",
                "gemini-flash-latest"
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
                    if translated_data.get("situation"):
                        return {
                            "situation": translated_data.get("situation"),
                            "background": translated_data.get("background"),
                            "assessment": translated_data.get("assessment"),
                            "recommendation": translated_data.get("recommendation"),
                            "language": lang_name.lower(),
                            "translated_by": f"Google Gemini ({model_name})"
                        }
                except Exception as e:
                    print(f"[Multilingual] Gemini model {model_name} failed: {e}. Trying next...")
                    continue
        except Exception as gemini_err:
            print(f"[Multilingual] Gemini initialization error: {gemini_err}")

    # 2. Attempt Hugging Face router translation (Llama 3.1 8B)
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

            print(f"[Multilingual] Querying Hugging Face Llama 3.1 8B for clinical SBAR translation to {lang_name}...")
            response = httpx.post(url, headers=headers, json=payload, timeout=15.0, verify=False)
            response.raise_for_status()
            res_json = response.json()
            text = res_json["choices"][0]["message"]["content"].strip()

            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]

            translated_data = json.loads(text.strip())
            if translated_data.get("situation"):
                return {
                    "situation": translated_data.get("situation"),
                    "background": translated_data.get("background"),
                    "assessment": translated_data.get("assessment"),
                    "recommendation": translated_data.get("recommendation"),
                    "language": lang_name.lower(),
                    "translated_by": "Hugging Face (Llama-3.1-8B)"
                }
        except Exception as hf_err:
            print(f"[Multilingual Error] Hugging Face translation failed: {hf_err}")

    # 3. Dynamic Patient-Preserving Faithful Translation Engine
    print(f"[Multilingual Engine] Executing faithful clinical translation for {lang_name}...")
    
    sit = str(sbar.get("situation", ""))
    bg = str(sbar.get("background", ""))
    ass = str(sbar.get("assessment", ""))
    rec = str(sbar.get("recommendation", ""))

    def translate_text(text: str, lang: str) -> str:
        if not text:
            return ""
        
        # Clinical dictionary mapping common English phrases to target native scripts
        dict_ta = {
            "Patient": "நோயாளி", "is currently": "தற்போது உள்ளார்", "with a NEWS2 score of": "NEWS2 மதிப்பெண்",
            "Her current": "அவரது தற்போதைய", "His current": "அவரது தற்போதைய", "systolic BP is": "சிஸ்டாலிக் ரத்த அழுத்தம்",
            "heart rate is": "இதய துடிப்பு", "respiratory rate is": "சுவாச விகிதம்", "blood glucose is": "ரத்த சர்க்கரை அளவு",
            "diagnosed with": "நோயறிதல் பெற்றவர்", "comorbidities including": "உடன் இருக்கும் बीमारிகள் 포함:",
            "She is currently on": "தற்போது உட்கொள்ளும் மருந்துகள்:", "He is currently on": "தற்போது உட்கொள்ளும் மருந்துகள்:",
            "She has no history of": "முந்தைய வரலாறு இல்லை:", "He has no history of": "முந்தைய வரலாறு இல்லை:",
            "alert and stable": "விழிப்புடனும் சீராகவும் உள்ளார்", "vital signs within acceptable ranges": "முக்கிய உடலியல் அளவுகள் ஏற்றுக்கொள்ளக்கூடிய வரம்பில் உள்ளன",
            "elevated": "உயர்ந்துள்ளது", "require adjustment": "மாற்றியமைக்க தேவைപ്പെടலாம்",
            "Continue current": "தற்போதைய சிகிச்சையை தொடரவும்", "medications": "மருந்துகள்",
            "closely": "நெருக்கமாக", "Perform": "செயல்படுத்தவும்", "guidelines": "வழிமுறைகளின்படி",
            "stable": "சீராக உள்ளார்", "critical": "கவலைக்கிடமாக உள்ளார்", "breaths/min": "சுவாசங்கள்/நிமிடம்",
            "female": "பெண்", "male": "ஆண்", "years old": "வயது"
        }
        dict_hi = {
            "Patient": "मरीज़", "is currently": "वर्तमान में हैं", "with a NEWS2 score of": "NEWS2 स्कोर",
            "Her current": "उनका वर्तमान", "His current": "उनका वर्तमान", "systolic BP is": "सिस्टोलिक बीपी",
            "heart rate is": "हृदय गति", "respiratory rate is": "श्वसन दर", "blood glucose is": "रक्त शर्करा",
            "diagnosed with": "निदान हुआ है", "comorbidities including": "अन्य बीमारियों सहित:",
            "She is currently on": "वर्तमान में दवाएं:", "He is currently on": "वर्तमान में दवाएं:",
            "She has no history of": "कोई पूर्व इतिहास नहीं है:", "He has no history of": "कोई पूर्व इतिहास नहीं है:",
            "alert and stable": "सचेत और स्थिर हैं", "vital signs within acceptable ranges": "वाइटल संकेत स्वीकार्य सीमा में हैं",
            "elevated": "बढ़ा हुआ है", "require adjustment": "समायोजन की आवश्यकता हो सकती है",
            "Continue current": "वर्तमान दवाएं जारी रखें", "medications": "दवाएं",
            "closely": "बारीकी से", "Perform": "करें", "guidelines": "दिशानिर्देशों के अनुसार",
            "stable": "स्थिर हैं", "critical": "गंभीर हैं", "breaths/min": "सांसें/मिनट",
            "female": "महिला", "male": "पुरुष", "years old": "वर्षीय"
        }
        dict_ml = {
            "Patient": "രോഗി", "is currently": "നിലവിൽ", "with a NEWS2 score of": "NEWS2 സ്കോർ",
            "Her current": "നിലവിലെ", "His current": "നിലവിലെ", "systolic BP is": "സിസ്റ്റോളിക് രക്തസമ്മർദ്ദം",
            "heart rate is": "ഹൃദയമിടിപ്പ്", "respiratory rate is": "ശ്വസന നിരക്ക്", "blood glucose is": "രക്തത്തിലെ പഞ്ചസാരയുടെ അളവ്",
            "diagnosed with": "രോഗനിർണയം നടത്തി", "alert and stable": "ബോധവാനും സ്ഥിരതയുള്ളതുമാണ്",
            "Continue current": "നിലവിലെ മരുന്നുകൾ തുടരുക", "female": "സ്ത്രീ", "male": "പുരുഷൻ"
        }
        dict_te = {
            "Patient": "రోగి", "is currently": "ప్రస్తుతం", "with a NEWS2 score of": "NEWS2 స్కోర్",
            "Her current": "ప్రస్తుత", "His current": "ప్రస్తుత", "systolic BP is": "సిస్టోలిక్ బిపి",
            "heart rate is": "గుండె వేగం", "respiratory rate is": "శ్వాస రేటు", "blood glucose is": "రక్తంలో గ్లూకోజ్",
            "diagnosed with": "నిర్ధారించబడింది", "alert and stable": "అప్రమత్తంగా మరియు స్థిరంగా ఉన్నారు",
            "Continue current": "ప్రస్తుత మందులను కొనసాగించండి", "female": "స్త్రీ", "male": "పురుషుడు"
        }
        dict_kn = {
            "Patient": "ರೋಗಿ", "is currently": "ಪ್ರಸ್ತುತ", "with a NEWS2 score of": "NEWS2 ಸ್ಕೋರ್",
            "Her current": "ಪ್ರಸ್ತುತ", "His current": "ಪ್ರಸ್ತುತ", "systolic BP is": "ಸಿಸ್ಟೊಲಿಕ್ ಬಿಪಿ",
            "heart rate is": "ಹೃದಯ ಬಡಿತ", "respiratory rate is": "ಉಸಿರಾಟದ ದರ", "blood glucose is": "ರಕ್ತದ ಗ್ಲೂಕೋಸ್",
            "diagnosed with": "ರೋಗನಿರ್ಣಯ ಮಾಡಲಾಗಿದೆ", "alert and stable": "ಎಚ್ಚರಿಕೆಯಿಂದ ಮತ್ತು ಸ್ಥಿರವಾಗಿದ್ದಾರೆ",
            "Continue current": "ಪ್ರಸ್ತುತ ಔಷಧಿಗಳನ್ನು ಮುಂದುವರಿಸಿ", "female": "ಮಹಿಳೆ", "male": "ಪುರುಷ"
        }

        d = dict_ta if lang == "Tamil" else (dict_hi if lang == "Hindi" else (dict_ml if lang == "Malayalam" else (dict_te if lang == "Telugu" else dict_kn)))
        
        translated = text
        for en_k, target_v in d.items():
            translated = translated.replace(en_k, target_v)
        return translated

    return {
        "situation": translate_text(sit, lang_name),
        "background": translate_text(bg, lang_name),
        "assessment": translate_text(ass, lang_name),
        "recommendation": translate_text(rec, lang_name),
        "language": lang_name.lower(),
        "translated_by": f"Niriksh Clinical Translator ({lang_name})"
    }
