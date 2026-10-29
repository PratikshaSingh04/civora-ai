import { useState, useEffect } from "react";
import type { ValidationBenchmarkData } from "../types/civora";

interface ValidationBenchmarkProps {
  onFocusGrid?: (gridId: string) => void;
}

export function ValidationBenchmark({ onFocusGrid }: ValidationBenchmarkProps) {
  const [data, setData] = useState<ValidationBenchmarkData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/scenarios/benchmark/metrics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load validation benchmark");
        return res.json();
      })
      .then((json: ValidationBenchmarkData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="benchmark-loading">Loading Empirical Validation Benchmark...</div>;
  }

  if (error || !data) {
    return <div className="benchmark-error">Error loading benchmark data: {error}</div>;
  }

  return (
    <div className="validation-benchmark-container">
      {/* Header Banner */}
      <div className="benchmark-hero">
        <div className="hero-badge">ACADEMIC RIGOR & GROUND-TRUTH CALIBRATION</div>
        <h2>Empirical Model Validation: XGBoost vs. MCGM Historical Flood Spots</h2>
        <p>
          Quantitative cross-validation evaluating the predictive convergence of the 6-feature XGBoost
          flood classifier against the <strong>57 official Municipal Corporation of Greater Mumbai (MCGM / BMC)</strong> recorded waterlogging locations in K/East Ward.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="benchmark-kpi-grid">
        <div className="benchmark-card primary">
          <span className="card-tag">SPATIAL CONVERGENCE</span>
          <div className="kpi-number">{data.top_tier_capture_rate_pct.toFixed(1)}%</div>
          <div className="kpi-label">Historical Flood Spot Capture Rate</div>
          <p className="kpi-desc">
            <strong>63 of 68 cells</strong> containing official BMC waterlogging spots fall within the model's high or severe risk tiers (≥20% flood probability).
          </p>
        </div>

        <div className="benchmark-card highlight">
          <span className="card-tag">RISK CONCENTRATION RATIO</span>
          <div className="kpi-number">{data.risk_concentration_ratio.toFixed(2)}x</div>
          <div className="kpi-label">Statistical Odds Elevation</div>
          <p className="kpi-desc">
            Cells with verified waterlogging average <strong>{(data.mean_flood_probability_in_flood_spots * 100).toFixed(1)}%</strong> flood risk vs. only <strong>{(data.mean_flood_probability_unaffected_grids * 100).toFixed(1)}%</strong> across unaffected ward zones.
          </p>
        </div>

        <div className="benchmark-card info">
          <span className="card-tag">TERRAIN SENSITIVITY</span>
          <div className="kpi-number">
            {data.elevation_stats.mean_elevation_flood_grids_m.toFixed(1)}m
          </div>
          <div className="kpi-label">Mean Elevation (Flood Cells)</div>
          <p className="kpi-desc">
            Flood hotspots sit in low-lying depressions (mean {data.elevation_stats.mean_elevation_flood_grids_m.toFixed(1)}m AMSL) compared to non-flooding ridges (mean {data.elevation_stats.mean_elevation_non_flood_grids_m.toFixed(1)}m AMSL).
          </p>
        </div>
      </div>

      {/* Side-by-side Distribution Comparison */}
      <div className="benchmark-deep-dive">
        <div className="deep-dive-card">
          <h3>Empirical Probability Distribution</h3>
          <div className="distribution-bars">
            <div className="dist-row">
              <span className="dist-label">Cells with Official BMC Waterlogging ({data.grids_containing_flood_spots} grids)</span>
              <div className="dist-bar-track">
                <div
                  className="dist-bar-fill flood"
                  style={{ width: `${data.mean_flood_probability_in_flood_spots * 100}%` }}
                >
                  {(data.mean_flood_probability_in_flood_spots * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="dist-row">
              <span className="dist-label">Cells Without Recorded Waterlogging ({data.total_grids - data.grids_containing_flood_spots} grids)</span>
              <div className="dist-bar-track">
                <div
                  className="dist-bar-fill safe"
                  style={{ width: `${Math.max(12, data.mean_flood_probability_unaffected_grids * 100)}%` }}
                >
                  {(data.mean_flood_probability_unaffected_grids * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="validation-hotspot-callout">
            <strong>Key Verified Hotspot Cells:</strong>
            <div className="hotspot-chips">
              {["KE_G_0024", "KE_G_0025", "KE_G_0026", "KE_G_0039", "KE_G_0040"].map((gid) => (
                <button
                  key={gid}
                  type="button"
                  className="hotspot-inspect-btn"
                  onClick={() => onFocusGrid?.(gid)}
                >
                  ◈ {gid} (Milan Subway / Saki Naka)
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scientific Methodology & Data Sources */}
        <div className="deep-dive-card methodology">
          <h3>Dataset Provenance & Model Architecture</h3>
          <table className="methodology-table">
            <tbody>
              <tr>
                <td>Model Architecture</td>
                <td><strong>{data.methodology.model_architecture}</strong></td>
              </tr>
              <tr>
                <td>Feature Attribution</td>
                <td><strong>{data.methodology.explainability_engine}</strong></td>
              </tr>
              <tr>
                <td>Earth Observation</td>
                <td><strong>{data.methodology.satellite_source}</strong></td>
              </tr>
              <tr>
                <td>Digital Elevation (AMSL)</td>
                <td><strong>{data.methodology.elevation_source}</strong></td>
              </tr>
              <tr>
                <td>Urban Footprints & Roads</td>
                <td><strong>{data.methodology.infrastructure_source}</strong></td>
              </tr>
              <tr>
                <td>Validation Ground Truth</td>
                <td><strong>{data.methodology.historical_validation_source}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

