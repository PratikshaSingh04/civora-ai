import React from "react";
import type { GridContextItem } from "../types/civora";

interface GridInspectorProps {
  grid: GridContextItem | null;
  selectedScenario: string;
  onExploreSHAP?: () => void;
  onCenterMap?: () => void;
  onExportDossier?: () => void;
  onOpenWhatIf?: () => void;
}

export const GridInspector: React.FC<GridInspectorProps> = ({
  grid,
  selectedScenario,
  onExploreSHAP,
  onCenterMap,
  onExportDossier,
  onOpenWhatIf,
}) => {
  if (!grid) {
    return (
      <div className="grid-inspector empty">
        <div className="inspector-placeholder">
          <span className="placeholder-icon">◈</span>
          <h4>Select a Grid Cell</h4>
          <p>Click any cell on the Digital Twin map or select from the Hotspot Explorer to inspect detailed geospatial parameters and scenario predictions.</p>
        </div>
      </div>
    );
  }

  // Calculate scenario prediction and deltas based on selected scenario
  let scenarioPred = grid.baseline_prediction ?? 0;
  const scenarioLabel = selectedScenario;

  if (selectedScenario === "NDVI +20%") {
    scenarioPred = grid.ndvi_prediction ?? scenarioPred;
  } else if (selectedScenario === "Road Density -20%") {
    scenarioPred = grid.road_prediction ?? scenarioPred;
  } else if (selectedScenario === "Building Density -20%") {
    scenarioPred = grid.building_prediction ?? scenarioPred;
  }

  const baselinePred = grid.baseline_prediction ?? 0;
  const absChangePp = (scenarioPred - baselinePred) * 100;
  const relChangePct = baselinePred > 0 ? ((scenarioPred - baselinePred) / baselinePred) * 100 : 0;

  // Determine baseline risk severity
  const getRiskBadge = (prob: number) => {
    if (prob >= 0.40) return { label: "Severe Risk", color: "badge-severe" };
    if (prob >= 0.20) return { label: "High Risk", color: "badge-high" };
    if (prob >= 0.10) return { label: "Moderate Risk", color: "badge-moderate" };
    return { label: "Low Risk", color: "badge-low" };
  };

  const riskBadge = getRiskBadge(baselinePred);

  return (
    <div className="grid-inspector">
      <div className="inspector-header">
        <div>
          <div className="inspector-eyebrow">
            <span>GRID INSPECTOR</span>
            <span className={`risk-badge ${riskBadge.color}`}>{riskBadge.label}</span>
          </div>
          <h3 className="inspector-title">{grid.grid_id}</h3>
        </div>
        {onCenterMap && (
          <button
            type="button"
            className="inspector-action-btn"
            title="Recenter map on this cell"
            onClick={onCenterMap}
          >
            ⌖ Center
          </button>
        )}
      </div>

      {/* Verified Geographic Context */}
      <div className="inspector-geo-card">
        <div className="geo-coord">
          <span>COORDINATES (WGS84)</span>
          <strong>{grid.center[0].toFixed(5)}° N, {grid.center[1].toFixed(5)}° E</strong>
        </div>

        {grid.flood_spots && grid.flood_spots.length > 0 && (
          <div className="geo-flood-alert">
            <span className="alert-icon">[!]</span>
            <div>
              <strong>BMC Waterlogging Spot Detected</strong>
              <small>{grid.flood_spots.join(", ")}</small>
            </div>
          </div>
        )}

        {grid.roads && grid.roads.length > 0 ? (
          <div className="geo-roads">
            <span>VERIFIED ROADS IN CELL</span>
            <div className="road-tags">
              {grid.roads.map((road) => (
                <span key={road} className="road-tag">
                  ◈ {road}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="geo-roads empty">
            <span>LOCATION</span>
            <small>K/East Ward Interior Grid Cell</small>
          </div>
        )}
      </div>

      {/* Flood Prediction & Scenario Delta */}
      <div className="inspector-predictions">
        <div className="prediction-box baseline">
          <span>BASELINE PREDICTION</span>
          <strong>{(baselinePred * 100).toFixed(2)}%</strong>
          <small>Model output probability</small>
        </div>

        <div className="prediction-box scenario">
          <span>{scenarioLabel.toUpperCase()}</span>
          <strong>{(scenarioPred * 100).toFixed(2)}%</strong>
          <small>
            <span className={absChangePp < 0 ? "trend-down" : absChangePp > 0 ? "trend-up" : "trend-neutral"}>
              {absChangePp > 0 ? "+" : ""}{absChangePp.toFixed(2)} pp
            </span>{" "}
            ({relChangePct > 0 ? "+" : ""}{relChangePct.toFixed(2)}%)
          </small>
        </div>
      </div>

      {/* The 6 Verified Physical Features */}
      <div className="inspector-features-section">
        <span className="section-subtitle">SIX MODEL INPUT ATTRIBUTES</span>
        <div className="features-grid">
          <div className="feature-item">
            <span>ELEVATION (AMSL)</span>
            <strong>{grid.elevation_m !== null ? `${grid.elevation_m.toFixed(1)} m` : "—"}</strong>
            <small>IDW 250m Terrain</small>
          </div>

          <div className="feature-item">
            <span>BUILDING DENSITY</span>
            <strong>{grid.building_density !== null ? `${(grid.building_density * 100).toFixed(1)}%` : "—"}</strong>
            <small>Footprint Ratio</small>
          </div>

          <div className="feature-item">
            <span>BUILDING FOOTPRINT</span>
            <strong>{grid.building_area_m2 !== null ? `${grid.building_area_m2.toLocaleString()} m²` : "—"}</strong>
            <small>Total Built Area</small>
          </div>

          <div className="feature-item">
            <span>ROAD DENSITY</span>
            <strong>{grid.road_density !== null ? grid.road_density.toFixed(4) : "—"}</strong>
            <small>Length / Area Ratio</small>
          </div>

          <div className="feature-item">
            <span>ROAD LENGTH</span>
            <strong>{grid.road_length_m !== null ? `${grid.road_length_m.toFixed(1)} m` : "—"}</strong>
            <small>Network Length</small>
          </div>

          <div className="feature-item">
            <span>VEGETATION (NDVI)</span>
            <strong>{grid.ndvi_mean !== null ? grid.ndvi_mean.toFixed(4) : "—"}</strong>
            <small>Sentinel-2 Mean</small>
          </div>
        </div>
      </div>

      {/* Scenario Recommendation */}
      <div className="inspector-recommendation">
        <div className="recommendation-row">
          <span>Dominant Scenario:</span>
          <strong>{grid.dominant_scenario || "—"}</strong>
        </div>
        <div className="recommendation-row">
          <span>Impact Magnitude:</span>
          <span className="impact-tag">{grid.impact_magnitude || "Standard"}</span>
        </div>
      </div>

      {/* Inspector Action Buttons */}
      <div className="inspector-actions-group">
        {onExploreSHAP && (
          <button
            type="button"
            className="inspector-shap-btn"
            onClick={onExploreSHAP}
          >
            <span>✦ Inspect AI Feature Contributions (SHAP)</span>
            <span>↓</span>
          </button>
        )}

        <div className="inspector-secondary-actions">
          {onOpenWhatIf && (
            <button
              type="button"
              className="inspector-secondary-btn sandbox"
              onClick={onOpenWhatIf}
              title="Test custom vegetation & runoff changes on this grid"
            >
              ⚙ Test in What-If Sandbox
            </button>
          )}

          {onExportDossier && (
            <button
              type="button"
              className="inspector-secondary-btn dossier"
              onClick={onExportDossier}
              title="Generate printable BMC municipal planning brief"
            >
              Export Ward Dossier ↗
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GridInspector;
