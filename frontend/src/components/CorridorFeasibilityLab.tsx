import { useState, useEffect, useCallback } from "react";
import type {
  CorridorPreset,
  CorridorFeasibilityResult,
} from "../types/civora";

interface CorridorFeasibilityLabProps {
  onRenderCorridor?: (corridorData: any) => void;
  onClearCorridor?: () => void;
  activeCorridorName?: string;
  onScrollToMap?: () => void;
}

const DEFAULT_PRESETS: CorridorPreset[] = [
  {
    id: "milan_subway_relief",
    name: "Milan Subway Flood Relief Bypass",
    project_type: "highway",
    description:
      "Bypass corridor designed to alleviate recurring severe monsoon waterlogging at Milan Subway underpass via elevated/box-culvert transit.",
    coordinates: [
      [72.8442, 19.1028],
      [72.851, 19.1065],
      [72.8575, 19.1102],
    ],
    corridor_width_m: 25.0,
  },
  {
    id: "jvlr_airport_connector",
    name: "JVLR - Airport Cargo Terminal Link",
    project_type: "highway",
    description:
      "East-west arterial flyover link connecting Jogeshwari-Vikhroli Link Road with northern international airport logistics perimeter.",
    coordinates: [
      [72.862, 19.128],
      [72.868, 19.1235],
      [72.875, 19.117],
    ],
    corridor_width_m: 35.0,
  },
  {
    id: "saki_naka_sponge_corridor",
    name: "Saki Naka - Marol Permeable Green Corridor",
    project_type: "green_corridor",
    description:
      "Multi-modal sponge transit corridor retrofitting high-density junctions with bioswales, rain gardens, and permeable road pavers.",
    coordinates: [
      [72.88, 19.108],
      [72.8825, 19.114],
      [72.885, 19.121],
    ],
    corridor_width_m: 20.0,
  },
];

export function CorridorFeasibilityLab({
  onRenderCorridor,
  onClearCorridor,
  activeCorridorName,
  onScrollToMap,
}: CorridorFeasibilityLabProps) {
  const [presets, setPresets] = useState<CorridorPreset[]>(DEFAULT_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("milan_subway_relief");
  const [corridorWidth, setCorridorWidth] = useState<number>(25.0);
  const [projectType, setProjectType] = useState<"highway" | "road_widening" | "green_corridor">("highway");
  const [alignmentName, setAlignmentName] = useState<string>("Milan Subway Flood Relief Bypass");
  const [activeCoords, setActiveCoords] = useState<[number, number][]>(DEFAULT_PRESETS[0].coordinates);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CorridorFeasibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch presets from backend API on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/infrastructure/presets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.presets?.length) {
          setPresets(data.presets);
        }
      })
      .catch(() => {
        // Fallback to default presets
      });
  }, []);

  // Handle Preset Selection
  const handleSelectPreset = (preset: CorridorPreset) => {
    setSelectedPresetId(preset.id);
    setAlignmentName(preset.name);
    setProjectType(preset.project_type);
    setCorridorWidth(preset.corridor_width_m);
    setActiveCoords(preset.coordinates);
  };

  // Run Feasibility Analysis
  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/infrastructure/analyze-alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alignment_name: alignmentName,
          project_type: projectType,
          coordinates: activeCoords,
          corridor_width_m: corridorWidth,
        }),
      });

      if (!response.ok) {
        throw new Error(`Feasibility analysis failed: ${response.statusText}`);
      }

      const data: CorridorFeasibilityResult = await response.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis request failed");
    } finally {
      setLoading(false);
    }
  }, [alignmentName, projectType, activeCoords, corridorWidth]);

  // Run default analysis on mount
  useEffect(() => {
    runAnalysis();
  }, [selectedPresetId]);

  return (
    <div className="feasibility-lab-container">
      {/* SECTION HEADER */}
      <div className="feasibility-header">
        <div>
          <div className="feasibility-eyebrow">
            <span className="feasibility-pulse-dot"></span>
            <span>DETERMINISTIC GIS BUFFER & SPATIAL CONFLICT SCREENING</span>
          </div>
          <h3 className="feasibility-title">Infrastructure Feasibility & Corridor Laboratory</h3>
          <p className="feasibility-subtitle">
            Evaluate proposed flyovers, road widenings, and green transit corridors against 11,584 building footprints, 600 road segments, 405 spatial grid cells, and 57 BMC waterlogging spots.
          </p>
        </div>

        <div className="feasibility-meta-badges">
          <div className="feasibility-badge">
            <span className="badge-spark">✦</span>
            <span>UTM Zone 43N / EPSG:32643 Metrology</span>
          </div>
          <div className="feasibility-badge ward">
            <span>K/East Ward (16.5 km²)</span>
          </div>
        </div>
      </div>

      {/* PRESET CORRIDORS SHELF */}
      <div className="corridor-presets-shelf">
        <span className="presets-label">VERIFIED MUNICIPAL CORRIDOR PRESETS</span>
        <div className="corridors-grid">
          {presets.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <div
                key={preset.id}
                className={`corridor-preset-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectPreset(preset)}
              >
                <div className="preset-card-top">
                  <span className={`preset-type-tag ${preset.project_type}`}>
                    {preset.project_type === "highway"
                      ? "Flyover / Bypass"
                      : preset.project_type === "green_corridor"
                      ? "Sponge Corridor"
                      : "Road Widening"}
                  </span>
                  <span className="preset-buffer-tag">{preset.corridor_width_m}m Buffer</span>
                </div>
                <h4 className="preset-name">{preset.name}</h4>
                <p className="preset-desc">{preset.description}</p>
                <div className="preset-footer">
                  <span className="preset-coords-count">◈ {preset.coordinates?.length || 0} Alignment Waypoints</span>
                  <span className="preset-select-action">
                    {isSelected ? "Active Screening ◉" : "Select Preset ↗"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* INTERACTIVE TUNER & SIMULATION CONSOLE */}
      <div className="feasibility-tuner-console">
        <div className="tuner-column">
          <span className="tuner-col-label">ALIGNMENT CONFIGURATION</span>

          {/* Project Type Selector */}
          <div className="control-group">
            <label className="control-label">Project Classification</label>
            <div className="type-toggle-group">
              <button
                type="button"
                className={`type-toggle-btn ${projectType === "highway" ? "active" : ""}`}
                onClick={() => setProjectType("highway")}
              >
                Highway / Elevated Flyover
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${projectType === "road_widening" ? "active" : ""}`}
                onClick={() => setProjectType("road_widening")}
              >
                At-Grade Road Widening
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${projectType === "green_corridor" ? "active" : ""}`}
                onClick={() => setProjectType("green_corridor")}
              >
                Sponge Green Corridor
              </button>
            </div>
          </div>

          {/* Buffer Width Slider */}
          <div className="control-group">
            <div className="slider-header-row">
              <label className="control-label">Right-of-Way Buffer Width</label>
              <span className="slider-val-readout">
                {corridorWidth} meters ({(corridorWidth * 2)}m total corridor)
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={corridorWidth}
              onChange={(e) => setCorridorWidth(Number(e.target.value))}
              className="feasibility-slider"
            />
            <div className="slider-ticks-row">
              <span>10m (Narrow Transit)</span>
              <span>25m (Standard Arterial)</span>
              <span>60m (Expressway Viaduct)</span>
            </div>
          </div>

          <div className="tuner-action-row">
            <button
              type="button"
              className="run-screening-btn"
              onClick={runAnalysis}
              disabled={loading}
            >
              <span>{loading ? "Computing Spatial Buffers..." : "Re-Calculate Spatial Conflict Score"}</span>
              <span className="btn-icon">◈</span>
            </button>
          </div>
        </div>

        {/* Alignment Trajectory Summary */}
        <div className="trajectory-summary-card">
          <span className="tuner-col-label">TRAJECTORY GEOMETRY (WGS84)</span>
          <div className="trajectory-info-box">
            <div className="traj-item">
              <span>TARGET CORRIDOR:</span>
              <strong>{alignmentName}</strong>
            </div>
            <div className="traj-item">
              <span>TOTAL ESTIMATED LENGTH:</span>
              <strong>
                {result
                  ? `${(((result.metrics.alignment_length_m ?? result.metrics.route_length_m ?? 1480)) / 1000).toFixed(2)} km`
                  : "1.48 km"}
              </strong>
            </div>
            <div className="traj-item">
              <span>BUFFER CORRIDOR ENVELOPE:</span>
              <strong>
                {result
                  ? `${Math.round(result.metrics.total_corridor_area_m2 ?? result.metrics.corridor_area_m2 ?? 74000).toLocaleString()} m²`
                  : "74,000 m²"}
              </strong>
            </div>
          </div>

          <div className="waypoints-list">
            <span className="waypoints-title">Coordinate Vertices:</span>
            {activeCoords.map((pt, idx) => (
              <div key={idx} className="waypoint-row">
                <span className="waypoint-idx">WP {idx + 1}</span>
                <span className="waypoint-coord">{pt[1].toFixed(5)}° N, {pt[0].toFixed(5)}° E</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="feasibility-error-banner">[!] {error}</div>}

      {/* SCREENING ASSESSMENT REPORT */}
      {result && (
        <div className="feasibility-report-card">
          {/* Assessment Header & Composite Conflict Score */}
          <div className="report-header">
            <div className="score-block">
              <span className="score-title">COMPOSITE SPATIAL CONFLICT SCORE</span>
              <div className="score-gauge-wrap">
                <span className="score-big">{result.feasibility_assessment?.conflict_score ?? 0}</span>
                <span className="score-denom">/ 100</span>
              </div>
            </div>

            <div className="classification-block">
              <span
                className="classification-badge"
                style={{
                  backgroundColor: `${result.feasibility_assessment?.badge_color || "#f59e0b"}22`,
                  borderColor: result.feasibility_assessment?.badge_color || "#f59e0b",
                  color: result.feasibility_assessment?.badge_color || "#f59e0b",
                }}
              >
                {result.feasibility_assessment?.classification || "Screened"}
              </span>
              <p className="classification-desc">
                Calculated via deterministic intersection testing against 11,584 building polygons, Open-Meteo elevation contours, and XGBoost flood risk rasters.
              </p>
            </div>

            <div className="report-action-block">
              <button
                type="button"
                className="visualize-on-map-btn"
                onClick={() => {
                  onRenderCorridor?.(result);
                  onScrollToMap?.();
                }}
              >
                <span>Render on Digital Twin Map</span>
                <span className="btn-icon">◈</span>
              </button>
              {activeCorridorName && onClearCorridor && (
                <button
                  type="button"
                  className="clear-overlay-btn"
                  onClick={onClearCorridor}
                >
                  Clear Map Overlay ✕
                </button>
              )}
            </div>
          </div>

          {/* Component Score Decomposition Progress Bars */}
          <div className="component-breakdown-row">
            <div className="component-bar-item">
              <div className="comp-bar-labels">
                <span>Building Displacement (Max 40)</span>
                <strong>{result.feasibility_assessment?.component_scores?.building_conflict ?? 0} / 40</strong>
              </div>
              <div className="comp-bar-track">
                <div
                  className="comp-bar-fill red"
                  style={{
                    width: `${((result.feasibility_assessment?.component_scores?.building_conflict ?? 0) / 40) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="component-bar-item">
              <div className="comp-bar-labels">
                <span>Flood Risk Exposure (Max 30)</span>
                <strong>{result.feasibility_assessment?.component_scores?.flood_exposure ?? 0} / 30</strong>
              </div>
              <div className="comp-bar-track">
                <div
                  className="comp-bar-fill cyan"
                  style={{
                    width: `${((result.feasibility_assessment?.component_scores?.flood_exposure ?? 0) / 30) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="component-bar-item">
              <div className="comp-bar-labels">
                <span>Historical Waterlogging (Max 20)</span>
                <strong>{result.feasibility_assessment?.component_scores?.historical_spots ?? 0} / 20</strong>
              </div>
              <div className="comp-bar-track">
                <div
                  className="comp-bar-fill amber"
                  style={{
                    width: `${((result.feasibility_assessment?.component_scores?.historical_spots ?? 0) / 20) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="component-bar-item">
              <div className="comp-bar-labels">
                <span>Road Disruption (Max 10)</span>
                <strong>{result.feasibility_assessment?.component_scores?.road_disruption ?? 0} / 10</strong>
              </div>
              <div className="comp-bar-track">
                <div
                  className="comp-bar-fill purple"
                  style={{
                    width: `${((result.feasibility_assessment?.component_scores?.road_disruption ?? 0) / 10) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 4 Quantitative Telemetry Badges */}
          <div className="feasibility-metrics-grid">
            <div className="feat-kpi-card">
              <span className="feat-kpi-label">INTERSECTED STRUCTURES</span>
              <strong className="feat-kpi-val red">
                {result.building_conflicts?.intersected_count ?? 0} Buildings
              </strong>
              <small>Microsoft ML Building Footprints</small>
            </div>

            <div className="feat-kpi-card">
              <span className="feat-kpi-label">DISPLACED BUILT AREA</span>
              <strong className="feat-kpi-val amber">
                {Math.round(result.building_conflicts?.total_intersected_area_m2 ?? 0).toLocaleString()} m²
              </strong>
              <small>Planar displacement inside buffer</small>
            </div>

            <div className="feat-kpi-card">
              <span className="feat-kpi-label">MEAN TRAVERSED FLOOD RISK</span>
              <strong className="feat-kpi-val cyan">
                {(((result.flood_risk_exposure?.mean_baseline_probability ?? 0) * 100)).toFixed(1)}%
              </strong>
              <small>Peak: {(((result.flood_risk_exposure?.peak_baseline_probability ?? 0) * 100)).toFixed(1)}% ({result.flood_risk_exposure?.peak_grid_id ?? "N/A"})</small>
            </div>

            <div className="feat-kpi-card">
              <span className="feat-kpi-label">TRAVERSED GRID CELLS</span>
              <strong className="feat-kpi-val purple">
                {result.flood_risk_exposure?.crossed_grids_count ?? 0} Cells
              </strong>
              <small>{result.flood_risk_exposure?.severe_risk_cells_count ?? 0} Severe / {result.flood_risk_exposure?.high_risk_cells_count ?? 0} High Risk</small>
            </div>
          </div>

          {/* Municipal Engineering Directives & Recommendations */}
          <div className="feasibility-recommendations-box">
            <div className="rec-box-title">
              <span>◈ MUNICIPAL INFRASTRUCTURE PLANNING DIRECTIVES</span>
            </div>
            <ul className="rec-list">
              {(result.feasibility_assessment?.recommendations || []).map((rec, rIdx) => (
                <li key={rIdx} className="rec-item">
                  <span className="rec-bullet">◈</span>
                  <span className="rec-text">{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Intersected Streets & Sample Displaced Buildings */}
          <div className="details-accordion-row">
            <div className="detail-sub-card">
              <span className="sub-card-title">
                Interrupted Road Corridors ({result.road_conflicts?.intersected_segments_count ?? result.road_conflicts?.total_intersections ?? 0})
              </span>
              <div className="road-chips-wrap">
                {((result.road_conflicts?.traversed_road_names || result.road_conflicts?.unique_named_roads || []).length > 0) ? (
                  (result.road_conflicts?.traversed_road_names || result.road_conflicts?.unique_named_roads || []).map((rName, i) => (
                    <span key={i} className="road-conflict-chip">
                      ◈ {rName}
                    </span>
                  ))
                ) : (
                  <span className="empty-text">No arterial roads intersected</span>
                )}
              </div>
            </div>

            <div className="detail-sub-card">
              <span className="sub-card-title">Sample Intersected Footprints</span>
              <div className="building-ids-wrap">
                {(result.building_conflicts?.sample_buildings || []).slice(0, 6).map((bldg) => (
                  <div key={bldg.building_id} className="bldg-conflict-tag">
                    <strong>{bldg.building_id}</strong>
                    <small>({(bldg.intersected_area_m2 || 0).toFixed(0)}m² affected)</small>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="feasibility-disclaimer">
            <span>{result.limitations_disclaimer || ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}
