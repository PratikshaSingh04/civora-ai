import { useEffect, useState, useMemo, useCallback } from "react";
import "./App.css";

import CivoraMap from "./components/CivoraMap";
import GridInspector from "./components/GridInspector";
import HotspotExplorer from "./components/HotspotExplorer";
import ScenarioSimulator from "./components/ScenarioSimulator";
import { WhatIfSandbox } from "./components/WhatIfSandbox";
import { UrbanCopilot } from "./components/UrbanCopilot";
import { ValidationBenchmark } from "./components/ValidationBenchmark";
import { DossierModal } from "./components/DossierModal";
import { AuthModal } from "./components/AuthModal";
import { QuickstartBanner } from "./components/QuickstartBanner";
import { CorridorFeasibilityLab } from "./components/CorridorFeasibilityLab";
import { ArchitectureModal } from "./components/ArchitectureModal";

import type {
  CivoraSummaryData,
  ExplanationData,
  GridContextMap,
  HotspotItem,
  MapLayer,
  UserProfile,
  SuitableSite,
  DepartmentRole,
} from "./types/civora";

export type NavView =
  | "overview"
  | "digital-twin"
  | "scenario-lab"
  | "what-if"
  | "infrastructure"
  | "ai-copilot"
  | "validation"
  | "dossiers"
  | "data-provenance";

export default function App() {
  // Navigation active view (defaults to overview)
  const [activeNav, setActiveNav] = useState<NavView>("overview");

  // Authentication & Department Role State (Synopsis Chapter 4 & 5)
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: "usr_plan_01",
    name: "Pratiksha Singh",
    email: "planner@mcgm.gov.in",
    department_id: "urban_planning",
    department_name: "Urban Planning Department",
    designation: "Lead Urban Planner",
    clearance_level: "Level 3 (Planning Clearance)",
    token: "civora_session_default",
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState(false);
  const [showQuickstart, setShowQuickstart] = useState(true);

  // Digital Twin Interactive Overlay State
  const [highlightedSite, setHighlightedSite] = useState<SuitableSite | null>(null);
  const [activeCorridorData, setActiveCorridorData] = useState<any | null>(null);

  // Core state
  const [selectedGridId, setSelectedGridId] = useState("KE_G_0024");
  const [selectedScenario, setSelectedScenario] = useState("NDVI +20%");
  const [activeLayer, setActiveLayer] = useState<MapLayer>("ndvi");
  const [viewDimension, setViewDimension] = useState<"2d" | "3d">("2d");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Data states
  const [civoraData, setCivoraData] = useState<CivoraSummaryData | null>(null);
  const [gridContextMap, setGridContextMap] = useState<GridContextMap | null>(null);
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [explanationData, setExplanationData] = useState<ExplanationData | null>(null);
  const [explanationError, setExplanationError] = useState("");
  const [apiError, setApiError] = useState("");

  // Synchronized Scenario Selection Handler
  const handleSelectScenario = useCallback((scenarioKey: string) => {
    setSelectedScenario(scenarioKey);
    const layerMap: Record<string, MapLayer> = {
      "NDVI +20%": "ndvi",
      "Road Density -20%": "road",
      "Building Density -20%": "building",
    };
    setActiveLayer(layerMap[scenarioKey] ?? "scenario");
  }, []);

  // Fetch Global Scenario Summary
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/scenarios")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch scenario summary");
        return res.json();
      })
      .then((data: CivoraSummaryData) => setCivoraData(data))
      .catch((err) => {
        console.warn("Backend scenarios unavailable, using fallback cache:", err);
        setApiError("Backend connecting...");
      });
  }, []);

  // Fetch Precomputed Verified Grid Context (roads, flood spots, features)
  useEffect(() => {
    fetch("/data/K_East_Grid_Context.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GridContextMap) => {
        if (data) setGridContextMap(data);
      })
      .catch((err) => console.warn("Grid context load error:", err));
  }, []);

  // Fetch Ranked Hotspots from Backend or Compute from Grid Context
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/scenarios/hotspots?limit=50")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.hotspots && data.hotspots.length > 0) {
          setHotspots(data.hotspots);
        }
      })
      .catch(() => {
        // Will fallback to gridContextMap
      });
  }, []);

  // Derive hotspots from gridContextMap if backend endpoint wasn't reached
  const effectiveHotspots = useMemo<HotspotItem[]>(() => {
    if (hotspots.length > 0 && gridContextMap) {
      return hotspots.map((h) => ({
        ...h,
        roads: gridContextMap[h.grid_id]?.roads,
        flood_spots: gridContextMap[h.grid_id]?.flood_spots,
      }));
    }

    if (!gridContextMap) return [];

    const items = Object.values(gridContextMap)
      .filter((g) => g.baseline_prediction !== null)
      .sort((a, b) => (b.baseline_prediction ?? 0) - (a.baseline_prediction ?? 0));

    return items.map((item, idx) => ({
      rank: idx + 1,
      grid_id: item.grid_id,
      baseline_prediction: item.baseline_prediction ?? 0,
      ndvi_prediction: item.ndvi_prediction ?? 0,
      road_prediction: item.road_prediction ?? 0,
      building_prediction: item.building_prediction ?? 0,
      dominant_scenario: item.dominant_scenario ?? "NDVI +20%",
      maximum_absolute_change: item.maximum_absolute_change ?? 0,
      impact_magnitude: item.impact_magnitude ?? "Moderate",
      roads: item.roads,
      flood_spots: item.flood_spots,
    }));
  }, [hotspots, gridContextMap]);

  // Fetch SHAP Explanation for Selected Grid
  useEffect(() => {
    let isMounted = true;

    fetch(`http://127.0.0.1:8000/api/explanation/${selectedGridId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load SHAP explanation");
        return res.json();
      })
      .then((data: ExplanationData) => {
        if (isMounted) {
          setExplanationData(data);
          setExplanationError("");
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("CIVORA SHAP fetch error:", err);
          setExplanationError(
            `Unable to generate real-time SHAP explanation for ${selectedGridId}. Ensure backend is running.`
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedGridId]);

  const selectedGridItem = useMemo(() => {
    return gridContextMap ? gridContextMap[selectedGridId] ?? null : null;
  }, [gridContextMap, selectedGridId]);

  const handleSelectDepartment = useCallback((deptId: DepartmentRole) => {
    fetch(`http://127.0.0.1:8000/api/auth/me?department_id=${deptId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        const names: Record<DepartmentRole, { name: string; designation: string }> = {
          urban_planning: { name: "Urban Planning Department", designation: "Lead Urban Planner" },
          disaster_management: { name: "Disaster Management Cell", designation: "Chief Disaster Officer" },
          traffic_transport: { name: "Traffic & Roads Authority", designation: "Superintending Engineer" },
          health_sanitation: { name: "Public Health Department", designation: "Chief Medical Planning Officer" },
          municipal_admin: { name: "Municipal Administration", designation: "Additional Municipal Commissioner" },
        };
        setCurrentUser((prev) => ({
          ...prev,
          department_id: deptId,
          department_name: names[deptId].name,
          designation: names[deptId].designation,
        }));
      });
  }, []);

  const handleQuickstartGoal = useCallback((goalType: "hotspots" | "hospital" | "flyover" | "sponge") => {
    if (goalType === "hotspots") {
      setSelectedGridId("KE_G_0024");
      setActiveLayer("baseline");
      setActiveNav("digital-twin");
    } else if (goalType === "hospital") {
      setActiveNav("ai-copilot");
    } else if (goalType === "flyover") {
      fetch("http://127.0.0.1:8000/api/infrastructure/analyze-alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alignment_name: "Milan Subway Relief Bypass",
          project_type: "highway",
          coordinates: [
            [72.8442, 19.1028],
            [72.851, 19.1065],
            [72.8575, 19.1102],
          ],
          corridor_width_m: 25.0,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setActiveCorridorData(data);
            setActiveNav("digital-twin");
          }
        })
        .catch(() => {
          setActiveNav("infrastructure");
        });
    } else if (goalType === "sponge") {
      setActiveNav("scenario-lab");
    }
  }, []);

  // Human-readable feature names and units
  const featureMeta: Record<string, { label: string; unit: string; description: string }> = {
    building_area_m2_sum: {
      label: "Building Area",
      unit: "m²",
      description: "Total building footprint area in grid cell (Microsoft ML)",
    },
    building_density: {
      label: "Building Density",
      unit: "ratio",
      description: "Ratio of building footprints to grid cell area",
    },
    ndvi_mean: {
      label: "Vegetation Index (NDVI)",
      unit: "index",
      description: "Sentinel-2 mean Normalized Difference Vegetation Index",
    },
    road_length_m_sum: {
      label: "Road Length",
      unit: "m",
      description: "Total road network length in cell (OpenStreetMap)",
    },
    road_density: {
      label: "Road Density",
      unit: "ratio",
      description: "Road length per unit area",
    },
    idw250_mean: {
      label: "Terrain Elevation",
      unit: "m AMSL",
      description: "Mean elevation interpolated via 250m IDW (Open-Meteo)",
    },
  };

  const navLabels: Record<NavView, string> = {
    overview: "Overview Dashboard",
    "digital-twin": "Digital Twin Map",
    "scenario-lab": "Scenario Lab",
    "what-if": "What-If Sandbox",
    infrastructure: "Infrastructure Lab",
    "ai-copilot": "AI Planning Copilot",
    validation: "Validation & Insights",
    dossiers: "Planning Dossiers",
    "data-provenance": "Data & Provenance",
  };

  return (
    <div className="civora-app">
      {/* PERSISTENT LEFT SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="brand" onClick={() => setActiveNav("overview")} style={{ cursor: "pointer" }} title="CIVORA AI — K/East Ward Digital Twin">
          <img src="/CIVORA_EMBLEM.svg" alt="CIVORA AI" className="brand-emblem-image" />
          <div className="brand-titles">
            <h1>CIVORA AI</h1>
            <span className="brand-tagline">K/EAST DIGITAL TWIN</span>
          </div>
        </div>

        <nav className="navigation">
          <div className="nav-section">CORE WORKSPACE</div>
          <button
            type="button"
            className={`nav-item ${activeNav === "overview" ? "active" : ""}`}
            onClick={() => setActiveNav("overview")}
          >
            <span>⌂</span> Overview
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "digital-twin" ? "active" : ""}`}
            onClick={() => setActiveNav("digital-twin")}
          >
            <span>◈</span> Digital Twin Map
          </button>

          <div className="nav-section">PLANNING INTERVENTIONS</div>
          <button
            type="button"
            className={`nav-item ${activeNav === "scenario-lab" ? "active" : ""}`}
            onClick={() => setActiveNav("scenario-lab")}
          >
            <span>◉</span> Scenario Lab
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "what-if" ? "active" : ""}`}
            onClick={() => setActiveNav("what-if")}
          >
            <span>⌖</span> What-If Sandbox
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "infrastructure" ? "active" : ""}`}
            onClick={() => setActiveNav("infrastructure")}
          >
            <span>⎈</span> Infrastructure Lab
          </button>

          <div className="nav-section">EVIDENCE & DECISION SUPPORT</div>
          <button
            type="button"
            className={`nav-item ${activeNav === "ai-copilot" ? "active" : ""}`}
            onClick={() => setActiveNav("ai-copilot")}
          >
            <span>✦</span> AI Planning Copilot
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "validation" ? "active" : ""}`}
            onClick={() => setActiveNav("validation")}
          >
            <span>§</span> Validation & Insights
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "dossiers" ? "active" : ""}`}
            onClick={() => setActiveNav("dossiers")}
          >
            <span>▤</span> Planning Dossiers
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "data-provenance" ? "active" : ""}`}
            onClick={() => setActiveNav("data-provenance")}
          >
            <span>▦</span> Data & Provenance
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div
            className="system-status"
            onClick={() => setIsAuthModalOpen(true)}
            style={{ cursor: "pointer", marginBottom: "12px" }}
            title="Switch Department Role"
          >
            <div className="status-dot"></div>
            <div>
              <strong>{currentUser.designation}</strong>
              <small>{currentUser.department_name} ▾</small>
            </div>
          </div>

          <button
            type="button"
            className="topbar-arch-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => setIsArchModalOpen(true)}
          >
            <span>◈</span> System Architecture
          </button>
        </div>
      </aside>

      {/* TOP COMMAND BAR */}
      <header className="civora-topbar">
        <div className="topbar-left">
          <div className="topbar-area-badge">
            <span className="topbar-dot"></span>
            K/EAST WARD, MUMBAI (16.5 km²)
          </div>

          <div className="topbar-view-title">
            <span className="view-sep">/</span>
            {navLabels[activeNav]}
          </div>

          <button
            type="button"
            className="topbar-grid-chip"
            onClick={() => setActiveNav("digital-twin")}
            title="Inspect Selected Cell in Digital Twin Map"
          >
            <span>Cell:</span>
            <strong>{selectedGridId}</strong>
            <span>↗</span>
          </button>
        </div>

        <div className="topbar-right">
          <div className="topbar-engine-status">
            <span className={`telemetry-dot live ${apiError ? "warning" : ""}`} />
            <span>AI: <strong>{apiError ? "Spatial Cache" : "XGBoost + TreeSHAP (92.65%)"}</strong></span>
          </div>

          <button
            type="button"
            className="topbar-role-chip"
            onClick={() => setIsAuthModalOpen(true)}
            title="Switch Municipal Department Role"
          >
            <span className="role-pulse-dot" />
            <span>{currentUser.department_name}</span>
            <span className="role-switch-chevron">▾</span>
          </button>

          <button
            type="button"
            className="topbar-dossier-btn"
            onClick={() => setIsDossierOpen(true)}
            title="Export Official Municipal Planning Dossier"
          >
            <span>▤</span> Export Dossier ↗
          </button>
        </div>
      </header>

      {/* WORKSPACE VIEWPORT */}
      <main className={`main-content ${activeNav === "digital-twin" ? "full-bleed-view" : ""}`}>
        {/* ========================================================================= */}
        {/* VIEW 1: OVERVIEW DASHBOARD */}
        {/* ========================================================================= */}
        {activeNav === "overview" && (
          <div className="view-container">
            {/* LIVE TELEMETRY STRIP */}
            <div className="telemetry-strip-wrapper">
              <div className="telemetry-strip-inner">
                <div className="telemetry-item">
                  <span className={`telemetry-dot live ${apiError ? "warning" : ""}`} />
                  <span className="telemetry-label">AI Engine:</span>
                  <strong>{apiError ? "Local Spatial GIS Cache" : "XGBoost + TreeSHAP (92.65% Capture)"}</strong>
                </div>
                <div className="telemetry-sep">/</div>
                <div className="telemetry-item">
                  <span className="telemetry-label">Grid Coverage:</span>
                  <strong>405 Spatial Cells (250m)</strong>
                </div>
                <div className="telemetry-sep">/</div>
                <div className="telemetry-item">
                  <span className="telemetry-label">Buildings:</span>
                  <strong>11,584 Footprints (Microsoft ML)</strong>
                </div>
                <div className="telemetry-sep">/</div>
                <div className="telemetry-item">
                  <span className="telemetry-label">Roads:</span>
                  <strong>117.94 km Verified Network</strong>
                </div>
                <div className="telemetry-sep">/</div>
                <div className="telemetry-item">
                  <span className="telemetry-label">Ground Truth:</span>
                  <strong>57 Official BMC Flood Spots</strong>
                </div>
              </div>
            </div>

            {/* GOAL-DRIVEN ONBOARDING QUICKSTART BANNER */}
            {showQuickstart && (
              <QuickstartBanner
                onSelectGoal={handleQuickstartGoal}
                onDismiss={() => setShowQuickstart(false)}
              />
            )}

            {/* COMPACT HERO */}
            <section className="hero-section">
              <div className="hero-content">
                <div className="hero-tag">
                  <span className="hero-dot"></span>
                  PILOT EXTENT: K/EAST WARD, MUMBAI (ANDHERI EAST)
                </div>

                <h2>
                  Geospatial Intelligence for Urban Flood Risk & What-If Planning
                </h2>

                <p>
                  CIVORA AI models urban flood vulnerability across 405 spatial grid cells using verified municipal GIS layers, an XGBoost classification engine, TreeSHAP feature attribution, and planning intervention simulations.
                </p>

                <div className="hero-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setActiveNav("digital-twin")}
                  >
                    Explore Digital Twin Map ◈
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setActiveNav("scenario-lab")}
                  >
                    Open Scenario Simulator ◉
                  </button>
                </div>
              </div>

              <div className="hero-stats-card">
                <div className="hero-stat-row">
                  <span>ANALYSIS COVERAGE</span>
                  <strong>405 Grid Cells</strong>
                </div>
                <div className="hero-stat-row">
                  <span>PILOT BOUNDARY</span>
                  <strong>K/East Ward (16.5 km²)</strong>
                </div>
                <div className="hero-stat-row">
                  <span>RECORDED BMC FLOOD SPOTS</span>
                  <strong>57 Official Locations</strong>
                </div>
                <div className="hero-stat-row">
                  <span>AI INFERENCE ENGINE</span>
                  <strong>XGBoost + TreeSHAP</strong>
                </div>
              </div>
            </section>

            {/* 4 ACTION PATHWAYS */}
            <div className="overview-action-grid">
              <div className="overview-action-card" onClick={() => setActiveNav("digital-twin")}>
                <div>
                  <div className="overview-card-header">
                    <div className="overview-card-icon purple">🌐</div>
                    <h4>1. Explore 2D & 3D Digital Twin</h4>
                  </div>
                  <p>
                    Interactive 2D GIS and 3D WebGL Digital Twin with 11,584 extruded building footprints, volumetric flood inundation simulation, and corridor conflict envelopes.
                  </p>
                </div>
                <div className="overview-card-cta">Open 3D Digital Twin Workspace ↗</div>
              </div>

              <div className="overview-action-card" onClick={() => setActiveNav("scenario-lab")}>
                <div>
                  <div className="overview-card-header">
                    <div className="overview-card-icon green">◉</div>
                    <h4>2. Test Policy Scenarios</h4>
                  </div>
                  <p>
                    Evaluate ward-wide impact of NDVI +20% (Urban Canopy), Road Density -20% (Porous Pavements), and Building Density -20%.
                  </p>
                </div>
                <div className="overview-card-cta">Compare Policy Scenarios ↗</div>
              </div>

              <div className="overview-action-card" onClick={() => setActiveNav("infrastructure")}>
                <div>
                  <div className="overview-card-header">
                    <div className="overview-card-icon orange">⎈</div>
                    <h4>3. Screen Infrastructure</h4>
                  </div>
                  <p>
                    Deterministic GIS screening for Milan Subway Bypass & JVLR Express: calculate structural building conflicts and flood exposure.
                  </p>
                </div>
                <div className="overview-card-cta">Run Corridor Feasibility ↗</div>
              </div>

              <div className="overview-action-card" onClick={() => setActiveNav("ai-copilot")}>
                <div>
                  <div className="overview-card-header">
                    <div className="overview-card-icon cyan">✦</div>
                    <h4>4. Consult AI Copilot</h4>
                  </div>
                  <p>
                    Ask spatial planning questions, find optimal hospital candidate sites, and diagnose localized flood drivers with Gemini AI.
                  </p>
                </div>
                <div className="overview-card-cta">Launch AI Planning Copilot ↗</div>
              </div>
            </div>

            {/* 5-METRIC STRIP */}
            <section className="metrics-strip">
              <div className="metric-box">
                <div className="metric-icon purple">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </div>
                <div>
                  <span>GRID COVERAGE</span>
                  <strong>{civoraData?.total_grids ?? 405}</strong>
                  <small>Analysis grid cells</small>
                </div>
              </div>

              <div className="metric-box">
                <div className="metric-icon cyan">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12c1.5-1.5 3.5-1.5 5 0s3.5 1.5 5 0 3.5-1.5 5 0" />
                    <path d="M2 17c1.5-1.5 3.5-1.5 5 0s3.5 1.5 5 0 3.5-1.5 5 0" />
                  </svg>
                </div>
                <div>
                  <span>BASELINE MEAN RISK</span>
                  <strong>
                    {civoraData
                      ? `${(civoraData.baseline_mean_prediction * 100).toFixed(2)}%`
                      : "16.87%"}
                  </strong>
                  <small>Mean predicted output</small>
                </div>
              </div>

              <div className="metric-box">
                <div className="metric-icon green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                  </svg>
                </div>
                <div>
                  <span>NDVI +20% IMPACT</span>
                  <strong>
                    {civoraData
                      ? `${civoraData.scenario_statistics["NDVI +20%"].percentage_change_from_baseline.toFixed(2)}%`
                      : "-3.62%"}
                  </strong>
                  <small>Mean relative change</small>
                </div>
              </div>

              <div className="metric-box">
                <div className="metric-icon orange">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19L8 5" />
                    <path d="M16 5L20 19" />
                    <path d="M12 7V9" />
                    <path d="M12 13V15" />
                    <path d="M12 19V21" />
                  </svg>
                </div>
                <div>
                  <span>ROAD DENSITY -20%</span>
                  <strong>
                    {civoraData
                      ? `${civoraData.scenario_statistics["Road Density -20%"].percentage_change_from_baseline.toFixed(2)}%`
                      : "-1.76%"}
                  </strong>
                  <small>Mean relative change</small>
                </div>
              </div>

              <div className="metric-box">
                <div className="metric-icon red">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <path d="M9 22v-4h6v4" />
                    <path d="M8 6h.01" />
                    <path d="M16 6h.01" />
                    <path d="M8 10h.01" />
                    <path d="M16 10h.01" />
                    <path d="M8 14h.01" />
                    <path d="M16 14h.01" />
                  </svg>
                </div>
                <div>
                  <span>BUILDING DENSITY -20%</span>
                  <strong>
                    {civoraData
                      ? `${civoraData.scenario_statistics["Building Density -20%"].percentage_change_from_baseline.toFixed(2)}%`
                      : "-0.29%"}
                  </strong>
                  <small>Mean relative change</small>
                </div>
              </div>
            </section>

            {/* TOP HOTSPOTS SUMMARY PREVIEW */}
            <div style={{ marginTop: "32px" }}>
              <HotspotExplorer
                hotspots={effectiveHotspots.slice(0, 15)}
                selectedGridId={selectedGridId}
                onSelectGrid={(gid) => {
                  setSelectedGridId(gid);
                  setActiveNav("digital-twin");
                }}
                onExploreSHAP={(gid) => {
                  setSelectedGridId(gid);
                  setActiveNav("validation");
                }}
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: DIGITAL TWIN MAP — PRIMARY WORKSPACE */}
        {/* ========================================================================= */}
        {activeNav === "digital-twin" && (
          <div className="view-digital-twin">
            {/* Top Toolbar */}
            <div className="twin-section-header">
              <div>
                <span className="section-label">CENTRAL DIGITAL TWIN EXPERIENCE</span>
                <h3 style={{ margin: "2px 0 0 0", fontSize: "18px" }}>Spatial Digital Twin & Live Inspector</h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Mode Switcher */}
                <div className="dimension-switcher">
                  <button
                    type="button"
                    className={`dim-pill ${viewDimension === "2d" ? "active" : ""}`}
                    onClick={() => setViewDimension("2d")}
                    title="Switch to 2D Cartographic GIS Map"
                  >
                    🗺️ 2D Map
                  </button>
                  <button
                    type="button"
                    className={`dim-pill ${viewDimension === "3d" ? "active" : ""}`}
                    onClick={() => setViewDimension("3d")}
                    title="Switch to 3D Digital Twin with 11,584 Extruded Buildings"
                  >
                    🌐 3D Digital Twin
                  </button>
                </div>

                {/* Layer Selection Dropdown */}
                <div className="layer-picker">
                  <button
                    type="button"
                    className="layer-picker-btn"
                    onClick={() => setShowLayerMenu(!showLayerMenu)}
                  >
                    <span>Active Layer: <strong>{activeLayer.toUpperCase()}</strong></span>
                    <span>▾</span>
                  </button>

                {showLayerMenu && (
                  <div className="layer-menu-dropdown">
                    <button
                      type="button"
                      className={activeLayer === "scenario" ? "active" : ""}
                      onClick={() => {
                        setActiveLayer("scenario");
                        setShowLayerMenu(false);
                      }}
                    >
                      Dominant Scenario Layer
                    </button>
                    <button
                      type="button"
                      className={activeLayer === "baseline" ? "active" : ""}
                      onClick={() => {
                        setActiveLayer("baseline");
                        setShowLayerMenu(false);
                      }}
                    >
                      Baseline Flood Probability Layer
                    </button>
                    <button
                      type="button"
                      className={activeLayer === "difference" ? "active" : ""}
                      onClick={() => {
                        setActiveLayer("difference");
                        setShowLayerMenu(false);
                      }}
                    >
                      {selectedScenario} Spatial Difference
                    </button>
                    <button
                      type="button"
                      className={activeLayer === "ndvi" ? "active" : ""}
                      onClick={() => {
                        setActiveLayer("ndvi");
                        setShowLayerMenu(false);
                      }}
                    >
                      NDVI Scenario Impact Layer
                    </button>
                    <button
                      type="button"
                      className={activeLayer === "road" ? "active" : ""}
                      onClick={() => {
                        setActiveLayer("road");
                        setShowLayerMenu(false);
                      }}
                    >
                      Road Density Scenario Impact Layer
                    </button>
                    <button
                      type="button"
                      className={activeLayer === "building" ? "active" : ""}
                      onClick={() => {
                        setActiveLayer("building");
                        setShowLayerMenu(false);
                      }}
                    >
                      Building Density Scenario Impact Layer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Split View: Map + Inspector */}
            <div className="twin-workbench">
              <div className="twin-map-container">
                <CivoraMap
                  activeLayer={activeLayer}
                  selectedGridId={selectedGridId}
                  selectedScenario={selectedScenario}
                  onGridSelect={(gid) => setSelectedGridId(gid)}
                  gridContextMap={gridContextMap}
                  highlightedSite={highlightedSite}
                  activeCorridorData={activeCorridorData}
                  onClearCorridor={() => setActiveCorridorData(null)}
                  onClearSite={() => setHighlightedSite(null)}
                  viewDimension={viewDimension}
                  onDimensionChange={setViewDimension}
                />
              </div>

              <div className="twin-inspector-sidebar">
                <GridInspector
                  grid={selectedGridItem}
                  selectedScenario={selectedScenario}
                  onExploreSHAP={() => setActiveNav("validation")}
                  onCenterMap={() => {
                    setSelectedGridId((prev) => prev);
                  }}
                  onOpenWhatIf={() => setActiveNav("what-if")}
                  onExportDossier={() => setIsDossierOpen(true)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: SCENARIO SIMULATION LABORATORY */}
        {/* ========================================================================= */}
        {activeNav === "scenario-lab" && (
          <div className="view-container">
            <ScenarioSimulator
              civoraData={civoraData}
              selectedScenario={selectedScenario}
              onSelectScenario={handleSelectScenario}
              onViewDifferenceMap={() => {
                setActiveLayer("difference");
                setActiveNav("digital-twin");
              }}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: WHAT-IF MICRO-INTERVENTION SANDBOX */}
        {/* ========================================================================= */}
        {activeNav === "what-if" && (
          <div className="view-container">
            <WhatIfSandbox
              selectedGridId={selectedGridId}
              gridContextMap={gridContextMap}
              onGridSelect={(gid) => {
                setSelectedGridId(gid);
                setActiveNav("digital-twin");
              }}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 5: INFRASTRUCTURE & CORRIDOR FEASIBILITY LAB */}
        {/* ========================================================================= */}
        {activeNav === "infrastructure" && (
          <div className="view-container">
            <CorridorFeasibilityLab
              onRenderCorridor={(corridor) => {
                setActiveCorridorData(corridor);
                setActiveNav("digital-twin");
              }}
              onClearCorridor={() => setActiveCorridorData(null)}
              activeCorridorName={activeCorridorData?.alignment_name}
              onScrollToMap={() => setActiveNav("digital-twin")}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 6: AI PLANNING COPILOT */}
        {/* ========================================================================= */}
        {activeNav === "ai-copilot" && (
          <div className="view-container">
            <UrbanCopilot
              gridContextMap={gridContextMap}
              selectedGridId={selectedGridId}
              currentUser={currentUser}
              onFocusGrid={(gid) => {
                setSelectedGridId(gid);
                setActiveNav("digital-twin");
              }}
              onOpenWhatIf={() => setActiveNav("what-if")}
              onHighlightSite={(site) => {
                setHighlightedSite(site);
                setSelectedGridId(site.grid_id);
                setActiveNav("digital-twin");
              }}
              onRenderCorridor={(corridor) => {
                setActiveCorridorData(corridor);
                setActiveNav("digital-twin");
              }}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 7: VALIDATION & ACADEMIC INSIGHTS */}
        {/* ========================================================================= */}
        {activeNav === "validation" && (
          <div className="view-container">
            <ValidationBenchmark
              onFocusGrid={(gid) => {
                setSelectedGridId(gid);
                setActiveNav("digital-twin");
              }}
            />

            {/* INTEGRATED EXPLAINABLE AI (SHAP) SECTION */}
            <div className="panel explanation-panel" style={{ marginTop: "32px" }}>
              <div className="panel-header">
                <div>
                  <span className="section-label">EXPLAINABLE AI ENGINE</span>
                  <h3>Why Did the Model Predict This for Grid {selectedGridId}?</h3>
                  <p className="panel-desc">
                    Local feature contributions computed via TreeSHAP (SHapley Additive exPlanations) in raw model margin space, revealing which environmental and infrastructure factors drive flood risk.
                  </p>
                </div>
                <div className="ai-model-badge">
                  ✦ XGBoost + TreeSHAP
                </div>
              </div>

              <div className="shap-content-card">
                <div className="shap-header-meta">
                  <div className="shap-cell-info">
                    <span>INSPECTED GRID</span>
                    <strong>{selectedGridId}</strong>
                    {selectedGridItem?.roads && selectedGridItem.roads.length > 0 && (
                      <small>Corridor: {selectedGridItem.roads[0]}</small>
                    )}
                  </div>

                  <div className="shap-prob-info">
                    <span>PREDICTED FLOOD PROBABILITY</span>
                    <strong>
                      {explanationData
                        ? `${(explanationData.flood_probability * 100).toFixed(2)}%`
                        : selectedGridItem?.baseline_prediction
                          ? `${(selectedGridItem.baseline_prediction * 100).toFixed(2)}%`
                          : "—"}
                    </strong>
                    <small>XGBoost Model Output</small>
                  </div>
                </div>

                {explanationError && (
                  <div className="explanation-error-box">
                    <span className="error-icon">[Notice]</span>
                    <span>{explanationError}</span>
                  </div>
                )}

                {!explanationData && !explanationError && (
                  <div className="explanation-loading-box">
                    <div className="loading-spinner"></div>
                    <span>Computing live TreeSHAP values for {selectedGridId}...</span>
                  </div>
                )}

                {explanationData && (
                  <div className="shap-factors-list">
                    <div className="shap-factors-heading">
                      <span>RANK</span>
                      <span>FEATURE & ATTRIBUTE VALUE</span>
                      <span>SHAP CONTRIBUTION (MARGIN SPACE)</span>
                      <span>EFFECT ON RISK</span>
                    </div>

                    {explanationData.features.map((item, index) => {
                      const meta = featureMeta[item.feature] || {
                        label: item.feature,
                        unit: "",
                        description: "",
                      };

                      const maxShap = Math.max(
                        ...explanationData.features.map((f) => Math.abs(f.shap_value))
                      );
                      const barWidth = maxShap > 0 ? (Math.abs(item.shap_value) / maxShap) * 100 : 0;
                      const isIncreasing = item.direction === "increases";
                      const isDecreasing = item.direction === "decreases";

                      return (
                        <div key={item.feature} className="shap-factor-row">
                          <div className="shap-rank">#{index + 1}</div>

                          <div className="shap-feature-info">
                            <strong>{meta.label}</strong>
                            <span className="feature-measured-val">
                              Measured Value: <strong>{item.value.toFixed(item.value < 1 ? 4 : 1)} {meta.unit}</strong>
                            </span>
                            <small>{meta.description}</small>
                          </div>

                          <div className="shap-bar-track-col">
                            <div className="shap-bar-container">
                              <div
                                className={`shap-bar-fill ${isIncreasing ? "increases" : isDecreasing ? "decreases" : "neutral"}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="shap-numeric-val">
                              {item.shap_value > 0 ? "+" : ""}{item.shap_value.toFixed(4)}
                            </span>
                          </div>

                          <div className="shap-direction-col">
                            <span className={`direction-tag ${item.direction}`}>
                              {isIncreasing ? "▲ Increases Risk" : isDecreasing ? "▼ Decreases Risk" : "● Neutral"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div className="shap-interpret-footer">
                      <div className="interpret-note">
                        <strong>Interpretation Note:</strong> SHAP values indicate how each feature pushed the model output away from the base value for this specific cell. They reflect model attribution, not independent physical causal effects.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 8: PLANNING DOSSIERS */}
        {/* ========================================================================= */}
        {activeNav === "dossiers" && (
          <div className="view-container">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <span className="section-label">EXECUTIVE DELIVERABLE</span>
                  <h3>Municipal Planning Dossier Generator</h3>
                  <p className="panel-desc">
                    Official planning brief for K/East Ward (Andheri East), formatted according to MCGM / BMC standards for municipal council review and zoning clearance.
                  </p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setIsDossierOpen(true)}
                >
                  Open Full Dossier Modal ↗
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
                <div className="infra-card" style={{ padding: "24px" }}>
                  <span className="infra-label">CURRENT SELECTED CELL</span>
                  <strong style={{ fontSize: "28px" }}>{selectedGridId}</strong>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "12px 0 16px 0" }}>
                    Prepared for: {currentUser.name} ({currentUser.designation})<br />
                    Department: {currentUser.department_name}<br />
                    Clearance: {currentUser.clearance_level}
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setActiveNav("digital-twin")}
                  >
                    Select Different Cell on Map ◈
                  </button>
                </div>

                <div className="infra-card" style={{ padding: "24px" }}>
                  <span className="infra-label">DOSSIER CONTENTS</span>
                  <ul style={{ color: "var(--text-secondary)", fontSize: "13px", paddingLeft: "18px", lineHeight: "1.8", margin: "12px 0 16px 0" }}>
                    <li>Official Ward Spatial Metadata (16.5 km², EPSG:4326 / EPSG:32643)</li>
                    <li>Baseline XGBoost Risk Probability & Vulnerability Classification</li>
                    <li>3-Way Policy Sensitivity Comparison (NDVI, Roads, Buildings)</li>
                    <li>TreeSHAP Local Feature Contributions & Interpretability Margin</li>
                    <li>Executive Municipal Planning Directive & Sign-off Certification</li>
                  </ul>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsDossierOpen(true)}
                  >
                    Generate & Print Official Dossier ▤
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 9: DATA & PROVENANCE */}
        {/* ========================================================================= */}
        {activeNav === "data-provenance" && (
          <div className="view-container">
            <div className="panel infrastructure-panel">
              <div className="panel-header">
                <div>
                  <span className="section-label">BUILT ENVIRONMENT & GIS CATALOG</span>
                  <h3>K/East Municipal Spatial Catalog</h3>
                  <p className="panel-desc">
                    Verified spatial datasets integrated into the CIVORA Digital Twin GeoPackage (EPSG:4326 / EPSG:32643).
                  </p>
                </div>
                <div className="infra-location-tag">
                  Andheri East · K/East Ward
                </div>
              </div>

              <div className="infra-grid">
                <div className="infra-card">
                  <span className="infra-label">BUILDING FOOTPRINTS</span>
                  <strong>11,584</strong>
                  <small>Clipped to K/East boundary (Microsoft ML)</small>
                </div>

                <div className="infra-card">
                  <span className="infra-label">TOTAL BUILT-UP AREA</span>
                  <strong>5.50M m²</strong>
                  <small>Planar footprint area measured in UTM 43N</small>
                </div>

                <div className="infra-card">
                  <span className="infra-label">VERIFIED ROAD NETWORK</span>
                  <strong>117.94 km</strong>
                  <small>600 road segments (OpenStreetMap)</small>
                </div>

                <div className="infra-card">
                  <span className="infra-label">BMC WATERLOGGING SPOTS</span>
                  <strong>57 Locations</strong>
                  <small>Official MCGM historical flood records</small>
                </div>

                <div className="infra-card">
                  <span className="infra-label">TERRAIN ELEVATION RANGE</span>
                  <strong>5.5 m – 48.2 m</strong>
                  <small>Open-Meteo elevation points (IDW 250m)</small>
                </div>

                <div className="infra-card">
                  <span className="infra-label">VEGETATION (NDVI)</span>
                  <strong>Sentinel-2 L2A</strong>
                  <small>Copernicus Data Space (2025-12-27)</small>
                </div>
              </div>

              <div className="infra-documentation-box" style={{ marginTop: "24px" }}>
                <h4>Data Provenance & Scientific Integrity</h4>
                <p>
                  All measurements are clipped strictly to the official K/East administrative boundary. No simulated data is used for roads, building counts, or municipal flood records. Scenario comparisons show modeled sensitivities of the trained XGBoost model and serve as an academic decision-support framework.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* OFFICIAL MUNICIPAL DOSSIER MODAL */}
      <DossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        gridId={selectedGridId}
        gridContext={selectedGridItem}
        explanation={explanationData}
      />

      {/* MUNICIPAL DEPARTMENT AUTHENTICATION & ROLE MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onSelectDepartment={handleSelectDepartment}
      />

      {/* SYSTEM ARCHITECTURE & ENGINEERING BLUEPRINT MODAL (SYNOPSIS CHAPTER 4 & 5) */}
      <ArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />
    </div>
  );
}
