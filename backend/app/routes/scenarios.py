import json
import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


router = APIRouter(
    prefix="/api/scenarios",
    tags=["Scenarios"]
)


BASE_DIR = Path(__file__).resolve().parents[3]

SUMMARY_FILE = BASE_DIR / "CIVORA_Scenario_Summary.json"
IMPACT_FILE = BASE_DIR / "CIVORA_Scenario_Impact_All_Grids.csv"
GEOJSON_FILE = BASE_DIR / "K_East_CIVORA_Scenario_Decision_WGS84.geojson"

DOC_GEOPACKAGE = Path(r"C:\Users\prati\Documents\CIVORA_DigitalTwin.gpkg")
GEOPACKAGE_FILE = DOC_GEOPACKAGE if DOC_GEOPACKAGE.exists() else (BASE_DIR / "CIVORA_DigitalTwin.gpkg")


@router.get("")
def get_scenarios():

    if not SUMMARY_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="CIVORA scenario summary file not found."
        )

    try:

        with open(
            SUMMARY_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        return data

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=500,
            detail="CIVORA scenario summary JSON is invalid."
        )


@router.get("/hotspots")
def get_hotspots(limit: int = 50):

    if not IMPACT_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="CIVORA scenario impact data not found."
        )

    try:
        import pandas as pd
        df = pd.read_csv(IMPACT_FILE)
        df_sorted = df.sort_values(by="baseline_prediction", ascending=False)
        if limit > 0:
            df_sorted = df_sorted.head(limit)

        hotspots = []
        for rank, (_, row) in enumerate(df_sorted.iterrows(), start=1):
            hotspots.append({
                "rank": rank,
                "grid_id": str(row["grid_id"]),
                "baseline_prediction": float(row["baseline_prediction"]),
                "ndvi_prediction": float(row["ndvi_prediction"]),
                "road_prediction": float(row["road_prediction"]),
                "building_prediction": float(row["building_prediction"]),
                "dominant_scenario": str(row["dominant_scenario"]),
                "maximum_absolute_change": float(row["maximum_absolute_change"]),
                "impact_magnitude": str(row["impact_magnitude"])
            })

        return {
            "total": len(hotspots),
            "study_area": "K/East Ward, Mumbai",
            "hotspots": hotspots
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error compiling flood hotspots: {error}"
        )


@router.get("/benchmark/metrics")
def get_validation_benchmark():
    """
    Returns empirical ground-truth validation metrics comparing model predictions
    against the 57 official MCGM/BMC historical flooding locations.
    """
    return {
        "study_area": "K/East Ward, Mumbai, Maharashtra",
        "total_grids": 405,
        "official_bmc_flood_spots": 57,
        "grids_containing_flood_spots": 68,
        "mean_flood_probability_in_flood_spots": 0.5306,
        "mean_flood_probability_unaffected_grids": 0.0956,
        "risk_concentration_ratio": 5.55,
        "top_tier_capture_rate_pct": 92.65,
        "elevation_stats": {
            "mean_elevation_flood_grids_m": 23.29,
            "mean_elevation_non_flood_grids_m": 24.91,
            "elevation_unit": "meters AMSL"
        },
        "methodology": {
            "model_architecture": "Extreme Gradient Boosting (XGBoost Classifier)",
            "explainability_engine": "TreeSHAP (Lundberg & Lee)",
            "satellite_source": "European Space Agency Sentinel-2 L2A (10m Resolution)",
            "elevation_source": "Open-Meteo 250m Inverse Distance Weighting (IDW)",
            "infrastructure_source": "OpenStreetMap Roads & Microsoft Building Footprints",
            "historical_validation_source": "Municipal Corporation of Greater Mumbai (MCGM / BMC) Official Flood Spots"
        }
    }


@router.get("/{scenario_name}")
def get_scenario(scenario_name: str):

    if not SUMMARY_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="CIVORA scenario summary file not found."
        )

    try:

        with open(
            SUMMARY_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=500,
            detail="CIVORA scenario summary JSON is invalid."
        )

    scenario_statistics = data.get(
        "scenario_statistics",
        {}
    )

    matched_scenario = None

    for name in scenario_statistics:

        if name.lower() == scenario_name.lower():

            matched_scenario = name
            break

    if matched_scenario is None:

        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_name}' not found."
        )

    return {
        "scenario": matched_scenario,
        **scenario_statistics[matched_scenario]
    }


@router.get("/map/scenario-decision")
def get_scenario_decision_map():

    if GEOJSON_FILE.exists():
        try:
            with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    if not GEOPACKAGE_FILE.exists():

        raise HTTPException(
            status_code=404,
            detail="CIVORA GeoPackage not found."
        )

    try:

        connection = sqlite3.connect(
            GEOPACKAGE_FILE
        )

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                grid_id,
                scenario_baseline_probability,
                scenario_ndvi_plus_20_probability,
                scenario_road_density_minus_20_probability,
                scenario_building_density_minus_20_probability,
                scenario_ndvi_change,
                scenario_road_density_change,
                scenario_building_density_change,
                CIVORA_Scenario_Impact_All_Grids_dominant_scenario,
                CIVORA_Scenario_Impact_All_Grids_maximum_absolute_change,
                CIVORA_Scenario_Impact_All_Grids_impact_magnitude
            FROM K_East_CIVORA_Scenario_Decision
            """
        )

        rows = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                column_name,
                srs_id
            FROM gpkg_geometry_columns
            WHERE table_name = ?
            """,
            ("K_East_CIVORA_Scenario_Decision",)
        )

        geometry_info = cursor.fetchone()

        if geometry_info is None:

            connection.close()

            raise HTTPException(
                status_code=500,
                detail="Geometry metadata not found."
            )

        srs_id = geometry_info[1]

        cursor.execute(
            """
            SELECT geom
            FROM K_East_CIVORA_Scenario_Decision
            """
        )

        geometries = cursor.fetchall()

        connection.close()

        features = []

        for row, geometry_row in zip(
            rows,
            geometries
        ):

            geometry_blob = geometry_row[0]

            properties = {
                "id": row[0],
                "grid_id": row[1],
                "baseline_probability": row[2],
                "ndvi_probability": row[3],
                "road_probability": row[4],
                "building_probability": row[5],
                "ndvi_change": row[6],
                "road_change": row[7],
                "building_change": row[8],
                "dominant_scenario": row[9],
                "maximum_absolute_change": row[10],
                "impact_magnitude": row[11]
            }

            features.append(
                {
                    "type": "Feature",
                    "properties": properties,
                    "geometry": geometry_blob.hex()
                }
            )

        return {
            "type": "FeatureCollection",
            "crs_srs_id": srs_id,
            "features": features
        }

    except sqlite3.Error as error:

        raise HTTPException(
            status_code=500,
            detail=f"GeoPackage error: {error}"
        )


class CustomSimulationRequest(BaseModel):
    grid_id: str
    ndvi_delta_pct: float = Field(default=0.0, ge=-100.0, le=200.0)
    road_density_delta_pct: float = Field(default=0.0, ge=-100.0, le=100.0)
    building_density_delta_pct: float = Field(default=0.0, ge=-100.0, le=100.0)


@router.post("/simulate-custom")
def simulate_custom_scenario(req: CustomSimulationRequest):
    """
    Executes live XGBoost inference with custom user-defined parameter deltas.
    Modifies physical features for the specified grid and returns instant predicted delta and SHAP values.
    """
    from app.routes.explanation import MODEL, DATASET, FEATURES

    if MODEL is None or DATASET is None:
        raise HTTPException(
            status_code=500,
            detail="CIVORA XGBoost model or baseline dataset could not be loaded."
        )

    grid_match = DATASET[DATASET["grid_id"].astype(str).str.upper() == req.grid_id.upper()]
    if grid_match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Grid '{req.grid_id}' not found in K/East Ward dataset."
        )

    orig_features = grid_match[FEATURES].copy()
    sim_features = orig_features.copy()

    # Apply continuous percentage modifications
    sim_features["ndvi_mean"] = orig_features["ndvi_mean"] * (1.0 + req.ndvi_delta_pct / 100.0)

    road_factor = 1.0 + req.road_density_delta_pct / 100.0
    sim_features["road_density"] = orig_features["road_density"] * road_factor
    sim_features["road_length_m_sum"] = orig_features["road_length_m_sum"] * road_factor

    bldg_factor = 1.0 + req.building_density_delta_pct / 100.0
    sim_features["building_density"] = orig_features["building_density"] * bldg_factor
    sim_features["building_area_m2_sum"] = orig_features["building_area_m2_sum"] * bldg_factor

    try:
        baseline_prob = float(MODEL.predict_proba(orig_features)[0][1])
        simulated_prob = float(MODEL.predict_proba(sim_features)[0][1])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Inference error during custom simulation: {e}"
        )

    delta_prob = simulated_prob - baseline_prob
    delta_pp = delta_prob * 100.0
    relative_change_pct = (delta_prob / baseline_prob * 100.0) if baseline_prob > 0 else 0.0

    # Calculate simulated SHAP explanations
    sim_explanations = []
    try:
        import shap
        explainer = shap.TreeExplainer(MODEL)
        sim_shap = explainer.shap_values(sim_features)
        shap_vals = sim_shap[1][0] if isinstance(sim_shap, list) else sim_shap[0]

        for feat, val, sval in zip(FEATURES, sim_features.iloc[0].tolist(), shap_vals):
            sim_explanations.append({
                "feature": feat,
                "value": float(val),
                "shap_value": float(sval),
                "direction": "increases" if sval > 0 else "decreases" if sval < 0 else "neutral"
            })
        sim_explanations.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
    except Exception:
        pass

    return {
        "grid_id": str(grid_match.iloc[0]["grid_id"]),
        "baseline_probability": baseline_prob,
        "simulated_probability": simulated_prob,
        "delta_probability": delta_prob,
        "delta_pp": delta_pp,
        "relative_change_pct": relative_change_pct,
        "interventions": {
            "ndvi_delta_pct": req.ndvi_delta_pct,
            "road_density_delta_pct": req.road_density_delta_pct,
            "building_density_delta_pct": req.building_density_delta_pct
        },
        "features": {
            "baseline": orig_features.iloc[0].to_dict(),
            "simulated": sim_features.iloc[0].to_dict()
        },
        "shap_explanations": sim_explanations
    }