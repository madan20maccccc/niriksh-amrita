# Agent 9 — LLM Summary Agent (Gemini)
# Generates plain-English SBAR using Google Gemini API

import os
import json
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def _build_prompt(patient: dict, vitals: dict, ews: dict, alerts: list, trends: list) -> str:
    """Constructs the prompt for Gemini to generate SBAR"""
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
    Uses Google Gemini to generate SBAR.
    Returns dict with situation, background, assessment, recommendation
    """
    if not GEMINI_API_KEY:
        return _generate_template_sbar(patient, vitals, ews, alerts)

    try:
        import google.generativeai as genai
        import time
        genai.configure(api_key=GEMINI_API_KEY)

        # Try models in order of free-tier availability
        models_to_try = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
        last_error = None
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                prompt = _build_prompt(patient, vitals, ews, alerts, trends)
                response = model.generate_content(prompt)
                text = response.text.strip()

                # Clean up markdown code blocks if present
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]

                sbar = json.loads(text)
                return {**sbar, "generated_by": f"gemini ({model_name})"}
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "quota" in err_str.lower():
                    print(f"[LLM Agent] {model_name} quota exceeded, trying next model...")
                    last_error = e
                    time.sleep(2)
                    continue
                else:
                    raise

        # All models quota exceeded — use template
        print(f"[LLM Agent] All Gemini models quota exceeded, falling back to template SBAR")
        return _generate_template_sbar(patient, vitals, ews, alerts)

    except Exception as e:
        print(f"[LLM Agent] Gemini failed ({e}), falling back to template SBAR")
        return _generate_template_sbar(patient, vitals, ews, alerts)


def _generate_template_sbar(patient: dict, vitals: dict, ews: dict, alerts: list) -> dict:
    """Fallback: rule-based SBAR when Gemini is unavailable"""
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
