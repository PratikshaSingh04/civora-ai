from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.services.feasibility import ENGINE

router = APIRouter(prefix="/api/infrastructure", tags=["infrastructure"])


class AlignmentRequest(BaseModel):
    alignment_name: str = Field(default="Proposed Alignment", description="Label for the alignment")
    project_type: str = Field(default="highway", description="highway, road_widening, or green_corridor")
    coordinates: List[List[float]] = Field(
        ...,
        description="Ordered list of [longitude, latitude] coordinates in WGS84"
    )
    corridor_width_m: float = Field(
        default=30.0,
        ge=5.0,
        le=100.0,
        description="Corridor buffer width in meters (5m to 100m)"
    )


class ComparisonRequest(BaseModel):
    alignment_a: AlignmentRequest
    alignment_b: AlignmentRequest


@router.get("/presets")
def get_presets():
    """Returns verified K/East Ward infrastructure corridor presets."""
    return {
        "ward": "K/East Ward, Mumbai",
        "presets": ENGINE.get_corridor_presets()
    }


@router.post("/analyze-alignment")
def analyze_alignment(request: AlignmentRequest):
    """
    Executes deterministic GIS corridor conflict and flood-risk analysis
    against 11,584 building footprints, 600 road segments, 405 grid cells,
    and 57 official BMC waterlogging spots.
    """
    if len(request.coordinates) < 2:
        raise HTTPException(
            status_code=400,
            detail="Alignment requires at least 2 coordinate points [longitude, latitude]."
        )

    # Basic coordinate bounds check for Mumbai / K/East area
    for idx, pt in enumerate(request.coordinates):
        if len(pt) != 2:
            raise HTTPException(
                status_code=400,
                detail=f"Coordinate at index {idx} must be a pair [lon, lat]."
            )
        lon, lat = pt[0], pt[1]
        if not (72.70 <= lon <= 73.05 and 18.90 <= lat <= 19.30):
            raise HTTPException(
                status_code=400,
                detail=f"Coordinate [{lon}, {lat}] is outside the Mumbai regional bounding box."
            )

    try:
        coords_tuples = [(float(pt[0]), float(pt[1])) for pt in request.coordinates]
        result = ENGINE.analyze_alignment(
            coordinates=coords_tuples,
            corridor_width_m=request.corridor_width_m,
            project_type=request.project_type,
            alignment_name=request.alignment_name
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feasibility GIS error: {str(e)}")


@router.post("/compare-alignments")
def compare_alignments(request: ComparisonRequest):
    """
    Evaluates two proposed alignments side-by-side using the same
    deterministic GIS analysis engine and computes trade-off analytics.
    """
    try:
        coords_a = [(float(pt[0]), float(pt[1])) for pt in request.alignment_a.coordinates]
        coords_b = [(float(pt[0]), float(pt[1])) for pt in request.alignment_b.coordinates]

        res_a = ENGINE.analyze_alignment(
            coordinates=coords_a,
            corridor_width_m=request.alignment_a.corridor_width_m,
            project_type=request.alignment_a.project_type,
            alignment_name=request.alignment_a.alignment_name
        )
        res_b = ENGINE.analyze_alignment(
            coordinates=coords_b,
            corridor_width_m=request.alignment_b.corridor_width_m,
            project_type=request.alignment_b.project_type,
            alignment_name=request.alignment_b.alignment_name
        )

        # Compute side-by-side comparison deltas (A - B)
        len_diff = res_a["metrics"]["route_length_m"] - res_b["metrics"]["route_length_m"]
        bldg_diff = res_a["building_conflicts"]["intersected_count"] - res_b["building_conflicts"]["intersected_count"]
        bldg_area_diff = res_a["building_conflicts"]["total_intersected_area_m2"] - res_b["building_conflicts"]["total_intersected_area_m2"]
        flood_risk_diff = res_a["flood_risk_exposure"]["mean_baseline_probability"] - res_b["flood_risk_exposure"]["mean_baseline_probability"]
        score_diff = res_a["feasibility_assessment"]["conflict_score"] - res_b["feasibility_assessment"]["conflict_score"]

        tradeoffs = {
            "length_difference_m": round(len_diff, 1),
            "building_count_difference": bldg_diff,
            "building_area_difference_m2": round(bldg_area_diff, 1),
            "mean_flood_risk_difference_pct": round(flood_risk_diff * 100.0, 2),
            "conflict_score_difference": round(score_diff, 1),
            "summary_statement": (
                f"{res_a['alignment_name']} presents {abs(bldg_diff)} {'more' if bldg_diff > 0 else 'fewer'} building conflicts "
                f"and {abs(round(flood_risk_diff * 100, 1))}% {'higher' if flood_risk_diff > 0 else 'lower'} average flood risk exposure "
                f"relative to {res_b['alignment_name']}."
            )
        }

        return {
            "alignment_a": res_a,
            "alignment_b": res_b,
            "tradeoffs": tradeoffs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison GIS error: {str(e)}")

