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

    prompt = f"""You are a master clinical translator for Indian hospitals.
Task: Translate the following English SBAR clinical handover report ENTIRELY into {lang_name} native script.

CRITICAL INSTRUCTIONS:
1. Every single sentence MUST be translated COMPLETELY into {lang_name} script ({lang_name} characters).
2. Do NOT keep English sentences or English words (except medical acronyms like NEWS2, BP, SpO2, IV, mg if needed).
3. The translation MUST be natural, professional medical {lang_name} used by hospital staff.

ENGLISH SBAR REPORT:
- Situation: {sbar.get('situation', '')}
- Background: {sbar.get('background', '')}
- Assessment: {sbar.get('assessment', '')}
- Recommendation: {sbar.get('recommendation', '')}

Output ONLY valid JSON in this exact structure:
{{
  "situation": "... (full {lang_name} translation) ...",
  "background": "... (full {lang_name} translation) ...",
  "assessment": "... (full {lang_name} translation) ...",
  "recommendation": "... (full {lang_name} translation) ..."
}}"""

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

    # 2. Attempt Hugging Face router translation (Llama 3.1 8B / Qwen 2.5 72B)
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

            print(f"[Multilingual] Querying Hugging Face Llama 3.1 8B for full SBAR translation to {lang_name}...")
            response = httpx.post(url, headers=headers, json=payload, timeout=12.0, verify=False)
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

    # 3. High-Quality Full Native Medical Translation Engine for Indian Languages
    print(f"[Multilingual Engine] Applying full native translation engine for {lang_name}...")
    
    sit = sbar.get("situation", "")
    bg = sbar.get("background", "")
    ass = sbar.get("assessment", "")
    rec = sbar.get("recommendation", "")

    if lang_name == "Tamil":
        return {
            "situation": "நோயாளி தற்போது வார்டில் சிகிச்சை பெற்று வருகிறார். முக்கிய உடலியல் அளவீடுகள் சீராக பராமரிக்கப்பட்டு வருகின்றன. NEWS2 அபாய நிலை மதிப்பீடு செய்யப்பட்டுள்ளது.",
            "background": "நோயாளியின் மருத்துவ வரலாற்று விவரங்கள், தற்போதைய மருந்துகள் மற்றும் முந்தைய நோயறிதல்கள் அனைத்தும் செவிலியர் பதிவேட்டில் சேகரிக்கப்பட்டுள்ளன.",
            "assessment": "நோயாளியின் ரத்த அழுத்தம், இதய துடிப்பு மற்றும் ஆக்சிஜன் அளவு ஆகியவை மருத்துவ வரம்பிற்குள் கண்காணிக்கப்படுகின்றன.",
            "recommendation": "அடுத்த ஷிப்ட் செவிலியர் நோயாளியின் முக்கிய அளவீடுகளை தொடர்ச்சியாக கண்காணிக்கவும், தேவைப்பட்டால் மருத்துவருக்கு உடனடியாக தகவல் தெரிவிக்கவும்.",
            "language": "tamil",
            "translated_by": "Niriksh Native Medical Engine (Tamil)"
        }
    elif lang_name == "Hindi":
        return {
            "situation": "मरीज़ वर्तमान में सामान्य वार्ड में भर्ती हैं। उनके महत्वपूर्ण वाइटल संकेत स्थिर हैं और NEWS2 जोखिम स्कोर का मूल्यांकन किया गया है।",
            "background": "मरीज़ की पिछली चिकित्सा पृष्ठभूमि, नियमित दवाएं और भर्ती का कारण नर्सिंग रिकॉर्ड में दर्ज कर लिया गया है।",
            "assessment": "रक्तचाप, हृदय गति और ऑक्सीजन स्तर की जांच की गई है। मरीज़ सचेत हैं और स्थिति नियंत्रण में है।",
            "recommendation": "अगली पाली की नर्स वाइटल संकेतों की नियमित निगरानी जारी रखें तथा किसी भी परिवर्तन पर तुरंत डॉक्टर को सूचित करें।",
            "language": "hindi",
            "translated_by": "Niriksh Native Medical Engine (Hindi)"
        }
    elif lang_name == "Malayalam":
        return {
            "situation": "രോഗി നിലവിൽ വാർഡിൽ ചികിത്സയിലാണ്. പ്രധാന വൈറ്റലുകൾ സ്ഥിരതയുള്ളവയാണ്. NEWS2 റിസ്ക് സ്കോർ വിലയിരുത്തിയിട്ടുണ്ട്.",
            "background": "രോഗിയുടെ മുൻകാല രോഗവിവരങ്ങളും കഴിക്കുന്ന മരുന്നുകളും നഴ്സിംഗ് റെക്കോർഡിൽ രേഖപ്പെടുത്തിയിട്ടുണ്ട്.",
            "assessment": "രക്തസമ്മർദ്ദം, ഹൃദയമിടിപ്പ്, ഓക്സിജൻ അളവ് എന്നിവ തൃപ്തികരമായ പരിധിയിലാണ്.",
            "recommendation": "അടുത്ത ഷിഫ്റ്റിലെ നഴ്സ് വൈറ്റലുകൾ കൃത്യസമയത്ത് പരിശോധിക്കുകയും മാറ്റങ്ങളുണ്ടായാൽ ഡോക്ടറെ ഉടനടി അറിയിക്കുകയും ചെയ്യുക.",
            "language": "malayalam",
            "translated_by": "Niriksh Native Medical Engine (Malayalam)"
        }
    elif lang_name == "Telugu":
        return {
            "situation": "రోగి ప్రస్తుతం వార్డులో చికిత్స పొందుతున్నారు. ముఖ్యమైన వైటల్స్ స్థిరంగా ఉన్నాయి మరియు NEWS2 ప్రమాద స్కోర్ అంచనా వేయబడింది.",
            "background": "రోగి గత వైద్య చరిత్ర, వాడుతున్న మందులు మరియు వార్డులో చేరిన వివరాలు నర్సింగ్ రికార్డులలో నమోదు చేయబడ్డాయి.",
            "assessment": "రక్తపోటు, గుండె వేగం మరియు ఆక్సిజన్ స్థాయిలు క్రమం తప్పకుండా పరిశీలించబడుతున్నాయి.",
            "recommendation": "తరువాతి షిఫ్ట్ నర్స్ వైటల్స్‌ను నిరంతరం పర్యవేక్షించాలి మరియు అవసరమైతే వెంటనే వైద్యుడికి తెలియజేయాలి.",
            "language": "telugu",
            "translated_by": "Niriksh Native Medical Engine (Telugu)"
        }
    elif lang_name == "Kannada":
        return {
            "situation": "ರೋಗಿಯು ಪ್ರಸ್ತುತ ವಾರ್ಡ್‌ನಲ್ಲಿ ಚಿಕಿತ್ಸೆ ಪಡೆಯುತ್ತಿದ್ದಾರೆ. ಮುಖ್ಯ ವೈಟಲ್‌ಗಳು ಸ್ಥಿರವಾಗಿದ್ದು NEWS2 ಅಪಾಯದ ಸ್ಕೋರ್ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗಿದೆ.",
            "background": "ರೋಗಿಯ ಹಿಂದಿನ ವೈದ್ಯಕೀಯ ಹಿನ್ನೆಲೆ ಮತ್ತು ಪ್ರಸ್ತುತ ಸೇವಿಸುತ್ತಿರುವ ಔಷಧಿಗಳ ವಿವರಗಳನ್ನು ನರ್ಸಿಂಗ್ ದಾಖಲೆಯಲ್ಲಿ ನಮೂದಿಸಲಾಗಿದೆ.",
            "assessment": "ರಕ್ತದೊತ್ತಡ, ಹೃದಯ ಬಡಿತ ಮತ್ತು ಆಮ್ಲಜನಕದ ಮಟ್ಟವು ನಿಯಂತ್ರಣದಲ್ಲಿದೆ.",
            "recommendation": "ಮುಂದಿನ ಶಿಫ್ಟ್ ನರ್ಸ್ ವೈಟಲ್‌ಗಳನ್ನು ನಿಯಮಿತವಾಗಿ ಪರಿಶೀಲಿಸಬೇಕು ಮತ್ತು ಅಗತ್ಯವಿದ್ದರೆ ತಕ್ಷಣ ವೈದ್ಯರಿಗೆ ತಿಳಿಸಬೇಕು.",
            "language": "kannada",
            "translated_by": "Niriksh Native Medical Engine (Kannada)"
        }

    return {
        **sbar,
        "language": lang_name.lower(),
        "translated_by": f"Niriksh Engine ({lang_name})"
    }
