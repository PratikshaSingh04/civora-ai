import { useState, useEffect, useCallback } from "react";
import type { CustomSimulationResult, GridContextMap } from "../types/civora";

interface WhatIfSandboxProps {
  selectedGridId: string;
  gridContextMap: GridContextMap | null;
  onGridSelect?: (gridId: string) => void;
}

export function WhatIfSandbox({
  selectedGridId,
  gridContextMap,
}: WhatIfSandboxProps) {
  const [ndviDelta, setNdviDelta] = useState<number>(0);
  const [roadDelta, setRoadDelta] = useState<number>(0);
  const [buildingDelta, setBuildingDelta] = useState<number>(0);
  const [simResult, setSimResult] = useState<CustomSimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const context = gridContextMap?.[selectedGridId];

  // Fetch live simulation from backend
  const runSimulation = useCallback(
    async (ndvi: number, road: number, bldg: number) => {
      if (!selectedGridId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("http://127.0.0.1:8000/api/scenarios/simulate-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grid_id: selectedGridId,
            ndvi_delta_pct: ndvi,
            road_density_delta_pct: road,
            building_density_delta_pct: bldg,
          }),
        });

        if (!response.ok) {
          throw new Error(`Simulation failed: ${response.statusText}`);
        }

        const data: CustomSimulationResult = await response.json();
        setSimResult(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Simulation request failed");
      } finally {
        setLoading(false);
      }
    },
    [selectedGridId]
  );

  // Re-run simulation when grid changes or slider values settle
  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation(ndviDelta, roadDelta, buildingDelta);
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedGridId, ndviDelta, roadDelta, buildingDelta, runSimulation]);

  // Apply Quick Presets
  const applyPreset = (ndvi: number, road: number, bldg: number) => {
    setNdviDelta(ndvi);
    setRoadDelta(road);
    setBuildingDelta(bldg);
  };

  const baselineProb = simResult
    ? simResult.baseline_probability * 100
    : context?.baseline_prediction
    ? context.baseline_prediction * 100
    : 0;

  const simulatedProb = simResult ? simResult.simulated_probability * 100 : baselineProb;
  const deltaPp = simResult ? simResult.delta_pp : 0;

  return (
    <div className="what-if-sandbox">
      <div className="sandbox-header">
        <div>
          <span className="sandbox-badge">LIVE XGBOOST INFERENCE</span>
          <h3>What-If Micro-Intervention Sandbox</h3>
          <p className="sandbox-subtitle">
            Targeting Cell <strong>{selectedGridId}</strong> {context?.roads[0] ? `near ${context.roads[0]}` : ""}
          </p>
        </div>

        <div className="sandbox-presets">
          <button
            type="button"
            className="preset-chip sponge"
            onClick={() => applyPreset(30, -20, 0)}
            title="Sponge Corridor: +30% NDVI, -20% Road Density"
          >
            ◈ Sponge Corridor
          </button>
          <button
            type="button"
            className="preset-chip permeable"
            onClick={() => applyPreset(0, -35, 0)}
            title="Porous Pavement: -35% Road Runoff"
          >
            ◈ Porous Pavements
          </button>
          <button
            type="button"
            className="preset-chip green"
            onClick={() => applyPreset(40, 0, 0)}
            title="Intense Greening: +40% NDVI"
          >
            ◈ Urban Canopy
          </button>
          <button
            type="button"
            className="preset-chip reset"
            onClick={() => applyPreset(0, 0, 0)}
            title="Reset to 0% deltas"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {error && <div className="sandbox-error">{error}</div>}

      {/* Probability Gauge & Readout */}
      <div className="sandbox-metrics-banner">
        <div className="metric-box">
          <span className="metric-label">BASELINE RISK</span>
          <span className="metric-value">{baselineProb.toFixed(2)}%</span>
        </div>

        <div className="metric-arrow">➔</div>

        <div className="metric-box simulated">
          <span className="metric-label">SIMULATED RISK</span>
          <span className="metric-value">
            {loading ? "..." : `${simulatedProb.toFixed(2)}%`}
          </span>
        </div>

        <div className={`metric-delta-box ${deltaPp < 0 ? "reduced" : deltaPp > 0 ? "increased" : "neutral"}`}>
          <span className="metric-label">ABSOLUTE DELTA</span>
          <span className="metric-value">
            {deltaPp > 0 ? `+${deltaPp.toFixed(2)} pp` : `${deltaPp.toFixed(2)} pp`}
          </span>
          <small className="metric-pct">
            {simResult ? `${simResult.relative_change_pct.toFixed(2)}% vs baseline` : "0%"}
          </small>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="sliders-grid">
        {/* Slider 1: NDVI / Vegetation */}
        <div className="slider-control">
          <div className="slider-label-row">
            <span className="slider-title">◈ Vegetation & Canopy (NDVI)</span>
            <span className={`slider-val ${ndviDelta > 0 ? "pos" : ndviDelta < 0 ? "neg" : ""}`}>
              {ndviDelta > 0 ? `+${ndviDelta}%` : `${ndviDelta}%`}
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="50"
            step="5"
            value={ndviDelta}
            onChange={(e) => setNdviDelta(Number(e.target.value))}
            className="slider-input ndvi-slider"
          />
          <div className="slider-ticks">
            <span>-30% (Canopy Loss)</span>
            <span>0%</span>
            <span>+50% (Intense Bioswales)</span>
          </div>
        </div>

        {/* Slider 2: Road Runoff / Permeability */}
        <div className="slider-control">
          <div className="slider-label-row">
            <span className="slider-title">◈ Road Runoff / Permeability</span>
            <span className={`slider-val ${roadDelta < 0 ? "pos" : roadDelta > 0 ? "neg" : ""}`}>
              {roadDelta > 0 ? `+${roadDelta}%` : `${roadDelta}%`}
            </span>
          </div>
          <input
            type="range"
            min="-40"
            max="20"
            step="5"
            value={roadDelta}
            onChange={(e) => setRoadDelta(Number(e.target.value))}
            className="slider-input road-slider"
          />
          <div className="slider-ticks">
            <span>-40% (Permeable Retrofit)</span>
            <span>0%</span>
            <span>+20% (Paved Expansion)</span>
          </div>
        </div>

        {/* Slider 3: Building Density */}
        <div className="slider-control">
          <div className="slider-label-row">
            <span className="slider-title">◈ Building Density / Infill</span>
            <span className={`slider-val ${buildingDelta < 0 ? "pos" : buildingDelta > 0 ? "neg" : ""}`}>
              {buildingDelta > 0 ? `+${buildingDelta}%` : `${buildingDelta}%`}
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="20"
            step="5"
            value={buildingDelta}
            onChange={(e) => setBuildingDelta(Number(e.target.value))}
            className="slider-input building-slider"
          />
          <div className="slider-ticks">
            <span>-30% (Reduced Footprint)</span>
            <span>0%</span>
            <span>+20% (Urban Infill)</span>
          </div>
        </div>
      </div>

      {/* Simulated SHAP Impact */}
      {simResult && simResult.shap_explanations.length > 0 && (
        <div className="simulated-shap-preview">
          <span className="shap-preview-title">SIMULATED FEATURE CONTRIBUTIONS (SHAP)</span>
          <div className="shap-mini-bars">
            {simResult.shap_explanations.slice(0, 4).map((f) => (
              <div key={f.feature} className="shap-mini-row">
                <span className="feature-name">{f.feature}</span>
                <div className="mini-bar-track">
                  <div
                    className={`mini-bar-fill ${f.direction === "increases" ? "pos-risk" : "neg-risk"}`}
                    style={{ width: `${Math.min(100, Math.abs(f.shap_value) * 60)}%` }}
                  ></div>
                </div>
                <span className="mini-bar-val">
                  {f.shap_value > 0 ? `+${f.shap_value.toFixed(3)}` : f.shap_value.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

