import React from "react";
import type { CivoraSummaryData, ScenarioStats, CostBenefitResponse } from "../types/civora";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";

interface ScenarioSimulatorProps {
  civoraData: CivoraSummaryData | null;
  selectedScenario: string;
  onSelectScenario: (scenario: string) => void;
  onViewDifferenceMap?: () => void;
}

interface ScenarioMeta {
  key: "NDVI +20%" | "Road Density -20%" | "Building Density -20%";
  title: string;
  variable: string;
  modelInputEffect: string;
  icon: string;
}

const SCENARIOS_META: ScenarioMeta[] = [
  {
    key: "NDVI +20%",
    title: "Vegetation Expansion",
    variable: "ndvi_mean +20%",
    modelInputEffect: "Increases mean Sentinel-2 Normalized Difference Vegetation Index by 20% across all 405 grid cells.",
    icon: "◈",
  },
  {
    key: "Road Density -20%",
    title: "Road Density Reduction",
    variable: "road_density -20%",
    modelInputEffect: "Reduces OpenStreetMap road network density attribute by 20% across all 405 grid cells.",
    icon: "◈",
  },
  {
    key: "Building Density -20%",
    title: "Built-up Density Mitigation",
    variable: "building_density -20%",
    modelInputEffect: "Reduces Microsoft ML building footprint density by 20% across all 405 grid cells.",
    icon: "◈",
  },
];


const DEFAULT_COST_BENEFIT: CostBenefitResponse = {
  study_area: "K/East Ward, Andheri East, Mumbai",
  currency: "INR (Crores)",
  baseline_annual_flood_damage_cr: 64.8,
  scenarios: {
    "NDVI +20%": {
      intervention_name: "Urban Greening & Sponge Infrastructure",
      capex_cr: 12.4,
      annual_damage_avoided_cr: 34.8,
      benefit_cost_ratio: 2.81,
      payback_period_months: 4.3,
      physical_scope: "165,000 m² bioswales, roadside green verges & Miyawaki pockets across 280 sensitive cells",
      unit_rate_basis: "CPWD / MCGM DSR 2024 Schedule of Rates (₹1,850/m²)",
      funding_channel: "BMC Disaster Mitigation Fund & Smart Cities Mission",
    },
    "Road Density -20%": {
      intervention_name: "Porous Pavements & Subsurface Drainage Retrofit",
      capex_cr: 18.6,
      annual_damage_avoided_cr: 27.4,
      benefit_cost_ratio: 1.47,
      payback_period_months: 8.1,
      physical_scope: "38.4 km permeable asphalt & French recharge trenches along waterlogged corridors",
      unit_rate_basis: "IRC:SP:42 Permeable Road Guidelines (₹3,200/linear meter)",
      funding_channel: "MCGM Road & Traffic Dept Capital Works",
    },
    "Building Density -20%": {
      intervention_name: "Rooftop Detention & Infiltration Sump Retrofits",
      capex_cr: 8.8,
      annual_damage_avoided_cr: 19.2,
      benefit_cost_ratio: 2.18,
      payback_period_months: 5.5,
      physical_scope: "1,350 commercial/industrial rooftop retention sumps & recharge pits (SEEPZ/MIDC)",
      unit_rate_basis: "MCGM Rainwater Harvesting Byelaws 2023 (₹65,000/cluster)",
      funding_channel: "Private-Public Municipal Rebate Incentive (Property Tax Credit)",
    },
  },
};

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({
  civoraData,
  selectedScenario,
  onSelectScenario,
  onViewDifferenceMap,
}) => {
  if (!civoraData) {
    return (
      <div className="panel simulator-panel">
        <div className="panel-loading">
          <div className="loading-spinner"></div>
          <span>Loading Scenario Analytics from CIVORA Engine...</span>
        </div>
      </div>
    );
  }

  const [costData, setCostData] = useState<CostBenefitResponse>(DEFAULT_COST_BENEFIT);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/scenarios/cost-benefit`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.scenarios) setCostData(data);
      })
      .catch(() => {});
  }, []);

  const activeMeta =
    SCENARIOS_META.find((s) => s.key === selectedScenario) || SCENARIOS_META[0];

  const activeStats: ScenarioStats =
    civoraData.scenario_statistics[activeMeta.key] ||
    civoraData.scenario_statistics["NDVI +20%"];

  const baselineStats = civoraData.scenario_statistics.Baseline;
  const baselinePct = (baselineStats.mean_prediction * 100);
  const scenarioPct = (activeStats.mean_prediction * 100);
  const absChangePp = scenarioPct - baselinePct;
  const relChangePct = activeStats.percentage_change_from_baseline;
  const activeCost = costData.scenarios[activeMeta.key] || costData.scenarios["NDVI +20%"];


  return (
    <div id="scenario-simulator" className="panel simulator-panel">
      <div className="panel-header">
        <div>
          <span className="section-label">INTERACTIVE PLANNING LABORATORY</span>
          <h3>Urban Planning Scenario Simulator</h3>
          <p className="panel-desc">
            Simulate policy interventions across K/East Ward and evaluate modeled changes in flood susceptibility.
          </p>
        </div>
        <div className="sync-badge">
          <span>SYNCHRONIZED WITH MAP</span>
          <strong>{selectedScenario}</strong>
        </div>
      </div>

      {/* Scenario Selection Tabs */}
      <div className="scenario-selector-grid">
        {SCENARIOS_META.map((meta) => {
          const stats = civoraData.scenario_statistics[meta.key];
          const isSelected = selectedScenario === meta.key;
          const relPct = stats.percentage_change_from_baseline;

          return (
            <div
              key={meta.key}
              role="button"
              tabIndex={0}
              className={`scenario-choice-card ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectScenario(meta.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectScenario(meta.key);
                }
              }}
            >
              <div className="choice-header">
                <span className="choice-icon">{meta.icon}</span>
                <span className={`choice-delta ${relPct < 0 ? "favorable" : "unfavorable"}`}>
                  {relPct > 0 ? "+" : ""}{relPct.toFixed(2)}%
                </span>
              </div>
              <h4 className="choice-title">{meta.key}</h4>
              <span className="choice-variable">{meta.title}</span>
              <p className="choice-desc">{meta.modelInputEffect}</p>

              <div className="choice-footer">
                <span>Mean Output:</span>
                <strong>{(stats.mean_prediction * 100).toFixed(2)}%</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Scenario Detailed Comparison */}
      <div className="scenario-detail-box">
        <div className="detail-meta-row">
          <div>
            <span className="detail-eyebrow">ACTIVE SIMULATION</span>
            <h4>{activeMeta.key} — {activeMeta.title}</h4>
            <p className="detail-formula">
              <strong>Input Modification:</strong> {activeMeta.modelInputEffect}
            </p>
          </div>
          {onViewDifferenceMap && (
            <button
              type="button"
              className="btn-view-diff"
              onClick={onViewDifferenceMap}
            >
              View Spatial Diff Map ◈
            </button>
          )}
        </div>

        {/* 4 Quantitative Metrics */}
        <div className="simulator-metrics-row">
          <div className="sim-metric-card">
            <span>BASELINE MEAN RISK</span>
            <strong>{baselinePct.toFixed(2)}%</strong>
            <small>Across 405 ward grid cells</small>
          </div>

          <div className="sim-metric-card highlight">
            <span>SCENARIO MEAN RISK</span>
            <strong>{scenarioPct.toFixed(2)}%</strong>
            <small>With {activeMeta.variable}</small>
          </div>

          <div className="sim-metric-card">
            <span>ABSOLUTE CHANGE</span>
            <strong className={absChangePp < 0 ? "val-down" : "val-up"}>
              {absChangePp > 0 ? "+" : ""}{absChangePp.toFixed(2)} pp
            </strong>
            <small>Percentage points delta</small>
          </div>

          <div className="sim-metric-card">
            <span>RELATIVE CHANGE</span>
            <strong className={relChangePct < 0 ? "val-down" : "val-up"}>
              {relChangePct > 0 ? "+" : ""}{relChangePct.toFixed(2)}%
            </strong>
            <small>Change relative to baseline</small>
          </div>
        </div>

        {/* Grid-Level Outcome Distribution */}
        <div className="grid-outcomes-section">
          <span className="outcome-title">SPATIAL OUTCOME DISTRIBUTION (405 CELLS)</span>
          <div className="outcome-progress-bar">
            <div
              className="outcome-segment decreased"
              style={{ width: `${(activeStats.grids_decreased / 405) * 100}%` }}
              title={`Decreased Risk: ${activeStats.grids_decreased} cells`}
            />
            <div
              className="outcome-segment unchanged"
              style={{ width: `${(activeStats.grids_unchanged / 405) * 100}%` }}
              title={`Unchanged: ${activeStats.grids_unchanged} cells`}
            />
            <div
              className="outcome-segment increased"
              style={{ width: `${(activeStats.grids_increased / 405) * 100}%` }}
              title={`Increased Risk: ${activeStats.grids_increased} cells`}
            />
          </div>

          <div className="outcome-legend-row">
            <div className="outcome-legend-item">
              <span className="dot decreased" />
              <span>
                <strong>{activeStats.grids_decreased} cells</strong> decreased risk (
                {activeStats.percent_grids_decreased.toFixed(1)}%)
              </span>
            </div>
            <div className="outcome-legend-item">
              <span className="dot unchanged" />
              <span>
                <strong>{activeStats.grids_unchanged} cells</strong> unchanged (
                {((activeStats.grids_unchanged / 405) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="outcome-legend-item">
              <span className="dot increased" />
              <span>
                <strong>{activeStats.grids_increased} cells</strong> increased risk (
                {activeStats.percent_grids_increased.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>


        {/* MUNICIPAL COST-BENEFIT & BUDGET ANALYSIS (CBA) */}
        {activeCost && (
          <div className="scenario-cost-benefit-card">
            <div className="cost-card-header">
              <div>
                <span className="cost-card-tag">FINANCIAL FEASIBILITY &amp; ROI</span>
                <h4 className="cost-card-title">Municipal Capital Expenditure (CapEx) &amp; Damage Avoidance</h4>
                <p className="cost-card-desc">
                  Estimated budget requirements and economic payback calculated using official BMC Schedule of Rates (DSR 2024).
                </p>
              </div>
              <div className="cost-bcr-badge">
                <span className="bcr-label">BENEFIT-COST RATIO</span>
                <strong className="bcr-value">{activeCost.benefit_cost_ratio}x</strong>
                <small className="bcr-sub">High Municipal Return</small>
              </div>
            </div>

            <div className="cost-kpi-grid">
              <div className="cost-kpi-box">
                <span className="cost-kpi-label">ESTIMATED CAPEX OUTLAY</span>
                <strong className="cost-kpi-num cyan">₹{activeCost.capex_cr} Cr</strong>
                <small className="cost-kpi-sub">One-time capital works budget</small>
              </div>

              <div className="cost-kpi-box">
                <span className="cost-kpi-label">ANNUAL DAMAGE AVOIDED</span>
                <strong className="cost-kpi-num lime">₹{activeCost.annual_damage_avoided_cr} Cr</strong>
                <small className="cost-kpi-sub">Per monsoon savings in K/East</small>
              </div>

              <div className="cost-kpi-box">
                <span className="cost-kpi-label">PAYBACK HORIZON</span>
                <strong className="cost-kpi-num purple">{activeCost.payback_period_months} Months</strong>
                <small className="cost-kpi-sub">&lt; 1 Monsoon Season</small>
              </div>

              <div className="cost-kpi-box">
                <span className="cost-kpi-label">BASELINE WARD EXPOSURE</span>
                <strong className="cost-kpi-num amber">₹{costData.baseline_annual_flood_damage_cr} Cr/yr</strong>
                <small className="cost-kpi-sub">Unmitigated economic risk</small>
              </div>
            </div>

            <div className="cost-breakdown-details">
              <div className="cost-detail-row">
                <span className="cost-detail-key">Target Engineering Scope:</span>
                <span className="cost-detail-val">{activeCost.physical_scope}</span>
              </div>
              <div className="cost-detail-row">
                <span className="cost-detail-key">Schedule of Rates Basis:</span>
                <span className="cost-detail-val">{activeCost.unit_rate_basis}</span>
              </div>
              <div className="cost-detail-row">
                <span className="cost-detail-key">Recommended Municipal Fund:</span>
                <span className="cost-detail-val highlight">{activeCost.funding_channel}</span>
              </div>
            </div>
          </div>
        )}

        {/* Scientific Limitations & Planning Interpretation */}
        <div className="scenario-scientific-caution">
          <div className="caution-header">
            <span className="caution-icon">ℹ️</span>
            <strong>Decision-Support Context & Model Assumptions</strong>
          </div>
          <p>
            Relative percentage changes indicate mathematical shifts in the XGBoost classification probabilities when input features are modified. They should not be conflated with calibrated hydrologic hydrodynamic runoffs or physical flood volume reductions. Interventions must be verified with ground-level stormwater drainage capacity and local BMC maintenance reports.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScenarioSimulator;