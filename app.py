# app.py - Flask backend with React frontend served

import joblib
import pandas as pd
import traceback
import logging
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ---------- load artifacts once ----------
art = joblib.load("risk_model_artifacts.joblib")
FEATURE_ORDER = art["feature_order"]
MODEL = art["model_bin"]
IMPUTER = art.get("imputer", None)   # SimpleImputer or Series/dict or None
SCALER  = art.get("scaler", None)    # likely None for RF
MODEL_PATH = art.get("model_path", "risk_model_artifacts.joblib")

# ---------- Flask setup ----------
app = Flask(__name__, static_folder="build/assets")

# CORS for development; adjust in production
CORS(app, origins=[
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000"
], supports_credentials=True)

# logging
logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)

# ---------- helper functions ----------
def _impute(df: pd.DataFrame) -> pd.DataFrame:
    if hasattr(IMPUTER, "transform") and type(IMPUTER).__name__ == "SimpleImputer":
        return pd.DataFrame(IMPUTER.transform(df), columns=FEATURE_ORDER, index=df.index)
    if isinstance(IMPUTER, pd.Series):
        return df.fillna(IMPUTER.reindex(FEATURE_ORDER))
    if isinstance(IMPUTER, dict):
        return df.fillna(pd.Series(IMPUTER).reindex(FEATURE_ORDER))
    return df.fillna(0)

def _validate_payload(json_data):
    expected = {
        "classification": str,
        "action_classification": str,
        "determined_cause": str,
        "type": str,
        "implanted": str,
        "year_initiated": int
    }
    missing = []
    bad_types = []
    for k, t in expected.items():
        if k not in json_data:
            missing.append(k)
        else:
            val = json_data[k]
            if t is int:
                if not isinstance(val, int):
                    bad_types.append(f"{k} should be int")
            else:
                if not isinstance(val, str):
                    bad_types.append(f"{k} should be str")
    return missing, bad_types

# ---------------- Metadata extraction endpoint ----------------
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

def _get_transformers_from_column_transformer(ct: ColumnTransformer):
    transformers = getattr(ct, "transformers", None) or getattr(ct, "transformers_", None) or []
    return transformers

def extract_metadata_from_pipeline(candidate):
    meta = {"categorical_cols": [], "categorical_values": {}, "numeric_cols": []}
    try:
        if candidate is None:
            return meta

        if isinstance(candidate, dict):
            candidate = candidate.get("pipeline") or candidate.get("preprocessor") or candidate.get("model") or candidate

        pre = None
        if hasattr(candidate, "named_steps"):
            pre = candidate.named_steps.get("preprocessor") or candidate.named_steps.get("pre") or None

        if pre is None and (isinstance(candidate, ColumnTransformer) or getattr(candidate, "transformers", None)):
            pre = candidate

        if pre is None:
            pre = art.get("preprocessor") or art.get("pre") or art.get("pipeline")

        if pre is None:
            return meta

        transformers = []
        if isinstance(pre, ColumnTransformer) or getattr(pre, "transformers", None) or getattr(pre, "transformers_", None):
            transformers = _get_transformers_from_column_transformer(pre)
        else:
            if hasattr(pre, "steps"):
                for name, step in pre.steps:
                    if isinstance(step, ColumnTransformer) or getattr(step, "transformers", None) or getattr(step, "transformers_", None):
                        transformers = _get_transformers_from_column_transformer(step)
                        break
                    if name in ("cat", "num", "categorical", "numerical"):
                        transformers.append((name, step, getattr(step, "feature_names_in_", []) or []))

        if not transformers and hasattr(pre, "categories_") and hasattr(pre, "feature_names_in_"):
            transformers = [("cat", pre, list(pre.feature_names_in_))]

        for name, trans, cols in transformers:
            try:
                col_list = list(cols) if cols is not None else []
            except Exception:
                col_list = []

            if name and "cat" in str(name).lower():
                meta["categorical_cols"] = col_list
                try:
                    if isinstance(trans, OneHotEncoder) and hasattr(trans, "categories_"):
                        cats = trans.categories_
                        for col, vals in zip(col_list, cats):
                            meta["categorical_values"][col] = [str(v) for v in vals]
                    else:
                        found = False
                        if hasattr(trans, "named_steps"):
                            for step_name, step_obj in trans.named_steps.items():
                                if isinstance(step_obj, OneHotEncoder) and hasattr(step_obj, "categories_"):
                                    cats = step_obj.categories_
                                    for col, vals in zip(col_list, cats):
                                        meta["categorical_values"][col] = [str(v) for v in vals]
                                    found = True
                                    break
                        if not found and hasattr(trans, "transformers_"):
                            for tname, tobj, tcols in getattr(trans, "transformers_", []):
                                if isinstance(tobj, OneHotEncoder) and hasattr(tobj, "categories_"):
                                    cats = tobj.categories_
                                    for col, vals in zip(col_list, cats):
                                        meta["categorical_values"][col] = [str(v) for v in vals]
                                    found = True
                                    break
                        if not found and hasattr(trans, "categories_"):
                            cats = getattr(trans, "categories_")
                            for col, vals in zip(col_list, cats):
                                meta["categorical_values"][col] = [str(v) for v in vals]
                except Exception:
                    for col in col_list:
                        meta["categorical_values"].setdefault(col, [])

            if name and "num" in str(name).lower():
                try:
                    meta["numeric_cols"] = col_list
                except Exception:
                    pass

        for c in meta["categorical_cols"]:
            meta["categorical_values"].setdefault(c, [])

    except Exception:
        pass

    return meta

@app.route("/metadata", methods=["GET"])
def metadata():
    try:
        candidate = art.get("pipeline") or art.get("preprocessor") or art.get("pre") or None
        if candidate is None:
            candidate = MODEL

        meta = extract_metadata_from_pipeline(candidate)
        categorical_values = meta.get("categorical_values", {})
        for k in ("classification", "action_classification", "type", "implanted", "determined_cause"):
            categorical_values.setdefault(k, [])
        response = {
            "categorical_cols": meta.get("categorical_cols", []),
            "categorical_values": categorical_values,
            "numeric_cols": meta.get("numeric_cols", []),
            "model_info": {"model_path": MODEL_PATH}
        }
        app.logger.info("Serving /metadata keys: %s", list(response["categorical_values"].keys()))
        return jsonify(response)
    except Exception as e:
        app.logger.exception("Failed to build metadata")
        return jsonify({"error": str(e)}), 500

@app.route("/_debug_metadata_stub", methods=["GET"])
def _debug_metadata_stub():
    return jsonify({
      "categorical_cols": ["classification","action_classification","type","implanted"],
      "categorical_values": {
        "classification": ["Orthopedic Devices","Cardiovascular Devices"],
        "action_classification": ["I","II","III","Unclassified"],
        "type": ["Recall","Field Safety Notice"],
        "implanted": ["YES","NO"],
        "determined_cause": ["Device Design","Manufacturing Defect"]
      },
      "numeric_cols": ["year_initiated"],
      "model_info": {"model_path": "risk_model_artifacts.joblib"}
    })

# ---------- Prediction endpoint ----------
@app.route("/predict-risk", methods=["POST"])
def predict():
    try:
        json_data = request.get_json(force=True)
        if not isinstance(json_data, dict):
            return jsonify({"error": "Invalid JSON payload"}), 400

        missing, bad_types = _validate_payload(json_data)
        if missing or bad_types:
            return jsonify({"error": "invalid payload", "missing": missing, "type_errors": bad_types}), 400

        row = pd.DataFrame([json_data])
        X = pd.get_dummies(row).reindex(columns=FEATURE_ORDER, fill_value=0)
        X = _impute(X)

        try:
            proba_high = float(MODEL.predict_proba(X)[:, 1][0])
        except Exception:
            pred = MODEL.predict(X)[0]
            proba_high = float(pred)

        label = "High" if proba_high >= 0.5 else "Low"
        fired = [c for c in X.columns if X.iloc[0][c] != 0][:12]

        return jsonify({
            "risk_binary": label,
            "probability_high": round(proba_high, 4),
            "features_fired_sample": fired
        })

    except Exception:
        tb = traceback.format_exc()
        return jsonify({"error": "internal_server_error", "trace": tb}), 500

# ---------- Serve React frontend ----------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join("build", path)):
        return send_from_directory("build", path)
    else:
        return send_from_directory("build", "index.html")

# root route (optional, for debugging)
@app.route("/routes", methods=["GET"])
def root_routes():
    routes = sorted([rule.rule for rule in app.url_map.iter_rules()])
    return "Flask running - available routes:\n" + "\n".join(routes)

# ---------- run server ----------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
