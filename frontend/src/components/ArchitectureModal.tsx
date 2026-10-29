import { useState, useEffect, useMemo } from "react";
import type { ErEntity, ErRelationship, SoftwareModuleInfo, ArchitectureSchemaResponse } from "../types/civora";

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Fallback data matching Synopsis Chapter 4 & 5 if backend is offline
const DEFAULT_ENTITIES: ErEntity[] = [
  {
    id: "department",
    name: "Department",
    table_name: "civora_department",
    category: "Governance",
    primary_key: "department_id",
    foreign_keys: [],
    row_count: 5,
    description: "Represents municipal departments governing civic operations, planning approvals, and emergency interventions in K/East Ward.",
    attributes: [
      { column: "department_id", type: "VARCHAR(32)", is_pk: true, description: "Unique municipal department identifier" },
      { column: "name", type: "VARCHAR(128)", is_pk: false, description: "Official municipal department title" },
      { column: "code", type: "VARCHAR(16)", is_pk: false, description: "Short MCGM administrative code" },
      { column: "clearance_level", type: "VARCHAR(32)", is_pk: false, description: "Administrative authority tier (Level 1-4)" },
      { column: "active_personnel", type: "INTEGER", is_pk: false, description: "Authorized municipal officers in active directory" }
    ]
  },
  {
    id: "user",
    name: "User",
    table_name: "civora_user",
    category: "Governance",
    primary_key: "user_id",
    foreign_keys: ["department_id -> civora_department.department_id"],
    row_count: 5,
    description: "Authorized planners, municipal commissioners, disaster coordinators, and engineers accessing the digital twin.",
    attributes: [
      { column: "user_id", type: "VARCHAR(32)", is_pk: true, description: "Unique officer ID" },
      { column: "department_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Department" },
      { column: "full_name", type: "VARCHAR(128)", is_pk: false, description: "Officer full legal name" },
      { column: "email", type: "VARCHAR(128)", is_pk: false, description: "Official MCGM gov portal email" },
      { column: "designation", type: "VARCHAR(64)", is_pk: false, description: "Official municipal post title" },
      { column: "session_token", type: "VARCHAR(256)", is_pk: false, description: "Cryptographic role-based token" }
    ]
  },
  {
    id: "geographic_zone",
    name: "Geographic Zone",
    table_name: "civora_geographic_zone",
    category: "Spatial",
    primary_key: "zone_id",
    foreign_keys: [],
    row_count: 405,
    description: "Spatial grid cells (250m x 250m) covering the complete 16.5 sq km administrative expanse of K/East Ward (Andheri East).",
    attributes: [
      { column: "zone_id", type: "VARCHAR(32)", is_pk: true, description: "Cell identifier (e.g. KE_G_0024)" },
      { column: "ward_code", type: "VARCHAR(16)", is_pk: false, description: "MCGM ward boundary code (K/East)" },
      { column: "centroid_lat", type: "DOUBLE PRECISION", is_pk: false, description: "Latitude centroid in EPSG:4326" },
      { column: "centroid_lon", type: "DOUBLE PRECISION", is_pk: false, description: "Longitude centroid in EPSG:4326" },
      { column: "geometry", type: "GEOMETRY(POLYGON, 4326)", is_pk: false, description: "PostGIS spatial polygon bounding box" },
      { column: "elevation_m", type: "REAL", is_pk: false, description: "Mean terrain elevation from DEM (5.5m - 48.2m)" }
    ]
  },
  {
    id: "traffic_data",
    name: "Traffic Data",
    table_name: "civora_traffic_data",
    category: "Mobility",
    primary_key: "record_id",
    foreign_keys: ["zone_id -> civora_geographic_zone.zone_id"],
    row_count: 600,
    description: "Traffic flow telemetry, road density coefficients, network connectivity indices, and peak volume estimations.",
    attributes: [
      { column: "record_id", type: "BIGINT", is_pk: true, description: "Sequential telemetry log sequence ID" },
      { column: "zone_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Geographic Zone" },
      { column: "road_length_m", type: "REAL", is_pk: false, description: "Total road centerline length in cell (meters)" },
      { column: "road_density_km_km2", type: "REAL", is_pk: false, description: "Normalized road density metric" },
      { column: "congestion_index", type: "REAL", is_pk: false, description: "Modeled corridor congestion factor (0.0 - 1.0)" }
    ]
  },
  {
    id: "weather_data",
    name: "Weather Data",
    table_name: "civora_weather_data",
    category: "Environmental",
    primary_key: "weather_id",
    foreign_keys: ["zone_id -> civora_geographic_zone.zone_id"],
    row_count: 3652,
    description: "Historical meteorological time-series (2015-2025) including precipitation, monsoon peaks, humidity, and surface pressure.",
    attributes: [
      { column: "weather_id", type: "BIGINT", is_pk: true, description: "Observation record primary key" },
      { column: "zone_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Geographic Zone" },
      { column: "observation_date", type: "DATE", is_pk: false, description: "Meteorological observation timestamp" },
      { column: "precipitation_sum_mm", type: "REAL", is_pk: false, description: "Daily rainfall accumulation (mm)" },
      { column: "monsoon_extreme_flag", type: "BOOLEAN", is_pk: false, description: "True when precipitation > 100mm/day" }
    ]
  },
  {
    id: "flood_data",
    name: "Flood Data",
    table_name: "civora_flood_data",
    category: "Disaster",
    primary_key: "flood_spot_id",
    foreign_keys: ["zone_id -> civora_geographic_zone.zone_id"],
    row_count: 57,
    description: "57 official BMC verified waterlogging hotspots in K/East Ward documenting historical submersions and drainage choke points.",
    attributes: [
      { column: "flood_spot_id", type: "VARCHAR(32)", is_pk: true, description: "Official BMC waterlogging spot identifier" },
      { column: "zone_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Geographic Zone" },
      { column: "location_name", type: "VARCHAR(128)", is_pk: false, description: "Prominent landmark / intersection name" },
      { column: "historical_severity", type: "VARCHAR(32)", is_pk: false, description: "Waterlogging depth tier (Severe/Moderate/Minor)" },
      { column: "reported_incidents", type: "INTEGER", is_pk: false, description: "Historical incident logs during monsoon" }
    ]
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    table_name: "civora_infrastructure",
    category: "Built Environment",
    primary_key: "building_id",
    foreign_keys: ["zone_id -> civora_geographic_zone.zone_id"],
    row_count: 11584,
    description: "11,584 verified structural building footprints, road centerlines, stormwater nullahs, metro stations, and civic amenities.",
    attributes: [
      { column: "building_id", type: "BIGINT", is_pk: true, description: "Unique building footprint ID" },
      { column: "zone_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Geographic Zone" },
      { column: "footprint_area_sqm", type: "REAL", is_pk: false, description: "Planar polygon footprint area in sq meters" },
      { column: "impervious_ratio", type: "REAL", is_pk: false, description: "Impermeable surface coverage fraction (0-1)" },
      { column: "geometry", type: "GEOMETRY(POLYGON, 32643)", is_pk: false, description: "UTM Zone 43N projected structural polygon" }
    ]
  },
  {
    id: "digital_twin",
    name: "Digital Twin",
    table_name: "civora_digital_twin_layer",
    category: "Spatial",
    primary_key: "twin_layer_id",
    foreign_keys: ["zone_id -> civora_geographic_zone.zone_id"],
    row_count: 405,
    description: "Virtual multi-dimensional representation of K/East Ward fusing elevation, NDVI, road density, building density, and flood history.",
    attributes: [
      { column: "twin_layer_id", type: "VARCHAR(32)", is_pk: true, description: "Layer composite primary key" },
      { column: "zone_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Geographic Zone" },
      { column: "ndvi_mean", type: "REAL", is_pk: false, description: "Sentinel-2 mean vegetation index (-1.0 to +1.0)" },
      { column: "building_density", type: "REAL", is_pk: false, description: "Built-up surface area divided by grid area" },
      { column: "elevation_idw", type: "REAL", is_pk: false, description: "Interpolated terrain surface elevation (meters)" }
    ]
  },
  {
    id: "ai_model",
    name: "AI Model",
    table_name: "civora_ai_model",
    category: "Machine Learning",
    primary_key: "model_id",
    foreign_keys: [],
    row_count: 2,
    description: "XGBoost tree classification and regression models trained on spatial features with 92.65% flood hotspot capture accuracy.",
    attributes: [
      { column: "model_id", type: "VARCHAR(32)", is_pk: true, description: "Model registry artifact ID" },
      { column: "algorithm", type: "VARCHAR(64)", is_pk: false, description: "Machine learning algorithm (XGBoost)" },
      { column: "version", type: "VARCHAR(16)", is_pk: false, description: "Model deployment version (e.g. v1.2.0)" },
      { column: "capture_rate", type: "REAL", is_pk: false, description: "Validation flood spot capture rate (92.65%)" },
      { column: "feature_count", type: "INTEGER", is_pk: false, description: "Number of spatial predictors (elevation, NDVI, etc.)" }
    ]
  },
  {
    id: "prediction",
    name: "Prediction",
    table_name: "civora_prediction",
    category: "Machine Learning",
    primary_key: "prediction_id",
    foreign_keys: ["model_id -> civora_ai_model.model_id", "zone_id -> civora_geographic_zone.zone_id"],
    row_count: 405,
    description: "Baseline and scenario-adjusted flood probability inferences computed for each 250m cell.",
    attributes: [
      { column: "prediction_id", type: "VARCHAR(32)", is_pk: true, description: "Unique inference output ID" },
      { column: "model_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to AI Model" },
      { column: "zone_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Geographic Zone" },
      { column: "probability", type: "REAL", is_pk: false, description: "Model flood probability score (0.000 to 1.000)" },
      { column: "risk_tier", type: "VARCHAR(16)", is_pk: false, description: "Categorical rating: Critical, High, Moderate, Low" }
    ]
  },
  {
    id: "explanation",
    name: "Explanation",
    table_name: "civora_explanation",
    category: "Explainable AI",
    primary_key: "explanation_id",
    foreign_keys: ["prediction_id -> civora_prediction.prediction_id"],
    row_count: 405,
    description: "TreeSHAP local feature attribution vectors revealing which geographical attributes drive flood vulnerability up or down.",
    attributes: [
      { column: "explanation_id", type: "VARCHAR(32)", is_pk: true, description: "Explanation record primary key" },
      { column: "prediction_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Prediction" },
      { column: "base_value", type: "REAL", is_pk: false, description: "Global expected model margin (base value)" },
      { column: "shap_elevation", type: "REAL", is_pk: false, description: "SHAP contribution of terrain elevation" },
      { column: "shap_ndvi", type: "REAL", is_pk: false, description: "SHAP contribution of vegetation density" },
      { column: "shap_building_density", type: "REAL", is_pk: false, description: "SHAP contribution of built-up footprint" }
    ]
  },
  {
    id: "simulation",
    name: "Simulation",
    table_name: "civora_simulation",
    category: "Simulation",
    primary_key: "simulation_id",
    foreign_keys: ["user_id -> civora_user.user_id"],
    row_count: 38,
    description: "What-If planning scenarios (e.g. NDVI +20%, Road Density -20%, permeable corridors, sponge reservoirs) simulated by planners.",
    attributes: [
      { column: "simulation_id", type: "VARCHAR(32)", is_pk: true, description: "Simulation session UUID" },
      { column: "user_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to User who initiated run" },
      { column: "scenario_type", type: "VARCHAR(64)", is_pk: false, description: "Intervention title or corridor alignment" },
      { column: "delta_parameters", type: "JSONB", is_pk: false, description: "Feature modifications applied across ward cells" },
      { column: "cells_improved", type: "INTEGER", is_pk: false, description: "Count of cells with measurable risk decrease" }
    ]
  },
  {
    id: "recommendation",
    name: "Recommendation",
    table_name: "civora_recommendation",
    category: "Decision Support",
    primary_key: "recommendation_id",
    foreign_keys: ["simulation_id -> civora_simulation.simulation_id"],
    row_count: 76,
    description: "Actionable municipal engineering guidelines generated for ward officers based on simulation deltas and SHAP diagnostics.",
    attributes: [
      { column: "recommendation_id", type: "VARCHAR(32)", is_pk: true, description: "Recommendation identifier" },
      { column: "simulation_id", type: "VARCHAR(32)", is_pk: false, description: "Foreign key to Simulation" },
      { column: "target_zone_id", type: "VARCHAR(32)", is_pk: false, description: "Target spatial cell identifier" },
      { column: "action_title", type: "VARCHAR(128)", is_pk: false, description: "Specific civil engineering intervention" },
      { column: "priority_level", type: "VARCHAR(16)", is_pk: false, description: "Priority: Critical, High, Medium, Low" }
    ]
  },
  {
    id: "report",
    name: "Report",
    table_name: "civora_report",
    category: "Reporting",
    primary_key: "report_id",
    foreign_keys: [
      "prediction_id -> civora_prediction.prediction_id",
      "recommendation_id -> civora_recommendation.recommendation_id"
    ],
    row_count: 24,
    description: "Official municipal planning dossiers combining spatial maps, XGBoost predictions, SHAP attributions, and civil recommendations.",
    attributes: [
      { column: "report_id", type: "VARCHAR(32)", is_pk: true, description: "Dossier report identifier" },
      { column: "generated_by_user_id", type: "VARCHAR(32)", is_pk: false, description: "Authorizing municipal planner" },
      { column: "zone_id", type: "VARCHAR(32)", is_pk: false, description: "Focus grid cell or ward summary" },
      { column: "dossier_json", type: "JSONB", is_pk: false, description: "Full serialized diagnostic report data" },
      { column: "created_at", type: "TIMESTAMP", is_pk: false, description: "Formal issuance timestamp" }
    ]
  }
];

const DEFAULT_RELATIONSHIPS: ErRelationship[] = [
  { source: "Department", target: "User", cardinality: "1:M", synopsis_ref: "Department -> User (1:M)", description: "A single department may have several authorized users, whereas each user is associated with one particular department." },
  { source: "Geographic Zone", target: "Traffic Data", cardinality: "1:M", synopsis_ref: "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)", description: "Each geographic area stores time-series and network traffic information." },
  { source: "Geographic Zone", target: "Weather Data", cardinality: "1:M", synopsis_ref: "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)", description: "Each geographic cell stores historical meteorological observations and forecasts." },
  { source: "Geographic Zone", target: "Flood Data", cardinality: "1:M", synopsis_ref: "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)", description: "Each geographic cell links to verified BMC waterlogging points." },
  { source: "Geographic Zone", target: "Infrastructure", cardinality: "1:M", synopsis_ref: "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)", description: "Each geographic cell contains building footprints, roads, and civil assets." },
  { source: "Geographic Zone", target: "Digital Twin", cardinality: "1:1", synopsis_ref: "Geographic Zone -> Digital Twin (1:1)", description: "One Digital Twin layer is used for each geographic cell, modeling physical and environmental features." },
  { source: "AI Model", target: "Prediction", cardinality: "1:M", synopsis_ref: "AI Model -> Prediction (1:M)", description: "A single trained AI model produces predictions across all cells and planning scenarios." },
  { source: "Prediction", target: "Explanation", cardinality: "1:1", synopsis_ref: "Prediction -> Explanation (1:1)", description: "Each prediction has an attached explanation produced using Explainable AI (TreeSHAP)." },
  { source: "User", target: "Simulation", cardinality: "1:M", synopsis_ref: "User -> Simulation (1:M)", description: "Municipal users create simulation scenarios to test urban planning interventions." },
  { source: "Simulation", target: "Recommendation", cardinality: "1:M", synopsis_ref: "Simulation -> Recommendation (1:M)", description: "Each planning simulation generates prioritized civil engineering recommendations." },
  { source: "Prediction", target: "Report", cardinality: "1:M", synopsis_ref: "Report <- Prediction & Recommendation", description: "Reports synthesize prediction risk models into official dossiers." },
  { source: "Recommendation", target: "Report", cardinality: "1:M", synopsis_ref: "Report <- Prediction & Recommendation", description: "Reports incorporate AI-generated municipal interventions for decision-makers." }
];

const DEFAULT_MODULES: SoftwareModuleInfo[] = [
  { id: "auth", name: "1. Authentication Module", purpose: "Secures access to the platform by checking department role clearance and preserving session tokens across municipal roles.", technology: "FastAPI, PostgreSQL, Pydantic", status: "Operational (Live)", active_endpoints: ["/api/auth/departments", "/api/auth/login", "/api/auth/me"] },
  { id: "data_collection", name: "2. Data Collection Module", purpose: "Gathers and arranges urban datasets from OpenStreetMap, Copernicus Sentinel-2, Open-Meteo DEM, and official MCGM flood records.", technology: "Python, Requests, GeoPandas, PyProj", status: "Operational (Live)", active_endpoints: ["/data/K_East_Grid_Context.json", "CIVORA_DigitalTwin.gpkg"] },
  { id: "gis_management", name: "3. GIS Management Module", purpose: "Stores, indexes, and visualizes multi-layer geospatial entities with EPSG:4326 / EPSG:32643 reprojection and Leaflet map rendering.", technology: "PostGIS, GeoJSON, Leaflet, Turf.js", status: "Operational (Live)", active_endpoints: ["/data/K_East_Grid_WGS84.geojson", "Leaflet Polygon Layers"] },
  { id: "digital_twin", name: "4. Digital Twin Module", purpose: "Forms a virtual spatial model of K/East Ward fusing 405 cells, 11,584 buildings, 600 roads, and 57 historical flood spots.", technology: "Python, NumPy, Shapely, GeoPackage", status: "Operational (Live)", active_endpoints: ["/api/scenarios", "/api/scenarios/hotspots"] },
  { id: "ai_prediction", name: "5. AI Prediction Module", purpose: "Executes trained XGBoost classification engine capturing 92.65% of flood-prone spots based on verified topographic features.", technology: "XGBoost, Scikit-learn, Joblib", status: "Operational (Live)", active_endpoints: ["CIVORA_Flood_XGBoost_Model.json", "/api/scenarios/predict"] },
  { id: "simulation", name: "6. Simulation Module", purpose: "Evaluates What-If sensitivities (NDVI greening, road density, building density) and spatial buffer corridor feasibility conflicts.", technology: "Python, Shapely Spatial Buffers, Pandas", status: "Operational (Live)", active_endpoints: ["/api/infrastructure/analyze-alignment", "/api/copilot/query"] },
  { id: "dashboard", name: "7. Dashboard Module", purpose: "Presents an interactive acrylic glassmorphic UI with floating navigation, telemetry, 2D/3D map toggles, and cell inspector.", technology: "React, TypeScript, CSS Glassmorphism, Leaflet", status: "Operational (Live)", active_endpoints: ["http://localhost:5173/"] },
  { id: "reporting", name: "8. Reporting Module", purpose: "Produces official municipal planning dossiers synthesizing TreeSHAP explanations, risk distributions, and engineering actions.", technology: "FastAPI, Markdown/JSON Serializer, Web Print Engine", status: "Operational (Live)", active_endpoints: ["/api/explanation/{grid_id}", "Dossier Export Engine"] }
];

export function ArchitectureModal({ isOpen, onClose }: ArchitectureModalProps) {
  const [activeTab, setActiveTab] = useState<"er" | "storage" | "context" | "dfd1" | "dfd2" | "modules">("er");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("geographic_zone");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSimScenario, setActiveSimScenario] = useState<string>("Build New Hospital");

  // Schema state
  const [schemaData, setSchemaData] = useState<ArchitectureSchemaResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("http://127.0.0.1:8000/api/architecture/schema")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ArchitectureSchemaResponse | null) => {
        if (data) setSchemaData(data);
      })
      .catch((err) => console.warn("Could not load backend architecture schema:", err));
  }, [isOpen]);

  const entities = schemaData?.entities ?? DEFAULT_ENTITIES;
  const relationships = schemaData?.relationships ?? DEFAULT_RELATIONSHIPS;
  const modules = schemaData?.modules ?? DEFAULT_MODULES;

  const selectedEntity = useMemo(() => {
    return entities.find((e) => e.id === selectedEntityId) || entities[0];
  }, [entities, selectedEntityId]);

  // Filtered entities
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      const matchesCat = entityFilter === "all" || e.category.toLowerCase() === entityFilter.toLowerCase();
      const matchesSearch =
        searchQuery.trim() === "" ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.attributes.some((a) => a.column.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [entities, entityFilter, searchQuery]);

  // Related relationships for selected entity
  const activeRelationships = useMemo(() => {
    if (!selectedEntity) return [];
    return relationships.filter(
      (r) => r.source === selectedEntity.name || r.target === selectedEntity.name
    );
  }, [selectedEntity, relationships]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container architecture-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="modal-header arch-modal-header">
          <div className="arch-header-meta">
            <div className="arch-badge-row">
              <span className="arch-badge-synopsis">SYNOPSIS CHAPTER 4 & 5</span>
              <span className="arch-badge-ward">K/EAST WARD DIGITAL TWIN</span>
              <span className="arch-badge-live">LIVE SCHEMA SYNC</span>
            </div>
            <h2>CIVORA AI Architecture & Engineering Blueprint</h2>
            <p className="arch-subtitle">
              Specialization Project BCA482-5 · Entity Relationship Model, Multi-Level Data Flow Diagrams & Software Modules Design
            </p>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Close Engineering Blueprint"
          >
            ✕
          </button>
        </div>

        {/* TOP METRICS TELEMETRY BAR */}
        <div className="arch-telemetry-bar">
          <div className="arch-stat-box">
            <span className="arch-stat-label">ER ENTITIES</span>
            <strong className="arch-stat-val">{entities.length} Tables</strong>
            <small>PostgreSQL / PostGIS</small>
          </div>
          <div className="arch-stat-divider" />
          <div className="arch-stat-box">
            <span className="arch-stat-label">CARDINALITY LINKS</span>
            <strong className="arch-stat-val">{relationships.length} Relations</strong>
            <small>1:M, 1:1 Constraints</small>
          </div>
          <div className="arch-stat-divider" />
          <div className="arch-stat-box">
            <span className="arch-stat-label">DFD LEVELS</span>
            <strong className="arch-stat-val">4 Architectural Tiers</strong>
            <small>Storage, Context 0, DFD 1, DFD 2</small>
          </div>
          <div className="arch-stat-divider" />
          <div className="arch-stat-box">
            <span className="arch-stat-label">SOFTWARE MODULES</span>
            <strong className="arch-stat-val">{modules.length} Functional Engines</strong>
            <small>FastAPI + React + Leaflet</small>
          </div>
          <div className="arch-stat-divider" />
          <div className="arch-stat-box">
            <span className="arch-stat-label">GRID CELLS</span>
            <strong className="arch-stat-val">405 Monitored (250m)</strong>
            <small>11,584 Buildings · 57 Flood Spots</small>
          </div>
        </div>

        {/* TAB NAVIGATION PILLS */}
        <div className="arch-nav-tabs">
          <button
            type="button"
            className={`arch-tab-btn ${activeTab === "er" ? "active" : ""}`}
            onClick={() => setActiveTab("er")}
          >
            <span className="arch-tab-glyph">◈</span>
            <span className="arch-tab-title">4.1 ER Diagram</span>
            <span className="arch-tab-tag">14 Entities</span>
          </button>

          <button
            type="button"
            className={`arch-tab-btn ${activeTab === "storage" ? "active" : ""}`}
            onClick={() => setActiveTab("storage")}
          >
            <span className="arch-tab-glyph">◈</span>
            <span className="arch-tab-title">4.2.1 Data Storage DFD</span>
            <span className="arch-tab-tag">Figure 4.2</span>
          </button>

          <button
            type="button"
            className={`arch-tab-btn ${activeTab === "context" ? "active" : ""}`}
            onClick={() => setActiveTab("context")}
          >
            <span className="arch-tab-glyph">◈</span>
            <span className="arch-tab-title">4.2.2 Context DFD (Level 0)</span>
            <span className="arch-tab-tag">Figure 4.3</span>
          </button>

          <button
            type="button"
            className={`arch-tab-btn ${activeTab === "dfd1" ? "active" : ""}`}
            onClick={() => setActiveTab("dfd1")}
          >
            <span className="arch-tab-glyph">◈</span>
            <span className="arch-tab-title">4.2.3 DFD Level 1</span>
            <span className="arch-tab-tag">Figure 4.4</span>
          </button>

          <button
            type="button"
            className={`arch-tab-btn ${activeTab === "dfd2" ? "active" : ""}`}
            onClick={() => setActiveTab("dfd2")}
          >
            <span className="arch-tab-glyph">◈</span>
            <span className="arch-tab-title">4.2.4 DFD Level 2</span>
            <span className="arch-tab-tag">Figure 4.5</span>
          </button>

          <button
            type="button"
            className={`arch-tab-btn ${activeTab === "modules" ? "active" : ""}`}
            onClick={() => setActiveTab("modules")}
          >
            <span className="arch-tab-glyph">◈</span>
            <span className="arch-tab-title">Chapter 5: Modules</span>
            <span className="arch-tab-tag">8 Engines</span>
          </button>
        </div>

        {/* TAB CONTENT AREA */}
        <div className="arch-modal-body">
          {/* TAB 1: 4.1 ENTITY RELATIONSHIP (ER) DIAGRAM */}
          {activeTab === "er" && (
            <div className="arch-er-layout">
              {/* LEFT: ENTITY GRID & FILTERS */}
              <div className="arch-er-left-col">
                <div className="arch-filter-toolbar">
                  <div className="arch-search-wrap">
                    <svg className="search-svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      className="arch-search-input"
                      placeholder="Search entity, table or column..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setSearchQuery("")}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="arch-category-chips">
                    {["all", "Governance", "Spatial", "Mobility", "Environmental", "Disaster", "Built Environment", "Machine Learning", "Explainable AI", "Simulation", "Decision Support", "Reporting"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`arch-cat-chip ${entityFilter.toLowerCase() === cat.toLowerCase() ? "active" : ""}`}
                        onClick={() => setEntityFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="arch-entity-grid">
                  {filteredEntities.map((ent) => {
                    const isSelected = ent.id === selectedEntity.id;
                    return (
                      <div
                        key={ent.id}
                        className={`arch-entity-card ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedEntityId(ent.id)}
                      >
                        <div className="ent-card-header">
                          <span className={`ent-cat-pill ${ent.category.toLowerCase().replace(/\s+/g, "-")}`}>
                            {ent.category}
                          </span>
                          <span className="ent-rows-pill">{ent.row_count.toLocaleString()} rows</span>
                        </div>
                        <h4 className="ent-card-name">{ent.name}</h4>
                        <code className="ent-table-name">{ent.table_name}</code>
                        <div className="ent-card-pk">
                          <span className="pk-badge">PK</span>
                          <span>{ent.primary_key}</span>
                        </div>
                        <p className="ent-card-desc">{ent.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: DETAILED SCHEMA INSPECTOR */}
              <div className="arch-er-right-col">
                <div className="schema-inspector-panel">
                  <div className="inspector-header">
                    <span className="inspector-tag">ACTIVE SCHEMA INSPECTOR</span>
                    <h3>{selectedEntity.name}</h3>
                    <code className="inspector-table-code">{selectedEntity.table_name}</code>
                    <p className="inspector-desc">{selectedEntity.description}</p>
                  </div>

                  {/* KEY METRICS */}
                  <div className="inspector-meta-grid">
                    <div className="ins-meta-card">
                      <span className="ins-meta-label">PRIMARY KEY</span>
                      <strong className="ins-meta-val">{selectedEntity.primary_key}</strong>
                    </div>
                    <div className="ins-meta-card">
                      <span className="ins-meta-label">ROW INVENTORY</span>
                      <strong className="ins-meta-val">{selectedEntity.row_count.toLocaleString()} rows</strong>
                    </div>
                    <div className="ins-meta-card">
                      <span className="ins-meta-label">FOREIGN KEYS</span>
                      <strong className="ins-meta-val">
                        {selectedEntity.foreign_keys.length > 0 ? selectedEntity.foreign_keys.length : "None (Root Entity)"}
                      </strong>
                    </div>
                  </div>

                  {/* FOREIGN KEY DETAILS */}
                  {selectedEntity.foreign_keys.length > 0 && (
                    <div className="fk-references-box">
                      <span className="box-title">FOREIGN KEY CONSTRAINTS</span>
                      <ul>
                        {selectedEntity.foreign_keys.map((fk, idx) => (
                          <li key={idx}>
                            <code>{fk}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ATTRIBUTES TABLE */}
                  <div className="attributes-table-wrapper">
                    <span className="box-title">COLUMN ATTRIBUTES & DATA TYPES</span>
                    <table className="attributes-table">
                      <thead>
                        <tr>
                          <th>COLUMN NAME</th>
                          <th>TYPE</th>
                          <th>KEY</th>
                          <th>DESCRIPTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEntity.attributes.map((attr) => (
                          <tr key={attr.column} className={attr.is_pk ? "pk-row" : ""}>
                            <td>
                              <code className="attr-col-name">{attr.column}</code>
                            </td>
                            <td>
                              <span className="attr-type-badge">{attr.type}</span>
                            </td>
                            <td>
                              {attr.is_pk ? <span className="pk-indicator">PK</span> : <span className="null-indicator">-</span>}
                            </td>
                            <td className="attr-desc">{attr.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* CONNECTED CARDINALITY RELATIONSHIPS */}
                  <div className="connected-relations-wrapper">
                    <span className="box-title">CONNECTED CARDINALITY RELATIONSHIPS</span>
                    <div className="relations-list">
                      {activeRelationships.map((rel, idx) => (
                        <div key={idx} className="relation-item">
                          <div className="rel-header">
                            <span className="rel-cardinality-badge">{rel.cardinality}</span>
                            <strong className="rel-title">
                              {rel.source} → {rel.target}
                            </strong>
                            <span className="rel-synopsis-tag">{rel.synopsis_ref}</span>
                          </div>
                          <p className="rel-desc">{rel.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 4.2.1 DATA STORAGE ARCHITECTURE (FIGURE 4.2) */}
          {activeTab === "storage" && (
            <div className="arch-flow-diagram-wrapper">
              <div className="flow-intro-card">
                <span className="section-label">DATA STORAGE ARCHITECTURE · FIGURE 4.2</span>
                <h3>Municipal Data Stores & Central Spatial PostGIS Warehouse</h3>
                <p>
                  Specifies the ingestion pipeline where external heterogeneous civic datasets are collected, cleaned, projected to UTM 43N / WGS84, stored in domain-specific repositories, unified into the central PostGIS Spatial Database, and streamed to the AI prediction and simulation modules.
                </p>
              </div>

              {/* TIERED FLOW CANVAS */}
              <div className="flow-canvas-vertical">
                {/* LEVEL 1: EXTERNAL DATA SOURCES */}
                <div className="flow-tier-box source-tier">
                  <div className="flow-tier-badge">TIER 1: EXTERNAL FEEDS</div>
                  <div className="flow-node highlight">
                    <h4>External Data Sources</h4>
                    <p>OpenStreetMap · Open-Meteo DEM · Copernicus Sentinel-2 L2A · MCGM Flood Portals · OpenAQ Stations</p>
                  </div>
                </div>

                <div className="flow-arrow-down">
                  <span>↓ Ingestion, Reprojection & Cleaning Pipeline ↓</span>
                </div>

                {/* LEVEL 2: DATA PROCESSING */}
                <div className="flow-tier-box process-tier">
                  <div className="flow-tier-badge">TIER 2: PRE-PROCESSING</div>
                  <div className="flow-node process">
                    <h4>Data Processing & Spatial Harmonization</h4>
                    <p>EPSG:4326 to EPSG:32643 UTM Projection · IDW 250m Terrain Interpolation · NDVI Surface Ratio Extraction</p>
                  </div>
                </div>

                <div className="flow-arrow-down">
                  <span>↓ Partitioned Into Domain Stores ↓</span>
                </div>

                {/* LEVEL 3: DOMAIN SPECIFIC DATABASES */}
                <div className="flow-tier-box stores-tier">
                  <div className="flow-tier-badge">TIER 3: DOMAIN-SPECIFIC DATA STORES</div>
                  <div className="domain-stores-grid">
                    <div className="store-card">
                      <span className="store-icon">◈</span>
                      <h5>Road DB</h5>
                      <strong>600 Segments</strong>
                      <small>117.94 km network</small>
                    </div>

                    <div className="store-card">
                      <span className="store-icon">◈</span>
                      <h5>Weather DB</h5>
                      <strong>3,652 Days</strong>
                      <small>2015-2025 Daily</small>
                    </div>

                    <div className="store-card">
                      <span className="store-icon">◈</span>
                      <h5>Satellite DB</h5>
                      <strong>Sentinel-2 L2A</strong>
                      <small>10m Multispectral</small>
                    </div>

                    <div className="store-card">
                      <span className="store-icon">◈</span>
                      <h5>Citizen DB</h5>
                      <strong>57 Flood Spots</strong>
                      <small>Official MCGM Hotspots</small>
                    </div>

                    <div className="store-card">
                      <span className="store-icon">◈</span>
                      <h5>Pollution DB</h5>
                      <strong>6 Sensor Feeds</strong>
                      <small>Chakala Air Quality</small>
                    </div>
                  </div>
                </div>

                <div className="flow-arrow-down">
                  <span>↓ Unified Ingestion into Central Spatial Warehouse ↓</span>
                </div>

                {/* LEVEL 4: POSTGIS SPATIAL DATABASE */}
                <div className="flow-tier-box warehouse-tier">
                  <div className="flow-tier-badge">TIER 4: CENTRAL SPATIAL REPOSITORY</div>
                  <div className="flow-node postgis">
                    <h4>PostGIS Spatial Database (CIVORA GeoPackage)</h4>
                    <p>
                      405 Spatial Cells (250m x 250m) · 11,584 Microsoft ML Building Footprints · R-Tree Spatial Indexing · EPSG:4326 WGS84
                    </p>
                  </div>
                </div>

                <div className="flow-arrow-down">
                  <span>↓ Spatial Query Streaming & Real-Time Inferences ↓</span>
                </div>

                {/* LEVEL 5: AI PREDICTION & SIMULATION */}
                <div className="flow-tier-box ai-tier">
                  <div className="flow-tier-badge">TIER 5: MACHINE LEARNING & SIMULATION</div>
                  <div className="flow-node ml">
                    <h4>AI Prediction & Simulation Engine</h4>
                    <p>
                      XGBoost Classification (92.65% Capture) · TreeSHAP Local Explanations · Corridor Buffer Intersection Simulator
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 4.2.2 CONTEXT DIAGRAM (LEVEL 0 DFD - FIGURE 4.3) */}
          {activeTab === "context" && (
            <div className="arch-flow-diagram-wrapper">
              <div className="flow-intro-card">
                <span className="section-label">CONTEXT DIAGRAM · LEVEL 0 DFD · FIGURE 4.3</span>
                <h3>System Operational Boundary & External Stakeholder Interactions</h3>
                <p>
                  Illustrates the highest abstraction level of CIVORA AI, defining external entities providing raw urban datasets and municipal stakeholders issuing planning requests and receiving predictive decision dossiers.
                </p>
              </div>

              {/* CONTEXT DIAGRAM HUB-AND-SPOKE CANVAS */}
              <div className="context-canvas">
                {/* TOP: MUNICIPAL AUTHORITIES */}
                <div className="context-node top-authority">
                  <div className="context-card authority">
                    <span className="ctx-type-badge">GOVERNMENT STAKEHOLDER</span>
                    <h4>Municipal Authorities</h4>
                    <p>Municipal Corporation of Greater Mumbai (MCGM)</p>
                    <span className="ctx-flow-label">Planning Requests ↓</span>
                  </div>
                </div>

                {/* MIDDLE ROW: DATA SOURCES <--> PLATFORM <--> DATA SOURCES */}
                <div className="context-middle-row">
                  {/* LEFT SOURCES */}
                  <div className="context-sources-col left">
                    <div className="ctx-source-card">
                      <span className="ctx-src-name">OpenStreetMap</span>
                      <small>Roads & Footprints →</small>
                    </div>
                    <div className="ctx-source-card">
                      <span className="ctx-src-name">Census Data</span>
                      <small>Ward Population Density →</small>
                    </div>
                    <div className="ctx-source-card">
                      <span className="ctx-src-name">Complaint Portals</span>
                      <small>Civic Waterlogging Logs →</small>
                    </div>
                  </div>

                  {/* CENTER: CIVORA AI PLATFORM CORE */}
                  <div className="context-center-hub">
                    <div className="hub-pulse-ring" />
                    <div className="hub-core-box">
                      <span className="hub-badge">DIGITAL TWIN PLATFORM</span>
                      <h3>CIVORA AI Digital Twin & AI Platform</h3>
                      <p>405 Cells · XGBoost Engine · TreeSHAP · Multi-Agent Simulator</p>
                    </div>
                  </div>

                  {/* RIGHT SOURCES */}
                  <div className="context-sources-col right">
                    <div className="ctx-source-card">
                      <span className="ctx-src-name">Weather APIs</span>
                      <small>← Precipitation & Dem</small>
                    </div>
                    <div className="ctx-source-card">
                      <span className="ctx-src-name">Satellite Images</span>
                      <small>← Sentinel-2 L2A NDVI</small>
                    </div>
                    <div className="ctx-source-card">
                      <span className="ctx-src-name">Pollution Data</span>
                      <small>← OpenAQ Air Quality</small>
                    </div>
                  </div>
                </div>

                {/* BOTTOM: URBAN PLANNERS & OUTPUTS */}
                <div className="context-node bottom-planners">
                  <div className="context-card planners">
                    <span className="ctx-flow-label">↑ AI Predictions, Risk Heatmaps & Municipal Reports</span>
                    <h4>Urban Planners / Government Officials</h4>
                    <p>Disaster Response Teams · Traffic Engineers · Ward Planning Officers</p>
                    <span className="ctx-type-badge">DECISION-MAKING RECIPIENTS</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 4.2.3 DFD LEVEL 1 (MAIN FUNCTIONAL PROCESSES - FIGURE 4.4) */}
          {activeTab === "dfd1" && (
            <div className="arch-flow-diagram-wrapper">
              <div className="flow-intro-card">
                <span className="section-label">DFD LEVEL 1 · MAIN FUNCTIONAL PROCESSES · FIGURE 4.4</span>
                <h3>Data Flow Through Ingestion, Machine Learning & Decision Synthesis</h3>
                <p>
                  Expands the CIVORA AI platform into its primary functional sub-processes, depicting how external datasets undergo systematic transformation into municipal planning insights.
                </p>
              </div>

              <div className="dfd1-pipeline-container">
                {/* STAGE 1: EXTERNAL FEEDS */}
                <div className="dfd1-stage-block">
                  <div className="stage-header">
                    <span className="stage-num">STAGE 1</span>
                    <h4>External Data Feeds</h4>
                  </div>
                  <div className="stage-boxes-row">
                    <div className="dfd-pill">Road Data Collection</div>
                    <div className="dfd-pill">Weather Data Collection</div>
                    <div className="dfd-pill">Satellite Image Data</div>
                    <div className="dfd-pill">Citizen Complaints</div>
                    <div className="dfd-pill">Pollution Data Collection</div>
                  </div>
                </div>

                <div className="flow-arrow-down"><span>↓ Transferred for Harmonization ↓</span></div>

                {/* STAGE 2: DATA INTEGRATION & CLEANING */}
                <div className="dfd1-stage-block">
                  <div className="stage-header">
                    <span className="stage-num">STAGE 2</span>
                    <h4>Data Integration & Cleaning (Process 2.0)</h4>
                  </div>
                  <div className="stage-central-box">
                    <p>Coordinate transformation (WGS84 ↔ UTM 43N) · Null filtering · Spatial polygon bounding clips</p>
                  </div>
                </div>

                <div className="flow-arrow-down"><span>↓ Persisted in Spatial Repository ↓</span></div>

                {/* STAGE 3: SPATIAL DATABASE */}
                <div className="dfd1-stage-block">
                  <div className="stage-header">
                    <span className="stage-num">STAGE 3</span>
                    <h4>Spatial Database (PostGIS)</h4>
                  </div>
                  <div className="stage-central-box db">
                    <p>Central PostGIS Spatial Database · 405 Monitored Grids · 11,584 Buildings · 600 Roads · 57 Flood Hotspots</p>
                  </div>
                </div>

                <div className="flow-arrow-down"><span>↓ Queried by Analytical Engines ↓</span></div>

                {/* STAGE 4: PARALLEL COMPUTATION ENGINES */}
                <div className="dfd1-stage-block">
                  <div className="stage-header">
                    <span className="stage-num">STAGE 4</span>
                    <h4>Core Analytics & Prediction Engines</h4>
                  </div>
                  <div className="engines-quad-grid">
                    <div className="engine-card">
                      <span className="eng-icon">◈</span>
                      <h5>Digital Twin Generation</h5>
                      <p>Creates 3D multi-layered spatial representation of K/East Ward</p>
                    </div>

                    <div className="engine-card">
                      <span className="eng-icon">◈</span>
                      <h5>AI Prediction Engine</h5>
                      <p>Computes XGBoost flood vulnerability and risk tier classifications</p>
                    </div>

                    <div className="engine-card">
                      <span className="eng-icon">◈</span>
                      <h5>Simulation Engine</h5>
                      <p>Executes What-If intervention scenarios and corridor conflict buffers</p>
                    </div>

                    <div className="engine-card">
                      <span className="eng-icon">◈</span>
                      <h5>Analytics Engine</h5>
                      <p>Generates TreeSHAP local feature explanations and sensitivity curves</p>
                    </div>
                  </div>
                </div>

                <div className="flow-arrow-down"><span>↓ Inferences Combined for Actionable Governance ↓</span></div>

                {/* STAGE 5: RECOMMENDATION ENGINE */}
                <div className="dfd1-stage-block">
                  <div className="stage-header">
                    <span className="stage-num">STAGE 5</span>
                    <h4>Recommendation Engine (Process 5.0)</h4>
                  </div>
                  <div className="stage-central-box rec">
                    <p>Multi-Criteria Evaluation (MCE) · Synthesis of drainage upgrades, permeable pavements, and hospital sitings</p>
                  </div>
                </div>

                <div className="flow-arrow-down"><span>↓ Rendered in Real-Time ↓</span></div>

                {/* STAGE 6: INTERACTIVE DASHBOARD */}
                <div className="dfd1-stage-block">
                  <div className="stage-header">
                    <span className="stage-num">STAGE 6</span>
                    <h4>Interactive Dashboard (Process 6.0)</h4>
                  </div>
                  <div className="stage-central-box dash">
                    <p>React/Leaflet Digital Twin UI · Heatmaps · Dynamic Metric Cards · Feasibility Laboratory</p>
                  </div>
                </div>

                <div className="flow-arrow-down"><span>↓ Transmitted to Officials ↓</span></div>

                {/* STAGE 7: MUNICIPAL AUTHORITIES */}
                <div className="dfd1-stage-block final">
                  <div className="stage-central-box user">
                    <h4>Municipal Authorities / Urban Planners</h4>
                    <p>Evidence-based municipal decision-making and project prioritization for Mumbai Smart City</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 4.2.4 DFD LEVEL 2 (AI SIMULATION ENGINE - FIGURE 4.5) */}
          {activeTab === "dfd2" && (
            <div className="arch-flow-diagram-wrapper">
              <div className="flow-intro-card">
                <span className="section-label">DFD LEVEL 2 · AI SIMULATION ENGINE · FIGURE 4.5</span>
                <h3>Internal Processing Workflow of Planning Scenarios & Interventions</h3>
                <p>
                  Depicts the exact 7-stage internal workflow of the AI Simulation Engine, from natural language or parametric scenario input through multi-agent simulation to verified civil recommendations.
                </p>
              </div>

              {/* INTERACTIVE SCENARIO RUNNER DEMO */}
              <div className="sim-interactive-preset-bar">
                <span className="sim-bar-label">Test Scenario Pipeline:</span>
                {["Build New Hospital", "Road Widening", "Metro Expansion", "Drain Blockage"].map((scen) => (
                  <button
                    key={scen}
                    type="button"
                    className={`sim-preset-btn ${activeSimScenario === scen ? "active" : ""}`}
                    onClick={() => setActiveSimScenario(scen)}
                  >
                    {scen}
                  </button>
                ))}
              </div>

              {/* 7 STAGE PIPELINE DISPLAY */}
              <div className="dfd2-stepper">
                {/* STEP 1 */}
                <div className="dfd2-step-card active">
                  <div className="step-badge">STEP 1</div>
                  <div className="step-content">
                    <h4>Government Scenario Input</h4>
                    <div className="step-active-val">Selected: "{activeSimScenario}"</div>
                    <p>Municipal planner initiates policy or civil engineering intervention via UI console or AI Copilot.</p>
                  </div>
                </div>

                <div className="dfd2-connector">↓</div>

                {/* STEP 2 */}
                <div className="dfd2-step-card">
                  <div className="step-badge">STEP 2</div>
                  <div className="step-content">
                    <h4>Scenario Interpreter</h4>
                    <p>Natural Language entity extraction parses target ward extent, intervention type, and feature delta parameters.</p>
                    <span className="step-tech-tag">FastAPI NL Interpreter</span>
                  </div>
                </div>

                <div className="dfd2-connector">↓</div>

                {/* STEP 3 */}
                <div className="dfd2-step-card">
                  <div className="step-badge">STEP 3</div>
                  <div className="step-content">
                    <h4>Fetch Required Spatial Data</h4>
                    <p>Queries PostGIS for relevant spatial layers: road centerlines, building footprints, elevation DEM, and weather records.</p>
                    <span className="step-tech-tag">PostGIS Spatial Query</span>
                  </div>
                </div>

                <div className="dfd2-connector">↓</div>

                {/* STEP 4 */}
                <div className="dfd2-step-card">
                  <div className="step-badge">STEP 4</div>
                  <div className="step-content">
                    <h4>AI Prediction Modules</h4>
                    <div className="step-modules-chips">
                      <span>◈ Traffic Prediction</span>
                      <span>◈ Flood Prediction</span>
                      <span>◈ Pollution Prediction</span>
                      <span>◈ Infrastructure Recommendation</span>
                    </div>
                  </div>
                </div>

                <div className="dfd2-connector">↓</div>

                {/* STEP 5 */}
                <div className="dfd2-step-card">
                  <div className="step-badge">STEP 5</div>
                  <div className="step-content">
                    <h4>Multi-Agent Simulation Engine</h4>
                    <p>Simulates complex emergent spatial interactions, traffic rerouting, runoff accumulation, and buffer displacements.</p>
                    <span className="step-tech-tag">Multi-Agent State Simulator</span>
                  </div>
                </div>

                <div className="dfd2-connector">↓</div>

                {/* STEP 6 */}
                <div className="dfd2-step-card">
                  <div className="step-badge">STEP 6</div>
                  <div className="step-content">
                    <h4>Impact Analysis Module</h4>
                    <p>Evaluates sensitivity shifts against baseline metrics, identifying high-risk and mitigated spatial cells.</p>
                    <span className="step-tech-tag">Delta Variance & Risk Classification</span>
                  </div>
                </div>

                <div className="dfd2-connector">↓</div>

                {/* STEP 7 */}
                <div className="dfd2-step-card">
                  <div className="step-badge">STEP 7</div>
                  <div className="step-content">
                    <h4>Recommendation Generator</h4>
                    <p>Synthesizes actionable municipal guidelines, estimated displacement figures, and drainage engineering priorities.</p>
                    <span className="step-tech-tag">Decision Support Engine</span>
                  </div>
                </div>

                <div className="dfd2-connector">↓</div>

                {/* STEP 8 */}
                <div className="dfd2-step-card final-output">
                  <div className="step-badge">OUTPUT</div>
                  <div className="step-content">
                    <h4>Dashboard + Maps + Heatmaps + Reports</h4>
                    <p>Real-time visual rendering on Leaflet Digital Twin, downloadable official planning dossiers, and executive summaries.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CHAPTER 5: SOFTWARE MODULES DESIGN */}
          {activeTab === "modules" && (
            <div className="arch-flow-diagram-wrapper">
              <div className="flow-intro-card">
                <span className="section-label">CHAPTER 5: SOFTWARE MODULE DESIGN</span>
                <h3>Formal Specification of the 8 Core System Engines</h3>
                <p>
                  Documents the technical implementation, architectural responsibilities, technologies, and active live endpoints for all 8 modules defined in the BCA specialization synopsis.
                </p>
              </div>

              <div className="modules-catalog-grid">
                {modules.map((mod) => (
                  <div key={mod.id} className="module-spec-card">
                    <div className="mod-header">
                      <h4>{mod.name}</h4>
                      <span className="mod-status-badge">{mod.status}</span>
                    </div>

                    <p className="mod-purpose">{mod.purpose}</p>

                    <div className="mod-meta-row">
                      <span className="meta-tag">TECHNOLOGY</span>
                      <strong className="meta-val">{mod.technology}</strong>
                    </div>

                    <div className="mod-endpoints-box">
                      <span className="meta-tag">ACTIVE ENDPOINTS & ASSETS</span>
                      <ul>
                        {mod.active_endpoints.map((ep, i) => (
                          <li key={i}>
                            <code>{ep}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer arch-modal-footer">
          <div className="footer-citation">
            <strong>CIVORA AI Research Citation:</strong> BCA482-5 Specialization Project · School of Sciences, CHRIST (Deemed to be University) · Pilot Ward: K/East Ward, Mumbai
          </div>

          <div className="footer-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onClose}
            >
              Close Blueprint
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
