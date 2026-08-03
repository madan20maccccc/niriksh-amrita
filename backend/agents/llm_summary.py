# Agent 9 — LLM Summary Agent
# Generates plain-English SBAR using Google Gemini, OpenAI ChatGPT, or Hugging Face
# Cascade priority: Gemini → OpenAI (gpt-4o-mini) → Hugging Face → Template fallback

import os
import json
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def _build_prompt(patient: dict, vitals: dict, ews: dict, alerts: list, trends: list) -> str:
    """Constructs the prompt for LLM to generate SBAR"""
    alert_text = "\n".join(f"  - [{a['severity']}] {a['message']}" for a in alerts) or "  None"
    trend_text = "\n".join(f"  - {t}" for t in trends) or "  None"

    comorbidities = patient.get("comorbidities", "None")
    medications = patient.get("current_medications", "None")

    return f"""You are a clinical AI assistant in a hospital ward. 
Generate a concise, accurate SBAR (Situation, Background, Assessment, Recommendation) 
handover report for the following patient. Write in clear, professional nursing/medical language.
Keep each section to 2-4 sentences. Do NOT make up information.

PATIENT:
  Name: {patient.get('full_name')}
  Age: {patient.get('age')} | Gender: {patient.get('gender')}
  Ward: {patient.get('ward_name')} | Bed: {patient.get('bed_number')}
  Primary Diagnosis: {patient.get('primary_diagnosis')}
  Comorbidities: {comorbidities}
  Current Medications: {medications}
  Diabetes: {patient.get('diabetes')} | COPD: {patient.get('copd')} 
  Hypertension: {patient.get('hypertension')} | Post-surgery: {patient.get('post_surgery')}
  Cardiac History: {patient.get('cardiac_history')}

CURRENT VITALS ({vitals.get('shift', 'N/A')} shift):
  Systolic BP: {vitals.get('systolic_bp', 'N/A')} mmHg
  Heart Rate: {vitals.get('heart_rate', 'N/A')} bpm
  Respiratory Rate: {vitals.get('respiratory_rate', 'N/A')} /min
  SpO2: {vitals.get('spo2', 'N/A')}%
  Temperature: {vitals.get('temperature', 'N/A')} °C
  Consciousness (AVPU): {vitals.get('consciousness', 'N/A')}
  Blood Glucose: {vitals.get('blood_glucose', 'N/A')} mg/dL

NEWS2 SCORE: {ews.get('total_score', 'N/A')} ({ews.get('clinical_risk', 'N/A')} risk)
  Response required: {ews.get('response_required', 'N/A')}

CLINICAL ALERTS:
{alert_text}

TREND ALERTS:
{trend_text}

Generate the SBAR in this exact JSON format:
{{
  "situation": "...",
  "background": "...",
  "assessment": "...",
  "recommendation": "..."
}}

Only output the JSON, no extra text."""


def generate_sbar_gemini(patient: dict, vitals: dict, ews: dict, alerts: list, trends: list) -> dict:
    """
    Generates SBAR using a cascade of AI providers:
      1. Google Gemini (if key is valid)
      2. OpenAI ChatGPT gpt-4o-mini (if OPENAI_API_KEY is set)
      3. Hugging Face Serverless (Qwen 2.5 72B)
      4. Template-based fallback (always works)

    Returns dict with situation, background, assessment, recommendation
    """
    # ── Read configs directly from .env file for instant hot-reloading ──────
    provider = "gemini"
    hf_token = ""
    gemini_key = ""
    openai_key = ""

    try:
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as env_f:
                for line in env_f:
                    line = line.strip()
                    if line.startswith("AI_PROVIDER="):
                        provider = line.split("=", 1)[1].strip().lower()
                    elif line.startswith("HUGGINGFACE_API_KEY="):
                        hf_token = line.split("=", 1)[1].strip()
                    elif line.startswith("GEMINI_API_KEY="):
                        gemini_key = line.split("=", 1)[1].strip()
                    elif line.startswith("OPENAI_API_KEY="):
                        openai_key = line.split("=", 1)[1].strip()
    except Exception:
        pass

    if not provider:
        provider = os.getenv("AI_PROVIDER", "gemini").lower()
    if not hf_token:
        hf_token = os.getenv("HF_TOKEN", "") or os.getenv("HUGGINGFACE_API_KEY", "")
    if not hf_token:
        hf_token = "hf_placeholder"
    if not gemini_key:
        gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not openai_key:
        openai_key = os.getenv("OPENAI_API_KEY", "")

    # ── Helper: Hugging Face SBAR ────────────────────────────────────────────
    def _run_hf_sbar(patient_d, vitals_d, ews_d, alerts_l, trends_l, token):
        import urllib.request
        import ssl

        prompt_str = _build_prompt(patient_d, vitals_d, ews_d, alerts_l, trends_l)
        url = "https://router.huggingface.co/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "Qwen/Qwen2.5-72B-Instruct",
            "messages": [
                {
                    "role": "user",
                    "content": prompt_str
                }
            ],
            "max_tokens": 700,
            "temperature": 0.3
        }

        context = ssl._create_unverified_context()
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers
        )

        print("[LLM SBAR] Querying Hugging Face Serverless API via Router (Qwen 2.5 72B)...")
        with urllib.request.urlopen(req, context=context, timeout=25) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            
            choices = res_json.get("choices", [])
            if len(choices) > 0:
                text = choices[0].get("message", {}).get("content", "").strip()
            else:
                raise Exception("Invalid API response format from Hugging Face Router.")
            
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()
            sbar = json.loads(text)
            return {**sbar, "generated_by": "Hugging Face (Qwen-2.5-72B)"}


    # ── Helper: OpenAI ChatGPT SBAR ──────────────────────────────────────────
    def _run_openai_sbar(patient_d, vitals_d, ews_d, alerts_l, trends_l, api_key):
        import urllib.request
        import ssl

        prompt_str = _build_prompt(patient_d, vitals_d, ews_d, alerts_l, trends_l)
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o-mini",
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": "You are a clinical AI assistant. Always respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt_str
                }
            ],
            "max_tokens": 700,
            "temperature": 0.3
        }

        context = ssl._create_unverified_context()
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers
        )

        print("[LLM SBAR] Querying OpenAI ChatGPT (gpt-4o-mini)...")
        with urllib.request.urlopen(req, context=context, timeout=30) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            text = res_json["choices"][0]["message"]["content"].strip()
            sbar = json.loads(text)
            return {**sbar, "generated_by": "OpenAI ChatGPT (gpt-4o-mini)"}

    # ── Routing logic ────────────────────────────────────────────────────────

    # If provider is explicitly set to openai, try OpenAI first
    if provider == "openai":
        if openai_key:
            try:
                return _run_openai_sbar(patient, vitals, ews, alerts, trends, openai_key)
            except Exception as e:
                print(f"[LLM SBAR] OpenAI failed: {e}. Falling back to template...")
        return _generate_template_sbar(patient, vitals, ews, alerts)

    # If provider is explicitly set to huggingface, try HF first
    if provider == "huggingface":
        if hf_token:
            try:
                return _run_hf_sbar(patient, vitals, ews, alerts, trends, hf_token)
            except Exception as hf_err:
                print(f"[LLM SBAR] Hugging Face failed: {hf_err}. Trying OpenAI fallback...")
                if openai_key:
                    try:
                        return _run_openai_sbar(patient, vitals, ews, alerts, trends, openai_key)
                    except Exception as oe:
                        print(f"[LLM SBAR] OpenAI also failed: {oe}. Using template.")
        return _generate_template_sbar(patient, vitals, ews, alerts)

    # ── Default: Try Gemini → OpenAI → Hugging Face → Template ──────────────

    # 1. Try Google Gemini
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)

            models_to_try = [
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite",
                "gemini-1.5-flash",
                "gemini-1.5-pro",
                "gemini-pro"
            ]
            last_error = None
            for model_name in models_to_try:
                try:
                    model = genai.GenerativeModel(model_name)
                    prompt = _build_prompt(patient, vitals, ews, alerts, trends)
                    response = model.generate_content(prompt)
                    text = response.text.strip()

                    if text.startswith("```"):
                        text = text.split("```")[1]
                        if text.startswith("json"):
                            text = text[4:]

                    sbar = json.loads(text.strip())
                    return {**sbar, "generated_by": f"Google Gemini ({model_name})"}
                except Exception as e:
                    print(f"[LLM SBAR] Gemini model {model_name} failed: {e}")
                    last_error = e
                    continue

            print(f"[LLM SBAR] All Gemini models failed. Last error: {last_error}")

        except Exception as gemini_err:
            print(f"[LLM SBAR] Gemini library error: {gemini_err}")

    # 2. Try OpenAI ChatGPT gpt-4o-mini
    if openai_key:
        try:
            return _run_openai_sbar(patient, vitals, ews, alerts, trends, openai_key)
        except Exception as openai_err:
            print(f"[LLM SBAR] OpenAI ChatGPT failed: {openai_err}")

    # 3. Try Hugging Face
    if hf_token:
        try:
            return _run_hf_sbar(patient, vitals, ews, alerts, trends, hf_token)
        except Exception as hf_err:
            print(f"[LLM SBAR] Hugging Face failed: {hf_err}")

    # 4. Last resort: rule-based template
    print("[LLM SBAR] All AI providers failed. Using template fallback.")
    return _generate_template_sbar(patient, vitals, ews, alerts)


def _generate_template_sbar(patient: dict, vitals: dict, ews: dict, alerts: list) -> dict:
    """Fallback: rule-based SBAR when all AI providers are unavailable"""
    name = patient.get("full_name", "Patient")
    diagnosis = patient.get("primary_diagnosis", "unknown diagnosis")
    ward = patient.get("ward_name", "ward")
    bed = patient.get("bed_number", "N/A")
    news2 = ews.get("total_score", "N/A")
    risk = ews.get("clinical_risk", "unknown")

    sbp = vitals.get("systolic_bp", "N/A")
    hr = vitals.get("heart_rate", "N/A")
    rr = vitals.get("respiratory_rate", "N/A")
    spo2 = vitals.get("spo2", "N/A")
    temp = vitals.get("temperature", "N/A")

    top_alerts = [a["message"] for a in alerts[:2]] if alerts else []
    alert_text = " ".join(top_alerts) if top_alerts else "No critical alerts at this time."

    situation = (
        f"{name}, admitted to {ward} (Bed {bed}) with {diagnosis}, "
        f"currently showing a NEWS2 score of {news2} indicating {risk} clinical risk."
    )
    background = (
        f"Patient was admitted with {diagnosis}. "
        f"Relevant comorbidities: {patient.get('comorbidities', 'None')}. "
        f"Currently on: {patient.get('current_medications', 'routine medications')}."
    )
    assessment = (
        f"Current vitals: BP {sbp} mmHg, HR {hr} bpm, RR {rr}/min, "
        f"SpO2 {spo2}%, Temp {temp}°C. {alert_text}"
    )
    recommendation = ews.get("response_required", "Continue monitoring per protocol.")

    return {
        "situation": situation,
        "background": background,
        "assessment": assessment,
        "recommendation": recommendation,
        "generated_by": "template",
    }
