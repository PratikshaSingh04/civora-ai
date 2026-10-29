from fastapi import APIRouter
from typing import Dict, Any, List

router = APIRouter(prefix="/api/architecture", tags=["architecture"])

ER_ENTITIES: List[Dict[str, Any]] = [
    {
        "id": "department",
        "name": "Department",
        "table_name": "civora_department",
        "category": "Governance",
        "primary_key": "department_id",
        "foreign_keys": [],
        "row_count": 5,
        "description": "Represents municipal departments governing civic operations, planning approvals, and emergency interventions in K/East Ward.",
        "attributes": [
            {"column": "department_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Unique municipal department identifier"},
            {"column": "name", "type": "VARCHAR(128)", "is_pk": False, "description": "Official municipal department title"},
            {"column": "code", "type": "VARCHAR(16)", "is_pk": False, "description": "Short MCGM administrative code"},
            {"column": "clearance_level", "type": "VARCHAR(32)", "is_pk": False, "description": "Administrative authority tier (Level 1-4)"},
            {"column": "active_personnel", "type": "INTEGER", "is_pk": False, "description": "Authorized municipal officers in active directory"}
        ]
    },
    {
        "id": "user",
        "name": "User",
        "table_name": "civora_user",
        "category": "Governance",
        "primary_key": "user_id",
        "foreign_keys": ["department_id -> civora_department.department_id"],
        "row_count": 5,
        "description": "Authorized planners, municipal commissioners, disaster coordinators, and engineers accessing the digital twin.",
        "attributes": [
            {"column": "user_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Unique officer ID"},
            {"column": "department_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Department"},
            {"column": "full_name", "type": "VARCHAR(128)", "is_pk": False, "description": "Officer full legal name"},
            {"column": "email", "type": "VARCHAR(128)", "is_pk": False, "description": "Official MCGM gov portal email"},
            {"column": "designation", "type": "VARCHAR(64)", "is_pk": False, "description": "Official municipal post title"},
            {"column": "session_token", "type": "VARCHAR(256)", "is_pk": False, "description": "Cryptographic role-based token"}
        ]
    },
    {
        "id": "geographic_zone",
        "name": "Geographic Zone",
        "table_name": "civora_geographic_zone",
        "category": "Spatial",
        "primary_key": "zone_id",
        "foreign_keys": [],
        "row_count": 405,
        "description": "Spatial grid cells (250m x 250m) covering the complete 16.5 sq km administrative expanse of K/East Ward (Andheri East).",
        "attributes": [
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Cell identifier (e.g. KE_G_0024)"},
            {"column": "ward_code", "type": "VARCHAR(16)", "is_pk": False, "description": "MCGM ward boundary code (K/East)"},
            {"column": "centroid_lat", "type": "DOUBLE PRECISION", "is_pk": False, "description": "Latitude centroid in EPSG:4326"},
            {"column": "centroid_lon", "type": "DOUBLE PRECISION", "is_pk": False, "description": "Longitude centroid in EPSG:4326"},
            {"column": "geometry", "type": "GEOMETRY(POLYGON, 4326)", "is_pk": False, "description": "PostGIS spatial polygon bounding box"},
            {"column": "elevation_m", "type": "REAL", "is_pk": False, "description": "Mean terrain elevation from DEM (5.5m - 48.2m)"}
        ]
    },
    {
        "id": "traffic_data",
        "name": "Traffic Data",
        "table_name": "civora_traffic_data",
        "category": "Mobility",
        "primary_key": "record_id",
        "foreign_keys": ["zone_id -> civora_geographic_zone.zone_id"],
        "row_count": 600,
        "description": "Traffic flow telemetry, road density coefficients, network connectivity indices, and peak volume estimations.",
        "attributes": [
            {"column": "record_id", "type": "BIGINT", "is_pk": True, "description": "Sequential telemetry log sequence ID"},
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Geographic Zone"},
            {"column": "road_length_m", "type": "REAL", "is_pk": False, "description": "Total road centerline length in cell (meters)"},
            {"column": "road_density_km_km2", "type": "REAL", "is_pk": False, "description": "Normalized road density metric"},
            {"column": "congestion_index", "type": "REAL", "is_pk": False, "description": "Modeled corridor congestion factor (0.0 - 1.0)"}
        ]
    },
    {
        "id": "weather_data",
        "name": "Weather Data",
        "table_name": "civora_weather_data",
        "category": "Environmental",
        "primary_key": "weather_id",
        "foreign_keys": ["zone_id -> civora_geographic_zone.zone_id"],
        "row_count": 3652,
        "description": "Historical meteorological time-series (2015-2025) including precipitation, monsoon peaks, humidity, and surface pressure.",
        "attributes": [
            {"column": "weather_id", "type": "BIGINT", "is_pk": True, "description": "Observation record primary key"},
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Geographic Zone"},
            {"column": "observation_date", "type": "DATE", "is_pk": False, "description": "Meteorological observation timestamp"},
            {"column": "precipitation_sum_mm", "type": "REAL", "is_pk": False, "description": "Daily rainfall accumulation (mm)"},
            {"column": "monsoon_extreme_flag", "type": "BOOLEAN", "is_pk": False, "description": "True when precipitation > 100mm/day"}
        ]
    },
    {
        "id": "flood_data",
        "name": "Flood Data",
        "table_name": "civora_flood_data",
        "category": "Disaster",
        "primary_key": "flood_spot_id",
        "foreign_keys": ["zone_id -> civora_geographic_zone.zone_id"],
        "row_count": 57,
        "description": "57 official BMC verified waterlogging hotspots in K/East Ward documenting historical submersions and drainage choke points.",
        "attributes": [
            {"column": "flood_spot_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Official BMC waterlogging spot identifier"},
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Geographic Zone"},
            {"column": "location_name", "type": "VARCHAR(128)", "is_pk": False, "description": "Prominent landmark / intersection name"},
            {"column": "historical_severity", "type": "VARCHAR(32)", "is_pk": False, "description": "Waterlogging depth tier (Severe/Moderate/Minor)"},
            {"column": "reported_incidents", "type": "INTEGER", "is_pk": False, "description": "Historical incident logs during monsoon"}
        ]
    },
    {
        "id": "infrastructure",
        "name": "Infrastructure",
        "table_name": "civora_infrastructure",
        "category": "Built Environment",
        "primary_key": "building_id",
        "foreign_keys": ["zone_id -> civora_geographic_zone.zone_id"],
        "row_count": 11584,
        "description": "11,584 verified structural building footprints, road centerlines, stormwater nullahs, metro stations, and civic amenities.",
        "attributes": [
            {"column": "building_id", "type": "BIGINT", "is_pk": True, "description": "Unique building footprint ID"},
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Geographic Zone"},
            {"column": "footprint_area_sqm", "type": "REAL", "is_pk": False, "description": "Planar polygon footprint area in sq meters"},
            {"column": "impervious_ratio", "type": "REAL", "is_pk": False, "description": "Impermeable surface coverage fraction (0-1)"},
            {"column": "geometry", "type": "GEOMETRY(POLYGON, 32643)", "is_pk": False, "description": "UTM Zone 43N projected structural polygon"}
        ]
    },
    {
        "id": "digital_twin",
        "name": "Digital Twin",
        "table_name": "civora_digital_twin_layer",
        "category": "Spatial",
        "primary_key": "twin_layer_id",
        "foreign_keys": ["zone_id -> civora_geographic_zone.zone_id"],
        "row_count": 405,
        "description": "Virtual multi-dimensional representation of K/East Ward fusing elevation, NDVI, road density, building density, and flood history.",
        "attributes": [
            {"column": "twin_layer_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Layer composite primary key"},
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Geographic Zone"},
            {"column": "ndvi_mean", "type": "REAL", "is_pk": False, "description": "Sentinel-2 mean vegetation index (-1.0 to +1.0)"},
            {"column": "building_density", "type": "REAL", "is_pk": False, "description": "Built-up surface area divided by grid area"},
            {"column": "elevation_idw", "type": "REAL", "is_pk": False, "description": "Interpolated terrain surface elevation (meters)"}
        ]
    },
    {
        "id": "ai_model",
        "name": "AI Model",
        "table_name": "civora_ai_model",
        "category": "Machine Learning",
        "primary_key": "model_id",
        "foreign_keys": [],
        "row_count": 2,
        "description": "XGBoost tree classification and regression models trained on spatial features with 92.65% flood hotspot capture accuracy.",
        "attributes": [
            {"column": "model_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Model registry artifact ID"},
            {"column": "algorithm", "type": "VARCHAR(64)", "is_pk": False, "description": "Machine learning algorithm (XGBoost)"},
            {"column": "version", "type": "VARCHAR(16)", "is_pk": False, "description": "Model deployment version (e.g. v1.2.0)"},
            {"column": "capture_rate", "type": "REAL", "is_pk": False, "description": "Validation flood spot capture rate (92.65%)"},
            {"column": "feature_count", "type": "INTEGER", "is_pk": False, "description": "Number of spatial predictors (elevation, NDVI, etc.)"}
        ]
    },
    {
        "id": "prediction",
        "name": "Prediction",
        "table_name": "civora_prediction",
        "category": "Machine Learning",
        "primary_key": "prediction_id",
        "foreign_keys": ["model_id -> civora_ai_model.model_id", "zone_id -> civora_geographic_zone.zone_id"],
        "row_count": 405,
        "description": "Baseline and scenario-adjusted flood probability inferences computed for each 250m cell.",
        "attributes": [
            {"column": "prediction_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Unique inference output ID"},
            {"column": "model_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to AI Model"},
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Geographic Zone"},
            {"column": "probability", "type": "REAL", "is_pk": False, "description": "Model flood probability score (0.000 to 1.000)"},
            {"column": "risk_tier", "type": "VARCHAR(16)", "is_pk": False, "description": "Categorical rating: Critical, High, Moderate, Low"}
        ]
    },
    {
        "id": "explanation",
        "name": "Explanation",
        "table_name": "civora_explanation",
        "category": "Explainable AI",
        "primary_key": "explanation_id",
        "foreign_keys": ["prediction_id -> civora_prediction.prediction_id"],
        "row_count": 405,
        "description": "TreeSHAP local feature attribution vectors revealing which geographical attributes drive flood vulnerability up or down.",
        "attributes": [
            {"column": "explanation_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Explanation record primary key"},
            {"column": "prediction_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Prediction"},
            {"column": "base_value", "type": "REAL", "is_pk": False, "description": "Global expected model margin (base value)"},
            {"column": "shap_elevation", "type": "REAL", "is_pk": False, "description": "SHAP contribution of terrain elevation"},
            {"column": "shap_ndvi", "type": "REAL", "is_pk": False, "description": "SHAP contribution of vegetation density"},
            {"column": "shap_building_density", "type": "REAL", "is_pk": False, "description": "SHAP contribution of built-up footprint"}
        ]
    },
    {
        "id": "simulation",
        "name": "Simulation",
        "table_name": "civora_simulation",
        "category": "Simulation",
        "primary_key": "simulation_id",
        "foreign_keys": ["user_id -> civora_user.user_id"],
        "row_count": 38,
        "description": "What-If planning scenarios (e.g. NDVI +20%, Road Density -20%, permeable corridors, sponge reservoirs) simulated by planners.",
        "attributes": [
            {"column": "simulation_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Simulation session UUID"},
            {"column": "user_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to User who initiated run"},
            {"column": "scenario_type", "type": "VARCHAR(64)", "is_pk": False, "description": "Intervention title or corridor alignment"},
            {"column": "delta_parameters", "type": "JSONB", "is_pk": False, "description": "Feature modifications applied across ward cells"},
            {"column": "cells_improved", "type": "INTEGER", "is_pk": False, "description": "Count of cells with measurable risk decrease"}
        ]
    },
    {
        "id": "recommendation",
        "name": "Recommendation",
        "table_name": "civora_recommendation",
        "category": "Decision Support",
        "primary_key": "recommendation_id",
        "foreign_keys": ["simulation_id -> civora_simulation.simulation_id"],
        "row_count": 76,
        "description": "Actionable municipal engineering guidelines generated for ward officers based on simulation deltas and SHAP diagnostics.",
        "attributes": [
            {"column": "recommendation_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Recommendation identifier"},
            {"column": "simulation_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Foreign key to Simulation"},
            {"column": "target_zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Target spatial cell identifier"},
            {"column": "action_title", "type": "VARCHAR(128)", "is_pk": False, "description": "Specific civil engineering intervention"},
            {"column": "priority_level", "type": "VARCHAR(16)", "is_pk": False, "description": "Priority: Critical, High, Medium, Low"}
        ]
    },
    {
        "id": "report",
        "name": "Report",
        "table_name": "civora_report",
        "category": "Reporting",
        "primary_key": "report_id",
        "foreign_keys": [
            "prediction_id -> civora_prediction.prediction_id",
            "recommendation_id -> civora_recommendation.recommendation_id"
        ],
        "row_count": 24,
        "description": "Official municipal planning dossiers combining spatial maps, XGBoost predictions, SHAP attributions, and civil recommendations.",
        "attributes": [
            {"column": "report_id", "type": "VARCHAR(32)", "is_pk": True, "description": "Dossier report identifier"},
            {"column": "generated_by_user_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Authorizing municipal planner"},
            {"column": "zone_id", "type": "VARCHAR(32)", "is_pk": False, "description": "Focus grid cell or ward summary"},
            {"column": "dossier_json", "type": "JSONB", "is_pk": False, "description": "Full serialized diagnostic report data"},
            {"column": "created_at", "type": "TIMESTAMP", "is_pk": False, "description": "Formal issuance timestamp"}
        ]
    }
]

ER_RELATIONSHIPS: List[Dict[str, Any]] = [
    {
        "source": "Department",
        "target": "User",
        "cardinality": "1:M",
        "synopsis_ref": "Department -> User (1:M)",
        "description": "A single department may have several authorized users, whereas each user is associated with one particular department."
    },
    {
        "source": "Geographic Zone",
        "target": "Traffic Data",
        "cardinality": "1:M",
        "synopsis_ref": "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)",
        "description": "Each geographic area stores time-series and network traffic information."
    },
    {
        "source": "Geographic Zone",
        "target": "Weather Data",
        "cardinality": "1:M",
        "synopsis_ref": "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)",
        "description": "Each geographic cell stores historical meteorological observations and forecasts."
    },
    {
        "source": "Geographic Zone",
        "target": "Flood Data",
        "cardinality": "1:M",
        "synopsis_ref": "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)",
        "description": "Each geographic cell links to verified BMC waterlogging points."
    },
    {
        "source": "Geographic Zone",
        "target": "Infrastructure",
        "cardinality": "1:M",
        "synopsis_ref": "Geographic Zone -> Traffic, Weather, Flood & Infrastructure (1:M)",
        "description": "Each geographic cell contains building footprints, roads, and civil assets."
    },
    {
        "source": "Geographic Zone",
        "target": "Digital Twin",
        "cardinality": "1:1",
        "synopsis_ref": "Geographic Zone -> Digital Twin (1:1)",
        "description": "One Digital Twin layer is used for each geographic cell, modeling physical and environmental features."
    },
    {
        "source": "AI Model",
        "target": "Prediction",
        "cardinality": "1:M",
        "synopsis_ref": "AI Model -> Prediction (1:M)",
        "description": "A single trained AI model produces predictions across all cells and planning scenarios."
    },
    {
        "source": "Prediction",
        "target": "Explanation",
        "cardinality": "1:1",
        "synopsis_ref": "Prediction -> Explanation (1:1)",
        "description": "Each prediction has an attached explanation produced using Explainable AI (TreeSHAP)."
    },
    {
        "source": "User",
        "target": "Simulation",
        "cardinality": "1:M",
        "synopsis_ref": "User -> Simulation (1:M)",
        "description": "Municipal users create simulation scenarios to test urban planning interventions."
    },
    {
        "source": "Simulation",
        "target": "Recommendation",
        "cardinality": "1:M",
        "synopsis_ref": "Simulation -> Recommendation (1:M)",
        "description": "Each planning simulation generates prioritized civil engineering recommendations."
    },
    {
        "source": "Prediction",
        "target": "Report",
        "cardinality": "1:M",
        "synopsis_ref": "Report <- Prediction & Recommendation",
        "description": "Reports synthesize prediction risk models into official dossiers."
    },
    {
        "source": "Recommendation",
        "target": "Report",
        "cardinality": "1:M",
        "synopsis_ref": "Report <- Prediction & Recommendation",
        "description": "Reports incorporate AI-generated municipal interventions for decision-makers."
    }
]

SOFTWARE_MODULES: List[Dict[str, Any]] = [
    {
        "id": "auth",
        "name": "1. Authentication Module",
        "purpose": "Secures access to the platform by checking department role clearance and preserving session tokens across municipal roles.",
        "technology": "FastAPI, PostgreSQL, Pydantic",
        "status": "Operational (Live)",
        "active_endpoints": ["/api/auth/departments", "/api/auth/login", "/api/auth/me"]
    },
    {
        "id": "data_collection",
        "name": "2. Data Collection Module",
        "purpose": "Gathers and arranges urban datasets from OpenStreetMap, Copernicus Sentinel-2, Open-Meteo DEM, and official MCGM flood records.",
        "technology": "Python, Requests, GeoPandas, PyProj",
        "status": "Operational (Live)",
        "active_endpoints": ["/data/K_East_Grid_Context.json", "CIVORA_DigitalTwin.gpkg"]
    },
    {
        "id": "gis_management",
        "name": "3. GIS Management Module",
        "purpose": "Stores, indexes, and visualizes multi-layer geospatial entities with EPSG:4326 / EPSG:32643 reprojection and Leaflet map rendering.",
        "technology": "PostGIS, GeoJSON, Leaflet, Turf.js",
        "status": "Operational (Live)",
        "active_endpoints": ["/data/K_East_Grid_WGS84.geojson", "Leaflet Polygon Layers"]
    },
    {
        "id": "digital_twin",
        "name": "4. Digital Twin Module",
        "purpose": "Forms a virtual spatial model of K/East Ward fusing 405 cells, 11,584 buildings, 600 roads, and 57 historical flood spots.",
        "technology": "Python, NumPy, Shapely, GeoPackage",
        "status": "Operational (Live)",
        "active_endpoints": ["/api/scenarios", "/api/scenarios/hotspots"]
    },
    {
        "id": "ai_prediction",
        "name": "5. AI Prediction Module",
        "purpose": "Executes trained XGBoost classification engine capturing 92.65% of flood-prone spots based on verified topographic features.",
        "technology": "XGBoost, Scikit-learn, Joblib",
        "status": "Operational (Live)",
        "active_endpoints": ["CIVORA_Flood_XGBoost_Model.json", "/api/scenarios/predict"]
    },
    {
        "id": "simulation",
        "name": "6. Simulation Module",
        "purpose": "Evaluates What-If sensitivities (NDVI greening, road density, building density) and spatial buffer corridor feasibility conflicts.",
        "technology": "Python, Shapely Spatial Buffers, Pandas",
        "status": "Operational (Live)",
        "active_endpoints": ["/api/infrastructure/analyze-alignment", "/api/copilot/query"]
    },
    {
        "id": "dashboard",
        "name": "7. Dashboard Module",
        "purpose": "Presents an interactive acrylic glassmorphic UI with floating navigation, telemetry, 2D/3D map toggles, and cell inspector.",
        "technology": "React, TypeScript, CSS Glassmorphism, Leaflet",
        "status": "Operational (Live)",
        "active_endpoints": ["http://localhost:5173/"]
    },
    {
        "id": "reporting",
        "name": "8. Reporting Module",
        "purpose": "Produces official municipal planning dossiers synthesizing TreeSHAP explanations, risk distributions, and engineering actions.",
        "technology": "FastAPI, Markdown/JSON Serializer, Web Print Engine",
        "status": "Operational (Live)",
        "active_endpoints": ["/api/explanation/{grid_id}", "Dossier Export Engine"]
    }
]

@router.get("/schema")
def get_architecture_schema() -> Dict[str, Any]:
    """Returns the complete formal system architecture schema matching Synopsis Chapter 4 & 5."""
    return {
        "project": "CIVORA AI",
        "synopsis_chapter_4": "System Architecture & Engineering Diagrams",
        "synopsis_chapter_5": "Software Module Design",
        "pilot_ward": "K/East Ward, Mumbai",
        "entities": ER_ENTITIES,
        "relationships": ER_RELATIONSHIPS,
        "modules": SOFTWARE_MODULES,
        "stats": {
            "total_entities": len(ER_ENTITIES),
            "total_relationships": len(ER_RELATIONSHIPS),
            "total_modules": len(SOFTWARE_MODULES),
            "spatial_cells_monitored": 405,
            "verified_building_footprints": 11584,
            "road_segments_evaluated": 600,
            "ground_truth_flood_points": 57
        }
    }
