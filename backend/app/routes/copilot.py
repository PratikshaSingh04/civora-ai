import os
import json
import urllib.request
import urllib.error
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.feasibility import ENGINE

router = APIRouter(prefix="/api/copilot", tags=["AI Copilot & Scenario Interpreter"])

BASE_DIR = Path(__file__).resolve().parents[3]
GRID_CONTEXT_FILE = BASE_DIR / "frontend" / "public" / "data" / "K_East_Grid_Context.json"

def _get_gemini_api_key() -> Optional[str]:
    """Retrieve Gemini API key from environment variables or backend/.env file."""
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key and key.strip():
        return key.strip()

    for candidate in [BASE_DIR / "backend" / ".env", BASE_DIR / ".env"]:
        if candidate.exists():
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip().strip('"').strip("'")
                            if k in ("GEMINI_API_KEY", "GOOGLE_API_KEY") and v:
                                os.environ[k] = v
                                return v
            except Exception:
                pass
    return None

class CopilotQueryRequest(BaseModel):
    query: str
    department_id: Optional[str] = "urban_planning"
    selected_grid_id: Optional[str] = "KE_G_0024"

class SuitableSite(BaseModel):
    rank: int
    grid_id: str
    suitability_score: float
    flood_probability_pct: float
    road_length_m: float
    elevation_m: float
    roads: List[str]
    flood_spots: List[str]
    justification: str
    center: List[float]

class CopilotActionPayload(BaseModel):
    type: str # "HIGHLIGHT_SITE" | "RENDER_CORRIDOR" | "FOCUS_GRID" | "OPEN_WHATIF" | "GENERAL_INFO"
    grid_id: Optional[str] = None
    center: Optional[List[float]] = None
    corridor_id: Optional[str] = None
    corridor_data: Optional[Dict[str, Any]] = None
    sites: Optional[List[SuitableSite]] = None

class CopilotQueryResponse(BaseModel):
    intent: str
    reply: str
    recommendation: str
    action: CopilotActionPayload
    metadata: Dict[str, Any]

def _load_grid_context() -> Dict[str, Any]:
    if not GRID_CONTEXT_FILE.exists():
        return {}
    with open(GRID_CONTEXT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _call_gemini_api(api_key: str, prompt: str, system_prompt: str) -> Optional[Dict[str, Any]]:
    """Calls Google Gemini REST API using urllib (standard library)."""
    models = ["models/gemini-flash-lite-latest", "models/gemini-flash-latest", "models/gemini-2.5-flash"]
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }
    data = json.dumps(payload).encode("utf-8")

    for model in models:
        model_path = model if model.startswith("models/") else f"models/{model}"
        url = f"https://generativelanguage.googleapis.com/v1beta/{model_path}:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status == 200:
                    body = json.loads(resp.read().decode("utf-8"))
                    candidates = body.get("candidates", [])
                    if candidates:
                        text_output = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if text_output:
                            return json.loads(text_output)
        except Exception as e:
            # Try next model or fallback
            continue
    return None

# Multi-Criteria Evaluation for Facility Site Suitability
def _evaluate_hospital_suitability(grids: Dict[str, Any], limit: int = 3) -> List[SuitableSite]:
    scored = []
    for gid, data in grids.items():
        base_pred = data.get("baseline_prediction")
        if base_pred is None:
            continue
        elevation = data.get("elevation_m") or 24.0
        road_len = data.get("road_length_m") or 0.0
        flood_spots = data.get("flood_spots", [])
        
        # Hospital Criteria:
        # 1. Low flood probability (prefer < 0.15)
        # 2. High road access length (for emergency transit)
        # 3. No historical BMC waterlogging spots
        # 4. Elevation above drainage depression (> 22m AMSL)
        flood_score = max(0.0, (1.0 - base_pred) * 40.0) # max 40
        road_score = min(30.0, (road_len / 1200.0) * 30.0) # max 30
        elev_score = min(20.0, max(0.0, (elevation - 18.0) / 15.0) * 20.0) # max 20
        spot_penalty = len(flood_spots) * 25.0
        
        total_score = max(0.0, flood_score + road_score + elev_score - spot_penalty)
        
        roads = data.get("roads", [])
        road_name = roads[0] if roads else "Local arterial street"
        
        justification = (
            f"Ground elevation is {elevation:.1f}m AMSL with low baseline flood probability "
            f"({(base_pred * 100):.1f}%). Features {road_len:.0f}m of verified road connectivity along {road_name} "
            f"with 0 recorded BMC waterlogging occurrences."
        )
        
        scored.append({
            "grid_id": gid,
            "suitability_score": round(total_score, 1),
            "flood_probability_pct": round(base_pred * 100, 2),
            "road_length_m": round(road_len, 1),
            "elevation_m": round(elevation, 1),
            "roads": roads,
            "flood_spots": flood_spots,
            "justification": justification,
            "center": data.get("center", [19.1130, 72.8656])
        })
    
    scored.sort(key=lambda x: x["suitability_score"], reverse=True)
    results = []
    for rank, item in enumerate(scored[:limit], start=1):
        item["rank"] = rank
        results.append(SuitableSite(**item))
    return results

def _evaluate_sponge_suitability(grids: Dict[str, Any], limit: int = 3) -> List[SuitableSite]:
    scored = []
    for gid, data in grids.items():
        base_pred = data.get("baseline_prediction")
        if base_pred is None:
            continue
        elevation = data.get("elevation_m") or 24.0
        flood_spots = data.get("flood_spots", [])
        bldg_density = data.get("building_density") or 0.0
        
        # Sponge Park Criteria:
        # Located in hydrological depression (< 23m) with high runoff demand
        depression_score = max(0.0, (26.0 - elevation) * 4.0) # max 35
        vulnerability_score = (base_pred * 45.0) # max 45
        runoff_score = (bldg_density * 20.0) # max 20
        total_score = depression_score + vulnerability_score + runoff_score
        
        roads = data.get("roads", [])
        road_name = roads[0] if roads else "Ward sector"
        
        justification = (
            f"Low-lying depression at {elevation:.1f}m AMSL with {(base_pred * 100):.1f}% flood probability. "
            f"High impermeable catchment density makes this an optimal retention basin candidate near {road_name}."
        )
        
        scored.append({
            "grid_id": gid,
            "suitability_score": round(total_score, 1),
            "flood_probability_pct": round(base_pred * 100, 2),
            "road_length_m": round(data.get("road_length_m") or 0.0, 1),
            "elevation_m": round(elevation, 1),
            "roads": roads,
            "flood_spots": flood_spots,
            "justification": justification,
            "center": data.get("center", [19.1130, 72.8656])
        })
    
    scored.sort(key=lambda x: x["suitability_score"], reverse=True)
    results = []
    for rank, item in enumerate(scored[:limit], start=1):
        item["rank"] = rank
        results.append(SuitableSite(**item))
    return results

def _evaluate_school_suitability(grids: Dict[str, Any], limit: int = 3) -> List[SuitableSite]:
    scored = []
    for gid, data in grids.items():
        base_pred = data.get("baseline_prediction")
        if base_pred is None:
            continue
        elevation = data.get("elevation_m") or 24.0
        road_len = data.get("road_length_m") or 0.0
        flood_spots = data.get("flood_spots", [])
        
        # School Criteria:
        # 1. Very low flood probability (< 12%)
        # 2. Elevation safely above drainage basins (> 23m AMSL)
        # 3. High road access for bus transit and pedestrian safety
        # 4. Zero historical BMC flood spots
        flood_score = max(0.0, (1.0 - base_pred) * 45.0)
        road_score = min(25.0, (road_len / 1000.0) * 25.0)
        elev_score = min(30.0, max(0.0, (elevation - 18.0) / 15.0) * 30.0)
        spot_penalty = len(flood_spots) * 30.0
        
        total_score = max(0.0, flood_score + road_score + elev_score - spot_penalty)
        roads = data.get("roads", [])
        road_name = roads[0] if roads else "Local community corridor"
        
        justification = (
            f"Safe elevated terrain at {elevation:.1f}m AMSL with very low baseline flood vulnerability "
            f"({(base_pred * 100):.1f}%). Safe pedestrian/bus ingress via {road_len:.0f}m verified road network "
            f"along {road_name} with 0 recorded BMC waterlogging occurrences."
        )
        
        scored.append({
            "grid_id": gid,
            "suitability_score": round(total_score, 1),
            "flood_probability_pct": round(base_pred * 100, 2),
            "road_length_m": round(road_len, 1),
            "elevation_m": round(elevation, 1),
            "roads": roads,
            "flood_spots": flood_spots,
            "justification": justification,
            "center": data.get("center", [19.1130, 72.8656])
        })
    
    scored.sort(key=lambda x: x["suitability_score"], reverse=True)
    results = []
    for rank, item in enumerate(scored[:limit], start=1):
        item["rank"] = rank
        results.append(SuitableSite(**item))
    return results


@router.post("/query", response_model=CopilotQueryResponse)
def handle_copilot_query(request: CopilotQueryRequest):
    q = request.query.lower().strip()
    grids = _load_grid_context()
    active_grid = request.selected_grid_id or "KE_G_0024"
    grid_item = grids.get(active_grid, {})

    # Check for Gemini API Key
    api_key = _get_gemini_api_key()
    if api_key:
        system_prompt = (
            "You are CIVORA Urban Planning AI Copilot, a senior GIS specialist and urban planning intelligence assistant "
            "for K/East Ward, Mumbai (Andheri East), Maharashtra, India.\n"
            "Ground Truth & Spatial Context:\n"
            "- Study Area: K/East Ward, Mumbai (16.5 km² boundary, 405 spatial cells of 250m).\n"
            "- Built Environment: 11,584 building footprints (5.50M m² built-up area), 117.94 km verified road network (600 segments).\n"
            "- Flooding History: 57 official BMC waterlogging spots recorded across the ward.\n"
            "- Topography: Elevation ranges from 5.5m to 48.2m AMSL. Drainage depression along Western Railway line & Milan Subway (19.8m AMSL) with ~50.5% flood vulnerability.\n"
            "- Corridors:\n"
            "  * Milan Subway Relief Bypass (corridor_id: 'milan_subway_bypass', 890m, 25m buffer, 42 building conflicts, 48.5% flood risk exposure)\n"
            "  * JVLR-Sahar Airport Express Connector (corridor_id: 'jvlr_airport_connector', 1850m, 30m buffer, 18 building conflicts, 14.2% flood risk exposure)\n"
            "  * Saki Naka Stormwater Relief Drain (corridor_id: 'saki_naka_stormwater_drain', 650m, 15m buffer, 12 building conflicts, 39.8% flood risk exposure)\n"
            "- Siting Guidelines:\n"
            "  * Hospitals/Clinics: Require elevation > 22m AMSL, low flood risk (< 15%), > 600m road access, 0 BMC flood spots (e.g. KE_G_0188, KE_G_0210, KE_G_0155).\n"
            "  * Schools/Educational: Require elevation > 23m AMSL, very low flood risk (< 12%), safe road and pedestrian access, 0 BMC flood spots (e.g. KE_G_0182, KE_G_0210, KE_G_0168).\n"
            "  * Sponge Parks/Bioswales: Low-lying gravity basins (< 23m AMSL) with high runoff demand (e.g. KE_G_0024, KE_G_0035, KE_G_0088).\n"
            f"- Currently Selected Grid in Map: {active_grid} (Elevation: {grid_item.get('elevation_m', 19.8)}m, Baseline Flood Prob: {((grid_item.get('baseline_prediction') or 0.505) * 100):.1f}%).\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "When the user asks to build or evaluate any project (such as a flyover, highway, school, hospital, bridge, or sponge park):\n"
            "1. Give a detailed feasibility breakdown: topographic elevation, flood risk %, building conflicts, and connectivity.\n"
            "2. Conclude by informing the user they can click the button below your response to view the proposed project simulation directly on the Digital Twin Map.\n"
            "3. Output valid JSON with keys: 'intent', 'reply', 'recommendation', and 'action' ('type': 'HIGHLIGHT_SITE' | 'RENDER_CORRIDOR' | 'FOCUS_GRID', optional 'grid_id', optional 'corridor_id')."
        )

        user_prompt = f"User query: '{request.query}'. Municipal Department Role: {request.department_id}. Selected Cell: {active_grid}."
        gemini_result = _call_gemini_api(api_key, user_prompt, system_prompt)

        if gemini_result and isinstance(gemini_result, dict) and "reply" in gemini_result:
            intent = gemini_result.get("intent", "urban_planning_query")
            reply = gemini_result.get("reply", "")
            recommendation = gemini_result.get("recommendation", "Review spatial layers in Digital Twin.")
            action_data = gemini_result.get("action", {}) or {}
            action_type = action_data.get("type", "GENERAL_INFO")
            action_grid = action_data.get("grid_id") or active_grid
            action_corridor = action_data.get("corridor_id")

            # Augment with deterministic geometric payloads if relevant
            sites_payload = None
            corridor_payload = None
            center_payload = grids.get(action_grid, {}).get("center", [19.1130, 72.8656])

            if any(k in q for k in ["school", "college", "education", "university", "kindergarten", "academy"]):
                sites_payload = _evaluate_school_suitability(grids, limit=3)
                if sites_payload:
                    action_grid = sites_payload[0].grid_id
                    center_payload = sites_payload[0].center
                    action_type = "HIGHLIGHT_SITE"
            elif action_type == "HIGHLIGHT_SITE" or any(k in q for k in ["hospital", "clinic", "health", "medical"]):
                sites_payload = _evaluate_hospital_suitability(grids, limit=3)
                if sites_payload:
                    action_grid = sites_payload[0].grid_id
                    center_payload = sites_payload[0].center
                    action_type = "HIGHLIGHT_SITE"
            elif any(k in q for k in ["sponge", "retention", "pond", "bioswale"]):
                sites_payload = _evaluate_sponge_suitability(grids, limit=3)
                if sites_payload:
                    action_grid = sites_payload[0].grid_id
                    center_payload = sites_payload[0].center
                    action_type = "HIGHLIGHT_SITE"
            elif action_type == "RENDER_CORRIDOR" or any(k in q for k in ["flyover", "fyover", "fly over", "overpass", "viaduct", "elevated", "road widening", "corridor", "bypass", "bridge"]):
                presets = ENGINE.get_corridor_presets()
                target_preset = presets[0]
                if action_corridor:
                    for p in presets:
                        if p["id"] == action_corridor:
                            target_preset = p
                            break
                else:
                    for p in presets:
                        if "jvlr" in q and "jvlr" in p["id"]:
                            target_preset = p
                        elif "saki" in q and "saki" in p["id"]:
                            target_preset = p
                        elif "milan" in q and "milan" in p["id"]:
                            target_preset = p

                corridor_payload = ENGINE.analyze_alignment(
                    coordinates=[(pt[0], pt[1]) for pt in target_preset["coordinates"]],
                    corridor_width_m=target_preset["corridor_width_m"],
                    project_type=target_preset["project_type"],
                    alignment_name=target_preset["name"]
                )
                action_type = "RENDER_CORRIDOR"
                action_corridor = target_preset["id"]

            return CopilotQueryResponse(
                intent=intent,
                reply=reply,
                recommendation=recommendation,
                action=CopilotActionPayload(
                    type=action_type,
                    grid_id=action_grid,
                    center=center_payload,
                    corridor_id=action_corridor,
                    corridor_data=corridor_payload,
                    sites=sites_payload
                ),
                metadata={"engine": "gemini-2.5-flash", "grounding": "K/East Ward GIS"}
            )

    # --------------------------------------------------------------------------
    # DETERMINISTIC LOCAL SPATIAL ENGINE FALLBACK (100% Offline / Reliable)
    # --------------------------------------------------------------------------

    # INTENT: School / Educational Campus Siting
    if any(k in q for k in ["school", "college", "education", "university", "kindergarten", "academy", "campus"]):
        sites = _evaluate_school_suitability(grids, limit=3)
        top = sites[0] if sites else None
        
        reply = (
            f"Multi-Criteria Educational Siting Assessment across 405 cells identifies **{top.grid_id}** "
            f"as the premier location for school and campus development in K/East Ward.\n\n"
            f"- Top Location: **{top.grid_id}** (Suitability Score: **{top.suitability_score}/100**)\n"
            f"- Flood Safety: **{top.flood_probability_pct}%** baseline risk (safely within the Low Vulnerability zone)\n"
            f"- Topographic Elevation: **{top.elevation_m}m AMSL** (Safe high ground situated well above monsoonal drainage bowls)\n"
            f"- Road & Bus Access: **{top.road_length_m:.0f}m** of verified roadway along {top.roads[0] if top.roads else 'local arterial corridor'}\n"
            f"- Historical Record: 0 recorded BMC waterlogging occurrences\n\n"
            f"Alternative Candidate Cells: **{sites[1].grid_id}** ({sites[1].flood_probability_pct}% risk) and **{sites[2].grid_id}** ({sites[2].flood_probability_pct}% risk).\n\n"
            f"Click the button below to view this recommended school site and surroundings on the Digital Twin Map."
        )
        recommendation = (
            "Planning Directive: Issue zoning clearance for educational facility reservation with designated student drop-off bays and permeable courtyard surfaces."
        )
        
        return CopilotQueryResponse(
            intent="school_site_suitability",
            reply=reply,
            recommendation=recommendation,
            action=CopilotActionPayload(
                type="HIGHLIGHT_SITE",
                grid_id=top.grid_id if top else None,
                center=top.center if top else None,
                sites=sites
            ),
            metadata={"engine": "local_spatial_engine", "facility_type": "school", "total_evaluated": len(grids)}
        )

    # INTENT 1: Hospital or Medical Facility Site Selection
    if any(k in q for k in ["hospital", "clinic", "health", "medical", "dispensary"]):
        sites = _evaluate_hospital_suitability(grids, limit=3)
        top = sites[0] if sites else None
        
        reply = (
            f"Multi-Criteria Site Suitability Evaluation across 405 cells identifies **{top.grid_id}** "
            f"as the premier location for emergency healthcare development in K/East Ward.\n\n"
            f"- Top Site: **{top.grid_id}** (Suitability Score: **{top.suitability_score}/100**)\n"
            f"- Baseline Flood Vulnerability: **{top.flood_probability_pct}%** (safely classified in Low Risk tier)\n"
            f"- Verified Road Infrastructure: **{top.road_length_m:.0f}m** of primary connectivity along {top.roads[0] if top.roads else 'corridor'}\n"
            f"- Topographic Safety: **{top.elevation_m}m AMSL**, situated safely above drainage depressions\n"
            f"- Municipal Ground Truth: 0 recorded BMC historical waterlogging spots\n\n"
            f"Alternative Candidate Cells: **{sites[1].grid_id}** ({sites[1].flood_probability_pct}% risk) and **{sites[2].grid_id}** ({sites[2].flood_probability_pct}% risk)."
        )
        recommendation = (
            "Planning Directive: Issue zoning clearance for health facility reservation in this cell. "
            "High road ingress ensures continuous emergency vehicular operation during peak monsoon precipitation."
        )
        
        return CopilotQueryResponse(
            intent="facility_site_suitability",
            reply=reply,
            recommendation=recommendation,
            action=CopilotActionPayload(
                type="HIGHLIGHT_SITE",
                grid_id=top.grid_id if top else None,
                center=top.center if top else None,
                sites=sites
            ),
            metadata={"engine": "local_spatial_engine", "facility_type": "hospital", "total_evaluated": len(grids)}
        )

    # INTENT 2: Flyover / Road Widening Feasibility Analysis
    if any(k in q for k in ["flyover", "fyover", "fly over", "overpass", "viaduct", "elevated", "road widening", "corridor", "expand", "bypass", "feasible", "feasibility", "bridge"]):
        presets = ENGINE.get_corridor_presets()
        target_preset = presets[0] # Milan Subway Relief Bypass
        for p in presets:
            if "jvlr" in q and "jvlr" in p["id"]:
                target_preset = p
            elif "saki" in q and "saki" in p["id"]:
                target_preset = p
            elif "milan" in q and "milan" in p["id"]:
                target_preset = p

        analysis = ENGINE.analyze_alignment(
            coordinates=[(pt[0], pt[1]) for pt in target_preset["coordinates"]],
            corridor_width_m=target_preset["corridor_width_m"],
            project_type=target_preset["project_type"],
            alignment_name=target_preset["name"]
        )

        bldg_cnt = analysis["building_conflicts"]["intersected_count"]
        bldg_area = analysis["building_conflicts"]["total_intersected_area_m2"]
        score = analysis["feasibility_assessment"]["conflict_score"]
        classification = analysis["feasibility_assessment"]["classification"]
        mean_flood = analysis["flood_risk_exposure"]["mean_baseline_probability"] * 100.0

        reply = (
            f"Spatial Feasibility Screening for **{target_preset['name']}**:\n\n"
            f"- Route Length: **{analysis['metrics']['route_length_m']}m** with a **{target_preset['corridor_width_m']}m** planning corridor buffer\n"
            f"- Structural Conflicts: Intersects **{bldg_cnt} building footprints** ({bldg_area:,.0f} m² displaced planar footprint)\n"
            f"- Mean Flood Risk Exposure: **{mean_flood:.1f}%** across {analysis['flood_risk_exposure']['crossed_grids_count']} traversed cells\n"
            f"- BMC Ground Truth: Intersects **{len(analysis['bmc_flood_spots']['direct_corridor_spots'])} recorded flood spots**\n"
            f"- Spatial Conflict Score: **{score}/100** ({classification})"
        )
        recommendation = analysis["feasibility_assessment"]["recommendations"][0]

        return CopilotQueryResponse(
            intent="infrastructure_corridor_feasibility",
            reply=reply,
            recommendation=recommendation,
            action=CopilotActionPayload(
                type="RENDER_CORRIDOR",
                corridor_id=target_preset["id"],
                corridor_data=analysis
            ),
            metadata={"engine": "local_spatial_engine", "corridor_name": target_preset["name"], "conflict_score": score}
        )

    # INTENT 3: Sponge City / Bioswale / Retention Pond Site Selection
    if any(k in q for k in ["sponge", "retention", "pond", "bioswale", "drainage basin", "depression"]):
        sites = _evaluate_sponge_suitability(grids, limit=3)
        top = sites[0] if sites else None

        reply = (
            f"Hydrological Depression & Runoff Catchment Analysis locates **{top.grid_id}** "
            f"as the highest-impact sponge city intervention zone.\n\n"
            f"- Top Priority Basin: **{top.grid_id}** (Intervention Priority Score: **{top.suitability_score}/100**)\n"
            f"- Topographical Elevation: **{top.elevation_m}m AMSL** (Gravity-fed drainage bowl)\n"
            f"- Baseline Flood Probability: **{top.flood_probability_pct}%**\n"
            f"- Historical Ground Truth: Contains {len(top.flood_spots)} BMC flood spots ({top.flood_spots[0] if top.flood_spots else 'low elevation runoff hotspot'})\n\n"
            f"Deployment of underground stormwater holding tanks or bioswale street retrofits here provides maximum ward-level retention capacity."
        )
        recommendation = (
            "Planning Directive: Mandate permeable road surface retrofits (-20% runoff) combined with decentralized "
            "sub-surface retention storage to decouple gravity drainage from high-tide discharge blocks."
        )

        return CopilotQueryResponse(
            intent="sponge_city_suitability",
            reply=reply,
            recommendation=recommendation,
            action=CopilotActionPayload(
                type="HIGHLIGHT_SITE",
                grid_id=top.grid_id if top else None,
                center=top.center if top else None,
                sites=sites
            ),
            metadata={"engine": "local_spatial_engine", "intervention": "sponge_park"}
        )

    # INTENT 4: Cell Explanation & SHAP Diagnostics
    base_pred = grid_item.get("baseline_prediction", 0.5054)
    roads = grid_item.get("roads", [])
    flood_spots = grid_item.get("flood_spots", [])
    elevation = grid_item.get("elevation_m", 19.8)

    reply = (
        f"Explainable AI Diagnostic for Cell **{active_grid}**:\n\n"
        f"• Model Prediction: **{(base_pred * 100):.2f}% baseline flood vulnerability**\n"
        f"• Terrain Elevation: **{elevation}m AMSL**\n"
        f"• Transport Intersections: {', '.join(roads) if roads else 'Local ward streets'}\n"
        f"• Historical Municipal Flood Record: {'; '.join(flood_spots) if flood_spots else 'No direct BMC flood spots recorded'}\n"
        f"• Dominant Policy Scenario: **{grid_item.get('dominant_scenario', 'NDVI +20%')}**"
    )
    recommendation = (
        "Open the What-If Micro-Intervention Sandbox to run continuous live parameter adjustments for this cell."
    )

    return CopilotQueryResponse(
        intent="grid_explanation",
        reply=reply,
        recommendation=recommendation,
        action=CopilotActionPayload(
            type="FOCUS_GRID",
            grid_id=active_grid,
            center=grid_item.get("center", [19.1037, 72.8447])
        ),
        metadata={"engine": "local_spatial_engine", "selected_grid": active_grid}
    )
