import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def rag_answer(question: str, patient: dict, vitals_history: list, alerts: list) -> str:
    """
    RAG Assistant (Innovation 2) that answers questions about a specific patient
    using ONLY their clinical record.
    """
    if not GEMINI_API_KEY:
        return "Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file."
        
    try:
        import google.generativeai as genai
        import time
        genai.configure(api_key=GEMINI_API_KEY)

        models_to_try = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
        last_error = None
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                # Build context
                vitals_text = ""
                for idx, v in enumerate(vitals_history):
                    vitals_text += (
                        f"- Vital #{idx+1} (Shift: {v.get('shift', 'N/A')}, Entered: {v.get('timestamp', 'N/A')}):\n"
                        f"  BP: {v.get('systolic_bp', 'N/A')}/{v.get('diastolic_bp', 'N/A')} mmHg, "
                        f"  HR: {v.get('heart_rate', 'N/A')} bpm, "
                        f"  RR: {v.get('respiratory_rate', 'N/A')} /min, "
                        f"  SpO2: {v.get('spo2', 'N/A')}%, "
                        f"  Temp: {v.get('temperature', 'N/A')} C, "
                        f"  Glucose: {v.get('blood_glucose', 'N/A')} mg/dL, "
                        f"  Consciousness (AVPU): {v.get('consciousness', 'N/A')}\n"
                    )

                alerts_text = ""
                for idx, a in enumerate(alerts):
                    alerts_text += f"- [{a.get('severity', 'UNKNOWN')}] {a.get('message', 'No message')} (Timestamp: {a.get('timestamp', 'N/A')})\n"

                system_prompt = f"""You are a helpful, accurate clinical assistant in a hospital ward.
Your task is to answer a nurse's question about a specific patient named {patient.get('full_name', 'Patient')}.
You MUST answer the question using ONLY the patient record and vital history provided below. 
Do NOT make up any facts, do NOT diagnose, do NOT prescribe medications, and do NOT recommend treatments.
If the information required to answer the question is not present in the record, state: "I don't have that information in the patient's record."

PATIENT DETAILS:
- Name: {patient.get('full_name')}
- Age: {patient.get('age')} | Gender: {patient.get('gender')}
- Ward: {patient.get('ward_name')} | Bed: {patient.get('bed_number')}
- Primary Diagnosis: {patient.get('primary_diagnosis')}
- Comorbidities: {patient.get('comorbidities', 'None')}
- Current Medications: {patient.get('current_medications', 'None')}
- Risk Factors: Diabetes={patient.get('diabetes')}, Hypertension={patient.get('hypertension')}, COPD={patient.get('copd')}, Post-Surgery={patient.get('post_surgery')}

VITAL HISTORY (Newest to Oldest):
{vitals_text or "No vitals history recorded."}

RECENT CLINICAL ALERTS:
{alerts_text or "No alerts triggered."}

QUESTION:
"{question}"

Please provide a concise, factual, and helpful answer in 2-4 sentences. Do not add any introductory or meta-text.
"""
                response = model.generate_content(system_prompt)
                return response.text.strip()
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "quota" in err_str.lower():
                    print(f"[RAG Agent] {model_name} quota exceeded, trying next...")
                    last_error = e
                    time.sleep(2)
                    continue
                else:
                    raise

        return (
            "⚠️ AI assistant is temporarily unavailable due to API quota limits. "
            "Please try again in a few minutes, or check the patient's vitals and alerts directly."
        )

    except Exception as e:
        return (
            "⚠️ AI assistant encountered an error. "
            "Please review the patient record directly for clinical information."
        )
