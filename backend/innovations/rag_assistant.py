import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def rag_answer(question: str, patient: dict, vitals_history: list, alerts: list) -> str:
    """
    RAG Assistant (Innovation 2) that answers questions about a specific patient
    using ONLY their clinical record.
    """
    import os
    import json
    
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

    # Build patient vitals history text
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

    # 1. Try Google Gemini
    if gemini_key:
        try:
            import google.generativeai as genai
            import time
            genai.configure(api_key=gemini_key)

            models_to_try = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
            for model_name in models_to_try:
                try:
                    model = genai.GenerativeModel(model_name)
                    response = model.generate_content(system_prompt)
                    return response.text.strip()
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "quota" in err_str.lower():
                        print(f"[RAG Agent] {model_name} quota exceeded, trying next...")
                        time.sleep(1)
                        continue
                    else:
                        raise
        except Exception as gemini_err:
            print(f"[RAG Agent] Gemini RAG failed: {gemini_err}. Trying Hugging Face fallback...")

    # 2. Try Hugging Face router (Llama 3.1 8B - fast & reliable)
    if hf_token and hf_token != "hf_placeholder":
        try:
            import urllib.request
            import ssl
            
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
                        "content": system_prompt
                    }
                ]
            }
            context = ssl._create_unverified_context()
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers
            )
            
            print("[RAG Agent] Querying Hugging Face Llama 3.1 8B for RAG answer...")
            with urllib.request.urlopen(req, context=context, timeout=25) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                return res_json["choices"][0]["message"]["content"].strip()
        except Exception as hf_err:
            print(f"[RAG Agent Error] Hugging Face RAG failed: {hf_err}")

    return (
        "⚠️ Clinical AI assistant is temporarily unavailable. "
        "Please make sure your Hugging Face Token or Gemini API key is configured correctly in settings."
    )
