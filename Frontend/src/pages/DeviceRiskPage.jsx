// src/pages/DeviceRiskPage.jsx
import React, { useState, useEffect } from "react";
import { predictSingle } from "../api";
import "./DeviceRiskPage.css";

const DeviceRiskPage = () => {
  // dynamic options loaded from backend
  const [deviceNames, setDeviceNames] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [criticalityLevels, setCriticalityLevels] = useState([]);
  const [spareOptions, setSpareOptions] = useState([]);
  const [numericFields, setNumericFields] = useState([]);

  // UI state
  const defaultDevice = {
    device_name: "Ventilator", // Default to first option
    manufacturer: "GE Healthcare", // Default to first option
    device_age_years: 5,
    usage_hours_per_week: 60,
    maintenance_frequency_per_year: 2,
    last_maintenance_gap_days: 90,
    error_logs_past_month: 5,
    environment: "ICU", // Default to first option
    criticality_level: "High", // Default to first option
    spare_parts_availability: "Good", // Default to first option
    failures_past_year: 0,
    manufacturer_support_rating: 3
  };

  const [device, setDevice] = useState(defaultDevice);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    // fetch metadata from backend /metadata endpoint
    async function fetchMeta() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch("http://localhost:5000/metadata");
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to fetch metadata");
        }
        // set categorical options (if available)
        const catVals = json.categorical_values || {};
        setDeviceNames(catVals.device_name || []);
        setManufacturers(catVals.manufacturer || []);
        setEnvironments(catVals.environment || []);
        setCriticalityLevels(catVals.criticality_level || []);
        setSpareOptions(catVals.spare_parts_availability || []);
        setNumericFields(json.numeric_cols || []);

        // initialize device with first available category values if empty
        setDevice(prev => ({
          ...prev,
          device_name: prev.device_name || (catVals.device_name && catVals.device_name[0]) || "",
          manufacturer: prev.manufacturer || (catVals.manufacturer && catVals.manufacturer[0]) || "",
          environment: prev.environment || (catVals.environment && catVals.environment[0]) || "",
          criticality_level: prev.criticality_level || (catVals.criticality_level && catVals.criticality_level[0]) || "",
          spare_parts_availability: prev.spare_parts_availability || (catVals.spare_parts_availability && catVals.spare_parts_availability[0]) || ""
        }));
      } catch (err) {
        console.error("metadata fetch failed", err);
        setMetaError(err.message || String(err));
      } finally {
        setMetaLoading(false);
      }
    }
    fetchMeta();
  }, []);

  const handleChange = (k, v) => {
    setDevice(prev => ({ ...prev, [k]: v }));
    // Clear validation error for this field
    if (validationErrors[k]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[k];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Check for empty strings or undefined values
    if (!device.device_name || device.device_name.trim() === "") {
      errors.device_name = "Device name is required";
    }
    if (!device.manufacturer || device.manufacturer.trim() === "") {
      errors.manufacturer = "Manufacturer is required";
    }
    if (device.device_age_years < 0) {
      errors.device_age_years = "Device age cannot be negative";
    }
    if (device.device_age_years > 50) {
      errors.device_age_years = "Device age cannot exceed 50 years";
    }
    if (device.usage_hours_per_week < 0) {
      errors.usage_hours_per_week = "Usage hours cannot be negative";
    }
    if (device.usage_hours_per_week > 168) {
      errors.usage_hours_per_week = "Usage hours cannot exceed 168 per week";
    }
    if (device.last_maintenance_gap_days < 0) {
      errors.last_maintenance_gap_days = "Days since maintenance cannot be negative";
    }
    if (device.last_maintenance_gap_days > 365) {
      errors.last_maintenance_gap_days = "Days since maintenance cannot exceed 365";
    }
    if (device.error_logs_past_month < 0) {
      errors.error_logs_past_month = "Error logs cannot be negative";
    }
    if (device.error_logs_past_month > 100) {
      errors.error_logs_past_month = "Error logs cannot exceed 100";
    }
    if (!device.environment || device.environment.trim() === "") {
      errors.environment = "Environment is required";
    }
    if (!device.criticality_level || device.criticality_level.trim() === "") {
      errors.criticality_level = "Criticality level is required";
    }
    if (!device.spare_parts_availability || device.spare_parts_availability.trim() === "") {
      errors.spare_parts_availability = "Spare parts availability is required";
    }
    if (device.failures_past_year < 0) {
      errors.failures_past_year = "Failures cannot be negative";
    }
    if (device.failures_past_year > 50) {
      errors.failures_past_year = "Failures cannot exceed 50";
    }
    if (device.manufacturer_support_rating < 1 || device.manufacturer_support_rating > 5) {
      errors.manufacturer_support_rating = "Support rating must be between 1 and 5";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePredict = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      // call predictSingle without threshold options (backend uses fixed cutoffs)
      const res = await predictSingle(device);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  if (metaLoading) {
    return (
      <div className="device-risk-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h3>Loading model metadata...</h3>
          <p>Please wait while we prepare the prediction system</p>
        </div>
      </div>
    );
  }
  
  if (metaError) {
    return (
      <div className="device-risk-container">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Failed to load metadata</h3>
          <p>{metaError}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ensure dropdowns fall back to known lists
  const DEVICE_NAMES = deviceNames.length ? deviceNames : ["Ventilator","CT Scanner","Ultrasound","MRI Scanner","X-Ray","Infusion Pump","ECG","Patient Monitor"];
  const MANUFACTURERS = manufacturers.length ? manufacturers : ["GE Healthcare","Siemens","Philips","Canon Medical","Medtronic","Mindray","Fujifilm"];
  const ENVIRONMENTS = environments.length ? environments : ["ICU","Ward","Operating Room","Lab","Diagnostic Center"];
  const CRITICALITY_LEVELS = criticalityLevels.length ? criticalityLevels : ["High","Medium","Low"];
  const SPARE_OPTIONS = spareOptions.length ? spareOptions : ["Good","Moderate","Poor"];
  const MAINT_FREQS = [0,1,2,4,6,12];

  const getRiskColor = (riskCategory) => {
    switch (riskCategory) {
      case 'High Risk': return '#ef4444';
      case 'Moderate Risk': return '#f59e0b';
      case 'Safe': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getRiskIcon = (riskCategory) => {
    switch (riskCategory) {
      case 'High Risk': return '🚨';
      case 'Moderate Risk': return '⚠️';
      case 'Safe': return '✅';
      default: return '❓';
    }
  };

  return (
    <div className="device-risk-container">
      <div className="device-risk-header">
        <h1 className="page-title">Medical Device Failure Risk Assessment</h1>
        <p className="page-subtitle">
          Analyze device parameters to predict failure risk and optimize maintenance schedules
        </p>
      </div>

      <div className="form-section">
        <div className="form-header">
          <h2>Device Information</h2>
          <p>Enter device details to assess failure risk probability</p>
        </div>

        <div className="form-grid">
          {/* Device Details Column */}
          <div className="form-column">
            <h3 className="column-title">Device Details</h3>
            
            <div className="form-group">
              <label className="form-label">Device Name</label>
              <select 
                value={device.device_name} 
                onChange={(e) => handleChange("device_name", e.target.value)}
                className={`form-select ${validationErrors.device_name ? 'error' : ''}`}
              >
                {DEVICE_NAMES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {validationErrors.device_name && (
                <div className="error-message">{validationErrors.device_name}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Manufacturer</label>
              <select 
                value={device.manufacturer} 
                onChange={(e) => handleChange("manufacturer", e.target.value)}
                className={`form-select ${validationErrors.manufacturer ? 'error' : ''}`}
              >
                {MANUFACTURERS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {validationErrors.manufacturer && (
                <div className="error-message">{validationErrors.manufacturer}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Device Age (years)</label>
              <input 
                type="number" 
                min="0" 
                max="50"
                value={device.device_age_years} 
                onChange={(e) => handleChange("device_age_years", Number(e.target.value) || 0)}
                className={`form-input ${validationErrors.device_age_years ? 'error' : ''}`}
              />
              {validationErrors.device_age_years && (
                <div className="error-message">{validationErrors.device_age_years}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Usage Hours per Week</label>
              <input 
                type="number" 
                min="0" 
                max="168" 
                value={device.usage_hours_per_week} 
                onChange={(e) => handleChange("usage_hours_per_week", Number(e.target.value) || 0)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Maintenance Frequency per Year</label>
              <select 
                value={device.maintenance_frequency_per_year} 
                onChange={(e) => handleChange("maintenance_frequency_per_year", Number(e.target.value))}
                className="form-select"
              >
                {MAINT_FREQS.map(v => (
                  <option key={v} value={v}>{v} times</option>
                ))}
              </select>
            </div>
          </div>

          {/* Maintenance & Environment Column */}
          <div className="form-column">
            <h3 className="column-title">Maintenance & Environment</h3>
            
            <div className="form-group">
              <label className="form-label">Days Since Last Maintenance</label>
              <input 
                type="number" 
                min="0" 
                max="365"
                value={device.last_maintenance_gap_days} 
                onChange={(e) => handleChange("last_maintenance_gap_days", Number(e.target.value) || 0)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Error Logs (Past Month)</label>
              <input 
                type="number" 
                min="0" 
                max="100"
                value={device.error_logs_past_month} 
                onChange={(e) => handleChange("error_logs_past_month", Number(e.target.value) || 0)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Environment</label>
              <select 
                value={device.environment} 
                onChange={(e) => handleChange("environment", e.target.value)}
                className={`form-select ${validationErrors.environment ? 'error' : ''}`}
              >
                {ENVIRONMENTS.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {validationErrors.environment && (
                <div className="error-message">{validationErrors.environment}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Criticality Level</label>
              <select 
                value={device.criticality_level} 
                onChange={(e) => handleChange("criticality_level", e.target.value)}
                className={`form-select ${validationErrors.criticality_level ? 'error' : ''}`}
              >
                {CRITICALITY_LEVELS.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {validationErrors.criticality_level && (
                <div className="error-message">{validationErrors.criticality_level}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Spare Parts Availability</label>
              <select 
                value={device.spare_parts_availability} 
                onChange={(e) => handleChange("spare_parts_availability", e.target.value)}
                className={`form-select ${validationErrors.spare_parts_availability ? 'error' : ''}`}
              >
                {SPARE_OPTIONS.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {validationErrors.spare_parts_availability && (
                <div className="error-message">{validationErrors.spare_parts_availability}</div>
              )}
            </div>
          </div>

          {/* Performance & Support Column */}
          <div className="form-column">
            <h3 className="column-title">Performance & Support</h3>
            
            <div className="form-group">
              <label className="form-label">Failures in Past Year</label>
              <input 
                type="number" 
                min="0" 
                max="50"
                value={device.failures_past_year} 
                onChange={(e) => handleChange("failures_past_year", Number(e.target.value) || 0)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Manufacturer Support Rating</label>
              <div className="rating-input">
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  step="1"
                  value={device.manufacturer_support_rating} 
                  onChange={(e) => handleChange("manufacturer_support_rating", Number(e.target.value))}
                  className="rating-slider"
                />
                <div className="rating-labels">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
                <div className="rating-value">{device.manufacturer_support_rating}/5</div>
              </div>
            </div>

            <div className="predict-button-container">
              <button 
                onClick={handlePredict} 
                disabled={loading}
                className="predict-button"
              >
                {loading ? (
                  <>
                    <div className="button-spinner"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <span className="button-icon">🔍</span>
                    Predict Risk Level
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="results-section">
            <div className="results-header">
              <h3>Risk Assessment Results</h3>
            </div>
            
            {result.error ? (
              <div className="error-result">
                <div className="error-icon">❌</div>
                <div className="error-message">{result.error}</div>
              </div>
            ) : (
              <div className="success-result">
                <div className="risk-badge" style={{ backgroundColor: getRiskColor(result.risk_category) }}>
                  <span className="risk-icon">{getRiskIcon(result.risk_category)}</span>
                  <span className="risk-label">{result.risk_category}</span>
                </div>
                
                <div className="probability-section">
                  <div className="probability-header">
                    <h4>Failure Probability</h4>
                    <div className="probability-value">
                      {(result.failure_probability * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="probability-bar">
                    <div 
                      className="probability-fill"
                      style={{ 
                        width: `${result.failure_probability * 100}%`,
                        backgroundColor: getRiskColor(result.risk_category)
                      }}
                    ></div>
                  </div>
                  
                  <div className="probability-description">
                    {result.failure_probability > 0.7 ? 
                      "High probability of device failure - immediate attention required" :
                      result.failure_probability > 0.4 ? 
                      "Moderate risk - schedule maintenance soon" :
                      "Low risk - device operating normally"
                    }
                  </div>
                </div>

                <div className="recommendations">
                  <h4>Recommendations</h4>
                  <ul>
                    {result.failure_probability > 0.7 ? (
                      <>
                        <li>Schedule immediate maintenance</li>
                        <li>Consider device replacement</li>
                        <li>Increase monitoring frequency</li>
                        <li>Check spare parts availability</li>
                      </>
                    ) : result.failure_probability > 0.4 ? (
                      <>
                        <li>Schedule preventive maintenance</li>
                        <li>Monitor error logs closely</li>
                        <li>Check manufacturer support options</li>
                      </>
                    ) : (
                      <>
                        <li>Continue regular maintenance schedule</li>
                        <li>Monitor for any changes in performance</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceRiskPage;
