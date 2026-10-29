
from pathlib import Path

import pandas as pd
import shap
import xgboost
from fastapi import APIRouter, HTTPException


router = APIRouter(
    prefix="/api/explanation",
    tags=["Explainable AI"]
)


BASE_DIR = Path(__file__).resolve().parents[3]

MODEL_FILE = BASE_DIR / "CIVORA_Flood_XGBoost_Model.json"

DATASET_FILE = BASE_DIR / "CIVORA_Flood_ML_Dataset_Final.csv"


FEATURES = [
    "building_area_m2_sum",
    "building_density",
    "ndvi_mean",
    "road_length_m_sum",
    "road_density",
    "idw250_mean"
]


# Load the native XGBoost model
try:
    MODEL = xgboost.XGBClassifier()
    MODEL.load_model(str(MODEL_FILE))
    MODEL_LOAD_ERROR = None

except Exception as error:
    MODEL = None
    MODEL_LOAD_ERROR = str(error)


# Load the CIVORA flood dataset
try:
    DATASET = pd.read_csv(DATASET_FILE)
    DATASET_LOAD_ERROR = None

except Exception as error:
    DATASET = None
    DATASET_LOAD_ERROR = str(error)


@router.get("/{grid_id}")
def get_grid_explanation(grid_id: str):

    if MODEL is None:
        raise HTTPException(
            status_code=500,
            detail=f"CIVORA XGBoost model could not be loaded: {MODEL_LOAD_ERROR}"
        )

    if DATASET is None:
        raise HTTPException(
            status_code=500,
            detail=f"CIVORA flood dataset could not be loaded: {DATASET_LOAD_ERROR}"
        )

    grid = DATASET[
        DATASET["grid_id"].astype(str).str.upper()
        == grid_id.upper()
    ]

    if grid.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Grid '{grid_id}' not found."
        )

    grid_features = grid[FEATURES]

    try:
        explainer = shap.TreeExplainer(MODEL)
        shap_values = explainer.shap_values(grid_features)

        if isinstance(shap_values, list):
            values = shap_values[1][0]
        else:
            values = shap_values[0]

        probability = MODEL.predict_proba(grid_features)[0][1]

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"CIVORA explanation could not be generated: {error}"
        )

    explanations = []

    for feature, value, shap_value in zip(
        FEATURES,
        grid_features.iloc[0].tolist(),
        values
    ):
        explanations.append({
            "feature": feature,
            "value": float(value),
            "shap_value": float(shap_value),
            "direction": (
                "increases" if shap_value > 0
                else "decreases" if shap_value < 0
                else "neutral"
            )
        })

    explanations.sort(
        key=lambda item: abs(item["shap_value"]),
        reverse=True
    )

    return {
        "grid_id": str(grid.iloc[0]["grid_id"]),
        "flood_probability": float(probability),
        "features": explanations
    }
