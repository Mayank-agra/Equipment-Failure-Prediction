// PredictForm.jsx
import { useEffect, useState } from "react";
import "./PredictForm.css";

export default function PredictForm() {
  const [form, setForm] = useState({
    classification: "Orthopedic Devices",
    action_classification: "II",
    determined_cause: "Device Design",
    type: "Recall",
    implanted: "YES",
    year_initiated: 2023,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // metadata state for dropdowns
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [categoricalValues, setCategoricalValues] = useState({
    classification: [],
    action_classification: [],
    type: [],
    implanted: [],
  });

  // fallback options (used if backend metadata not available)
  const FALLBACK = {
    classification: [
      "Orthopedic Devices",
      "Radiology Devices",
      "Dental Devices",
      "Cardiovascular Devices",
      "General Hospital and Personal Use Devices",
    ],
    action_classification: ["I", "II", "III", "Unclassified"],
    type: [
      "Recall",
      "Field Safety Notice",
      "Safety alert",
      "Recall / Field Safety Notice",
      "Safety alert / Field Safety Notice",
    ],
    implanted: ["YES", "NO"],
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchMeta() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch("http://localhost:8000/metadata");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Expecting { categorical_values: { col: [vals...] }, categorical_cols: [...], numeric_cols: [...] }
        const cats = (data && data.categorical_values) ? data.categorical_values : {};
        const mapped = {
          classification: cats.classification ?? cats.classification_name ?? FALLBACK.classification,
          action_classification: cats.action_classification ?? cats.action_classification ?? FALLBACK.action_classification,
          type: cats.type ?? cats.recall_type ?? FALLBACK.type,
          implanted: cats.implanted ?? FALLBACK.implanted,
        };

        // ensure arrays and string types
        Object.keys(mapped).forEach((k) => {
          if (!Array.isArray(mapped[k])) {
            // if object-like, convert to array of strings; else fallback
            mapped[k] = mapped[k] && typeof mapped[k] === "object" ? Object.values(mapped[k]).map(String) : FALLBACK[k];
          }
          mapped[k] = mapped[k].map((v) => String(v));
        });

        if (!cancelled) {
          setCategoricalValues(mapped);
          // if current form values are not in the fetched options, set to first available
          const newForm = { ...form };
          Object.entries(mapped).forEach(([k, opts]) => {
            if (opts.length > 0 && !opts.includes(String(newForm[k]))) {
              newForm[k] = opts[0];
            }
          });
          setForm(newForm);
        }
      } catch (err) {
        console.warn("metadata fetch failed:", err);
        if (!cancelled) {
          setMetaError(err.message || "Failed to load metadata");
          setCategoricalValues(FALLBACK);
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }
    fetchMeta();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // ensure year is integer
      const payload = { ...form, year_initiated: Number(form.year_initiated) };

      const res = await fetch("http://localhost:8000/predict-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ""}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Prediction request failed");
      console.error("Prediction error:", err);
    } finally {
      setLoading(false);
    }
  };

  const upd = (k) => (e) => {
    const val = e.target.value;
    // keep year numeric-ish
    if (k === "year_initiated") {
      setForm({ ...form, [k]: val === "" ? "" : Number(val) });
    } else {
      setForm({ ...form, [k]: val });
    }
  };

  const getRiskColor = (risk) => {
    return risk === "High" ? "#ef4444" : "#10b981";
  };

  const getRiskIcon = (risk) => {
    return risk === "High" ? "⚠️" : "✅";
  };

  // helpers to get options (prefer metadata, else fallback)
  const opts = (key) => categoricalValues[key] && categoricalValues[key].length > 0 ? categoricalValues[key] : FALLBACK[key];

  return (
    <div className="predict-form-container">
      <div className="form-header">
        <h1 className="form-title">Medical Device Recall Risk Predictor</h1>
        <p className="form-subtitle">
          Enter device information to predict the risk level of a potential recall
        </p>
      </div>

      <form className="predict-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Device Classification</label>
            <select
              className="form-select"
              value={form.classification}
              onChange={upd("classification")}
            >
              {(metaLoading ? FALLBACK.classification : opts("classification")).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {metaLoading && <small className="meta-hint">Loading options...</small>}
            {metaError && <small className="meta-error">Could not load live options, using defaults.</small>}
          </div>

          <div className="form-group">
            <label className="form-label">Action Classification</label>
            <select
              className="form-select"
              value={form.action_classification}
              onChange={upd("action_classification")}
            >
              {opts("action_classification").map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Determined Cause</label>
            <input
              className="form-input"
              value={form.determined_cause}
              onChange={upd("determined_cause")}
              placeholder="e.g., Device Design"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Recall Type</label>
            <select
              className="form-select"
              value={form.type}
              onChange={upd("type")}
            >
              {opts("type").map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Implanted Device</label>
            <select
              className="form-select"
              value={form.implanted}
              onChange={upd("implanted")}
            >
              {opts("implanted").map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Year Initiated</label>
            <input
              className="form-input"
              type="number"
              value={form.year_initiated}
              onChange={upd("year_initiated")}
              min="2000"
              max="2030"
            />
          </div>
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Analyzing...
            </>
          ) : (
            "Predict Risk Level"
          )}
        </button>

        {error && (
          <div className="error-message">
            <span className="error-icon">❌</span>
            Error: {error}
          </div>
        )}

        {result && (
          <div className="result-container">
            <div className="result-header">
              <h3>Prediction Results</h3>
            </div>

            <div className="result-main">
              <div
                className="risk-badge"
                style={{ backgroundColor: getRiskColor(result.risk_binary) }}
              >
                <span className="risk-icon">{getRiskIcon(result.risk_binary)}</span>
                <span className="risk-label">{result.risk_binary} Risk</span>
              </div>

              <div className="probability-section">
                <div className="probability-label">Confidence Level</div>
                <div className="probability-bar">
                  <div
                    className="probability-fill"
                    style={{
                      width: `${result.probability_high * 100}%`,
                      backgroundColor: getRiskColor(result.risk_binary)
                    }}
                  ></div>
                </div>
                <div className="probability-value">
                  {(result.probability_high * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {result.features_fired_sample && result.features_fired_sample.length > 0 && (
              <div className="features-section">
                <h4>Key Factors</h4>
                <div className="features-list">
                  {result.features_fired_sample.slice(0, 6).map((feature, index) => (
                    <span key={index} className="feature-tag">
                      {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
