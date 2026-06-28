def explain_alert(alert: dict, patient_context: dict = None) -> dict:
    """
    Explainability Agent (Innovation 3) that provides a clear, clinical explanation
    of why an alert was triggered, mapped to rules and rationales.
    """
    message = alert.get("message", "")
    rule_type = alert.get("rule_type", "threshold")
    severity = alert.get("severity", "LOW")
    details = alert.get("details", {})
    
    explanation = {
        "rule_name": "Standard Safety Rule",
        "rationale": "Patient vital parameter crossed safety boundary.",
        "details": [],
        "action_required": "Verify vital sign and monitor patient."
    }
    
    # Analyze rule_type
    if rule_type == "threshold":
        explanation["rule_name"] = "Absolute Danger Threshold"
        explanation["rationale"] = "A patient vital sign has crossed the absolute physiological danger limit set for general ward safety."
        
        if "systolic_bp" in message.lower():
            explanation["details"] = [
                "Systolic Blood Pressure is outside the safe range of 90-180 mmHg.",
                "Values below 90 mmHg suggest hypotensive shock and reduced organ perfusion.",
                "Values above 180 mmHg indicate a hypertensive crisis risk."
            ]
            explanation["action_required"] = "Recheck BP manually; notify duty doctor immediately if confirmed."
        elif "heart_rate" in message.lower():
            explanation["details"] = [
                "Heart Rate is outside the safe range of 40-130 bpm.",
                "Extreme bradycardia (<40) or tachycardia (>130) can compromise cardiac output."
            ]
            explanation["action_required"] = "Perform 12-lead ECG; check patient's pulse and perfusion status."
        elif "spo2" in message.lower():
            explanation["details"] = [
                "Oxygen saturation (SpO2) has dropped below the safety limit of 92%.",
                "Indicates acute hypoxia or respiratory failure."
            ]
            explanation["action_required"] = "Start oxygen therapy as per ward protocol; check airway patency."
        elif "respiratory" in message.lower():
            explanation["details"] = [
                "Respiratory Rate is outside the safe range of 8-24 breaths/min.",
                "High rates indicate respiratory distress or systemic compensation (sepsis risk).",
                "Low rates indicate central respiratory depression."
            ]
            explanation["action_required"] = "Assess breath sounds and work of breathing; prepare respiratory support."
        elif "glucose" in message.lower():
            explanation["details"] = [
                "Blood glucose is outside the safe range of 70-400 mg/dL.",
                "Hypoglycemia (<70) is an acute medical emergency leading to neuroglycopenia.",
                "Severe hyperglycemia (>400) poses risks of DKA or HHS."
            ]
            explanation["action_required"] = "If hypoglycemic, administer rapid-acting oral glucose or IV D25/D50 immediately."
            
    elif rule_type == "trend":
        explanation["rule_name"] = "Multi-Shift Trend Reasoning"
        explanation["rationale"] = "Although vitals might not have crossed absolute thresholds yet, the rate of change across consecutive shifts shows significant physiological worsening."
        
        if "bp" in message.lower() or "blood pressure" in message.lower():
            explanation["details"] = [
                "Systolic Blood Pressure has changed by >10% over consecutive shifts.",
                "Rapid change in BP suggests hemodynamic instability or acute stress response."
            ]
            explanation["action_required"] = "Review fluid balance, intake/output, and recently administered antihypertensives."
        elif "glucose" in message.lower() or "sugar" in message.lower():
            explanation["details"] = [
                "Blood Glucose has increased by >20 mg/dL per shift over consecutive readings.",
                "Indicates rising insulin resistance, infection, or inadequate glycemic management."
            ]
            explanation["action_required"] = "Review insulin/hypoglycemic medication doses; check for signs of infection."
        elif "hr" in message.lower() or "heart rate" in message.lower():
            explanation["details"] = [
                "Heart rate shows a persistent upward trend over the last 3 shifts.",
                "Often an early sign of infection, sepsis, hypovolemia, or worsening pain."
            ]
            explanation["action_required"] = "Check temperature for fever; assess pain level and hydration status."
            
    elif rule_type == "patient_specific":
        explanation["rule_name"] = "Co-morbidity & Risk Factor Rule"
        explanation["rationale"] = "The rule safety boundaries were adjusted dynamically based on this specific patient's active diagnosis, comorbidities, or surgical status."
        
        if patient_context:
            if patient_context.get("diabetes") and "diabetic" in message.lower():
                explanation["details"] = [
                    "Patient has documented Diabetes.",
                    "Safety threshold for Blood Glucose is lowered to 250 mg/dL (instead of 400 mg/dL) to prevent diabetic ketoacidosis (DKA) or prolonged hyperglycemia."
                ]
            elif patient_context.get("copd") and "copd" in message.lower():
                explanation["details"] = [
                    "Patient has documented COPD (Chronic Obstructive Pulmonary Disease).",
                    "SpO2 target is adjusted to 88-92%. Oxygen levels above 92% are flagged to prevent carbon dioxide retention and hypercapnic respiratory failure."
                ]
            elif patient_context.get("post_surgery") and "post-surgery" in message.lower():
                explanation["details"] = [
                    "Patient is post-operative.",
                    "Fever threshold is lowered to 38.5 C to capture early signs of surgical site infection or post-op sepsis."
                ]
                
    # Fallback/Default messages
    if not explanation["details"]:
        explanation["details"] = [message]
        
    return explanation
