import numpy as np

def predict_deterioration(vitals: list, threshold: float, parameter_name: str) -> dict:
    """
    Fits a linear regression line (y = mx + c) on a list of vital values
    representing consecutive readings/shifts and predicts when it will cross a danger threshold.
    """
    if len(vitals) < 3:
        return {
            "can_predict": False,
            "message": "Need at least 3 historical readings to run predictive analysis."
        }
    
    try:
        y = np.array([float(val) for val in vitals])
        x = np.array(range(len(y)))
        
        # Calculate linear regression slope (m) and intercept (c)
        m, c = np.polyfit(x, y, 1)
        
        current_val = y[-1]
        
        # Check if it has already crossed
        if (threshold > y[0] and current_val >= threshold) or (threshold < y[0] and current_val <= threshold):
            return {
                "can_predict": True,
                "current_value": current_val,
                "threshold": threshold,
                "slope": float(m),
                "is_approaching": False,
                "shifts_remaining": 0,
                "message": f"{parameter_name} ({current_val}) has already crossed the danger threshold of {threshold}."
            }
        
        # Check if the trend is moving towards the threshold
        approaching = False
        if threshold > current_val and m > 0:
            approaching = True
        elif threshold < current_val and m < 0:
            approaching = True
            
        if not approaching:
            return {
                "can_predict": True,
                "current_value": current_val,
                "threshold": threshold,
                "slope": float(m),
                "is_approaching": False,
                "shifts_remaining": None,
                "message": f"{parameter_name} is currently stable or moving away from the danger threshold of {threshold}."
            }
            
        # Calculate shifts remaining
        if abs(m) < 1e-4:
            return {
                "can_predict": True,
                "current_value": current_val,
                "threshold": threshold,
                "slope": float(m),
                "is_approaching": False,
                "shifts_remaining": None,
                "message": f"{parameter_name} trend is stable/flat (slope ~ 0)."
            }
            
        shifts_remaining = (threshold - current_val) / m
        
        return {
            "can_predict": True,
            "current_value": current_val,
            "threshold": threshold,
            "slope": float(m),
            "is_approaching": True,
            "shifts_remaining": round(float(shifts_remaining), 1),
            "message": f"At current rate, {parameter_name} will cross {threshold} in approximately {round(shifts_remaining, 1)} shifts."
        }
    except Exception as e:
        return {
            "can_predict": False,
            "message": f"Error running trend prediction: {str(e)}"
        }
