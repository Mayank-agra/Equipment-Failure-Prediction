# generate_v4_dataset.py
"""
Generates synthetic_device_failure_dataset_v4.csv
Designed to have stronger, cleaner signals for failure prediction.
"""

import numpy as np
import pandas as pd
from scipy.special import expit

# reproducibility
np.random.seed(2025)

# -----------------------
# Parameters
# -----------------------
N = 3000  # number of rows

device_names = ["Ventilator", "CT Scanner", "Ultrasound", "MRI Scanner", "X-Ray",
                "Infusion Pump", "ECG", "Patient Monitor"]
manufacturers = ["GE Healthcare", "Siemens", "Philips", "Canon Medical",
                 "Medtronic", "Mindray", "Fujifilm"]
environments = ["ICU", "Ward", "Operating Room", "Lab", "Diagnostic Center"]
criticality_levels = ["High", "Medium", "Low"]
spare_parts = ["Good", "Moderate", "Poor"]

# -----------------------
# Base distributions
# -----------------------
device_age_years = np.random.poisson(lam=6, size=N)
usage_hours_per_week = np.clip(
    np.random.normal(loc=60, scale=18, size=N).astype(int), 5, 168
)
maintenance_frequency_per_year = np.random.choice(
    [0, 1, 2, 4, 6, 12], size=N, p=[0.02, 0.08, 0.18, 0.32, 0.28, 0.12]
)
last_maintenance_gap_days = np.clip(
    (365 / np.maximum(maintenance_frequency_per_year, 1)).astype(int) +
    np.random.randint(-10, 40, size=N),
    0, 720
)
failures_past_year = np.random.poisson(lam=0.12, size=N)

# Error logs: stronger relation and lower noise
base_error = (device_age_years * 1.5 +
              usage_hours_per_week * 0.14 +
              last_maintenance_gap_days * 0.1)
error_noise = np.random.normal(0, 3, size=N)  # reduced noise for clearer signal
error_logs_past_month = np.clip((base_error / 3 + error_noise).astype(int), 0, 400)

manufacturers_sample = np.random.choice(manufacturers, size=N, p=[0.18, 0.15, 0.14, 0.12, 0.12, 0.18, 0.11])
manu_rating_map = {
    "GE Healthcare": 4, "Siemens": 4, "Philips": 3, "Canon Medical": 3,
    "Medtronic": 3, "Mindray": 2, "Fujifilm": 3
}
manufacturer_support_rating = np.array([manu_rating_map[m] for m in manufacturers_sample]) \
                              + np.random.randint(-1, 2, size=N)
manufacturer_support_rating = np.clip(manufacturer_support_rating, 1, 5)

device_name_sample = np.random.choice(device_names, size=N, p=[0.14, 0.12, 0.16, 0.10, 0.14, 0.15, 0.10, 0.09])
environment_sample = np.random.choice(environments, size=N, p=[0.28, 0.28, 0.14, 0.10, 0.20])
criticality_sample = np.random.choice(criticality_levels, size=N, p=[0.45, 0.40, 0.15])
spare_parts_sample = np.random.choice(spare_parts, size=N, p=[0.34, 0.36, 0.30])

# -----------------------
# Risk score (strong signals + nonlinear interactions)
# -----------------------
risk_continuous = (
    0.12 * error_logs_past_month +        # amplified
    0.35 * device_age_years +            # amplified
    0.02 * last_maintenance_gap_days +    # amplified
    0.005 * usage_hours_per_week +
    0.6 * failures_past_year +           # stronger effect for prior failures
    -0.8 * (manufacturer_support_rating - 3) +  # stronger protective effect
    0.9 * (criticality_sample == "High").astype(int) +  # high criticality strong impact
    0.6 * (spare_parts_sample == "Poor").astype(int)    # poor spares strong impact
)

# strong nonlinear interactions
risk_continuous += 0.06 * (device_age_years * (error_logs_past_month > 8))
risk_continuous += 0.08 * (last_maintenance_gap_days > 90).astype(int) * error_logs_past_month
risk_continuous += 0.5 * (failures_past_year > 0).astype(int)  # previous failures amplify risk

# convert to probability using logistic (expit), center and scale to keep reasonable prevalence
prob = expit((risk_continuous - np.median(risk_continuous)) * 0.85)

# sample labels probabilistically (keeps realistic noise)
failure_within_year = np.random.binomial(1, prob)

# -----------------------
# Assemble DataFrame
# -----------------------
df_v4 = pd.DataFrame({
    "device_id": np.arange(1, N + 1),
    "device_name": device_name_sample,
    "manufacturer": manufacturers_sample,
    "device_age_years": device_age_years,
    "usage_hours_per_week": usage_hours_per_week,
    "maintenance_frequency_per_year": maintenance_frequency_per_year,
    "last_maintenance_gap_days": last_maintenance_gap_days,
    "error_logs_past_month": error_logs_past_month,
    "environment": environment_sample,
    "criticality_level": criticality_sample,
    "spare_parts_availability": spare_parts_sample,
    "failures_past_year": failures_past_year,
    "manufacturer_support_rating": manufacturer_support_rating,
    "failure_within_year": failure_within_year
})

# -----------------------
# Adjust prevalence to ~40.8% if necessary by flipping highest-risk zeros
# -----------------------
current_prev = df_v4['failure_within_year'].mean()
target = 0.408
if abs(current_prev - target) > 0.01:
    diff = target - current_prev
    n_flip = int(abs(diff) * N)
    if n_flip > 0:
        if diff > 0:
            # flip zeros with highest risk -> 1
            zeros_idx = df_v4[df_v4['failure_within_year'] == 0].index
            zeros_risk = risk_continuous[zeros_idx]
            flip_idx = zeros_idx[np.argsort(-zeros_risk)[:n_flip]]
            df_v4.loc[flip_idx, 'failure_within_year'] = 1
        else:
            # flip ones with lowest risk -> 0
            ones_idx = df_v4[df_v4['failure_within_year'] == 1].index
            ones_risk = risk_continuous[ones_idx]
            flip_idx = ones_idx[np.argsort(ones_risk)[:n_flip]]
            df_v4.loc[flip_idx, 'failure_within_year'] = 0

# -----------------------
# Save CSV
# -----------------------
out_path = "synthetic_device_failure_dataset_v4.csv"
df_v4.to_csv(out_path, index=False)
print("Saved v4 dataset to", out_path)
print("Rows:", len(df_v4), "Failure rate:", df_v4['failure_within_year'].mean())
