# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os
import traceback

MODEL_PATH = "best_model_gb.joblib"  # ensure this file exists in backend/ folder

app = Flask(__name__)
CORS(app)  # in production, restrict origins

# Load model on startup
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Place your joblib Pipeline there.")
model = joblib.load(MODEL_PATH)


def extract_metadata_from_pipeline(pipeline):
    """Return categorical/numeric metadata for frontend."""
    meta = {"categorical_cols": [], "categorical_values": {}, "numeric_cols": []}
    try:
        pre = pipeline.named_steps.get("preprocessor")
        if pre is None:
            return meta

        for name, trans, cols in pre.transformers:
            if name == "cat":
                cat_cols = list(cols)
                meta["categorical_cols"] = cat_cols
                try:
                    cats = trans.categories_
                    for col, vals in zip(cat_cols, cats):
                        meta["categorical_values"][col] = [str(v) for v in vals]
                except Exception:
                    for col in cat_cols:
                        meta["categorical_values"][col] = []
            if name == "num":
                try:
                    meta["numeric_cols"] = list(cols)
                except Exception:
                    pass
    except Exception:
        pass
    return meta


@app.route("/metadata", methods=["GET"])
def metadata():
    try:
        meta = extract_metadata_from_pipeline(model)
        meta["model_info"] = {"model_path": MODEL_PATH}
        return jsonify(meta)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def categorize_prob_fixed(p: float) -> str:
    """Fixed cutoffs: Low=0.30, High=0.70."""
    if p >= 0.70:
        return "High Risk"
    elif p >= 0.30:
        return "Moderate Risk"
    else:
        return "Safe"


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict_single():
    """
    Request JSON:
      { "device": { ...features... } }

    Response JSON:
      { "failure_probability": 0.82, "risk_category": "High Risk", "input": {...} }
    """
    try:
        payload = request.get_json(force=True)
        device = payload.get("device")
        if device is None:
            return jsonify({"error": "Missing 'device' object in request body"}), 400

        # build DataFrame with single row
        df = pd.DataFrame([device])

        # If pipeline training removed device_id, drop it before predict
        if "device_id" in df.columns:
            df = df.drop(columns=["device_id"])

        # predict_proba using pipeline (which should include preprocessing)
        probs = model.predict_proba(df)[:, 1]
        p = float(probs[0])
        cat = categorize_prob_fixed(p)

        return jsonify({
            "failure_probability": p,
            "risk_category": cat,
            "input": device
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
