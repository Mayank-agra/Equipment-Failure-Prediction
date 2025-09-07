# app.py
import streamlit as st
import pandas as pd
import numpy as np
import joblib
import os

st.set_page_config(page_title="Medical Device Failure Risk", layout="centered")

st.title("Medical Device Failure Risk Predictor")
st.markdown(
    """
    Enter device details below and click **Predict**.
    The app shows the model's failure probability and maps it to a risk category (Safe / Moderate / High).
    """
)

MODEL_PATH = "best_model_gb.joblib"  # change if your model filename differs

# Load model
model = None
if os.path.exists(MODEL_PATH):
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as e:
        st.error(f"Failed to load model at {MODEL_PATH}: {e}")
        st.stop()
else:
    st.warning(f"No model file found at `{MODEL_PATH}`. Please place your joblib model (pipeline) in the app folder.")
    st.stop()

# Sidebar: risk thresholds
st.sidebar.header("Risk thresholds (probability)")
low_thresh = st.sidebar.slider("Safe → Moderate lower bound", min_value=0.0, max_value=0.6, value=0.30, step=0.01)
high_thresh = st.sidebar.slider("Moderate → High lower bound", min_value=0.4, max_value=1.0, value=0.70, step=0.01)
if low_thresh >= high_thresh:
    st.sidebar.error("Low threshold must be less than High threshold.")

def categorize(prob, low=0.30, high=0.70):
    if prob >= high:
        return "High Risk"
    elif prob >= low:
        return "Moderate Risk"
    else:
        return "Safe"

with st.form("device_form"):
    st.subheader("Device details")
    cols = st.columns(2)
    with cols[0]:
        device_name = st.selectbox("Device name", ["Ventilator", "CT Scanner", "Ultrasound", "MRI Scanner", "X-Ray", "Infusion Pump", "ECG", "Patient Monitor"])
        manufacturer = st.selectbox("Manufacturer", ["GE Healthcare", "Siemens", "Philips", "Canon Medical", "Medtronic", "Mindray", "Fujifilm"])
        device_age_years = st.number_input("Device age (years)", min_value=0, max_value=100, value=5)
        usage_hours_per_week = st.number_input("Usage hours per week", min_value=0, max_value=168, value=60)
        maintenance_frequency_per_year = st.selectbox("Maintenance frequency / year", [0,1,2,4,6,12], index=3)
    with cols[1]:
        last_maintenance_gap_days = st.number_input("Days since last maintenance", min_value=0, max_value=3650, value=90)
        error_logs_past_month = st.number_input("Error logs in past month", min_value=0, max_value=1000, value=5)
        environment = st.selectbox("Environment", ["ICU", "Ward", "Operating Room", "Lab", "Diagnostic Center"])
        criticality_level = st.selectbox("Criticality level", ["High", "Medium", "Low"])
        spare_parts_availability = st.selectbox("Spare parts availability", ["Good", "Moderate", "Poor"])
    failures_past_year = st.number_input("Failures in past year", min_value=0, max_value=100, value=0)
    manufacturer_support_rating = st.slider("Manufacturer support rating (1=poor, 5=excellent)", 1, 5, 3)

    submitted = st.form_submit_button("Predict")

if submitted:
    # Build single-row DataFrame matching training features (drop device_id)
    data = {
        "device_name": device_name,
        "manufacturer": manufacturer,
        "device_age_years": int(device_age_years),
        "usage_hours_per_week": int(usage_hours_per_week),
        "maintenance_frequency_per_year": int(maintenance_frequency_per_year),
        "last_maintenance_gap_days": int(last_maintenance_gap_days),
        "error_logs_past_month": int(error_logs_past_month),
        "environment": environment,
        "criticality_level": criticality_level,
        "spare_parts_availability": spare_parts_availability,
        "failures_past_year": int(failures_past_year),
        "manufacturer_support_rating": int(manufacturer_support_rating)
    }
    input_df = pd.DataFrame([data])

    # Predict
    try:
        prob = model.predict_proba(input_df)[:, 1][0]
    except Exception as e:
        st.error(f"Prediction failed. Make sure the saved model is a pipeline that includes preprocessing. Error: {e}")
        st.stop()

    category = categorize(prob, low=low_thresh, high=high_thresh)

    st.metric(label="Failure probability", value=f"{prob:.3f}")
    st.markdown(f"### Risk category: **{category}**")

    # Show recommended actions (simple mapping)
    if category == "High Risk":
        st.warning("High risk — recommend immediate inspection / preventive maintenance.")
    elif category == "Moderate Risk":
        st.info("Moderate risk — monitor closely and consider scheduling maintenance.")
    else:
        st.success("Safe — no immediate action required.")

    # Show the input and prediction together
    with st.expander("Show details"):
        st.write(input_df.T)

st.markdown("---")
st.markdown("**Notes:** The app expects the model to be a scikit-learn pipeline (preprocessor + classifier) saved with joblib. Adjust thresholds in the sidebar for a safety-first policy.")
