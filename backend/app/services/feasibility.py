import json
from pathlib import Path
from typing import List, Dict, Any, Tuple
import numpy as np
import pyproj
from shapely.geometry import shape, LineString, Point, mapping
from shapely import transform as stransform
from shapely.strtree import STRtree

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "frontend" / "public" / "data"

# Coordinate Reference Systems
WGS84 = pyproj.CRS("EPSG:4326")
UTM43N = pyproj.CRS("EPSG:32643")
TO_UTM = pyproj.Transformer.from_crs(WGS84, UTM43N, always_xy=True)
TO_WGS = pyproj.Transformer.from_crs(UTM43N, WGS84, always_xy=True)


def _project_to_utm(coords):
    return np.column_stack(TO_UTM.transform(coords[:, 0], coords[:, 1]))


def _project_to_wgs(coords):
    return np.column_stack(TO_WGS.transform(coords[:, 0], coords[:, 1]))


class FeasibilityEngine:
    def __init__(self):
        self.initialized = False
        self.buildings_data = None
        self.building_geoms = []
        self.building_tree = None

        self.roads_data = None
        self.road_geoms = []
        self.road_tree = None

        self.grids_data = None
        self.grid_geoms = []
        self.grid_tree = None

        self.flood_spots = []
        self.boundary_geom = None

    def initialize(self):
        if self.initialized:
            return

        # 1. Load Building Footprints (11,584 footprints)
        bldgs_path = DATA_DIR / "K_East_Buildings_WGS84.geojson"
        if bldgs_path.exists():
            with open(bldgs_path, "r", encoding="utf-8") as f:
                self.buildings_data = json.load(f)
            self.building_geoms = [
                shape(feat["geometry"]) for feat in self.buildings_data["features"]
            ]
            self.building_tree = STRtree(self.building_geoms)

        # 2. Load Road Network (600 road segments)
        roads_path = DATA_DIR / "K_East_Roads_WGS84.geojson"
        if roads_path.exists():
            with open(roads_path, "r", encoding="utf-8") as f:
                self.roads_data = json.load(f)
            self.road_geoms = [
                shape(feat["geometry"]) for feat in self.roads_data["features"]
            ]
            self.road_tree = STRtree(self.road_geoms)

        # 3. Load 405 Scenario Grid Cells
        grids_path = DATA_DIR / "K_East_CIVORA_Scenario_Decision_WGS84.geojson"
        if grids_path.exists():
            with open(grids_path, "r", encoding="utf-8") as f:
                self.grids_data = json.load(f)
            self.grid_geoms = [
                shape(feat["geometry"]) for feat in self.grids_data["features"]
            ]
            self.grid_tree = STRtree(self.grid_geoms)

        # 4. Load 57 Official BMC Flooding Spots
        spots_path = DATA_DIR / "K_East_Flooding_Spots_WGS84.geojson"
        if spots_path.exists():
            with open(spots_path, "r", encoding="utf-8") as f:
                spots_json = json.load(f)
            self.flood_spots = []
            for feat in spots_json["features"]:
                pt = shape(feat["geometry"]).centroid
                pt_utm = stransform(pt, _project_to_utm)
                self.flood_spots.append({
                    "name": feat["properties"].get("name", "BMC Flood Spot"),
                    "depth": feat["properties"].get("depth", "Recorded waterlogging"),
                    "location": feat["properties"].get("location", ""),
                    "point_wgs": pt,
                    "point_utm": pt_utm,
                    "coords": [pt.y, pt.x]  # [lat, lon]
                })

        # 5. Load K/East Boundary
        boundary_path = DATA_DIR / "K_East_Boundary_WGS84.geojson"
        if boundary_path.exists():
            with open(boundary_path, "r", encoding="utf-8") as f:
                boundary_json = json.load(f)
            self.boundary_geom = shape(boundary_json["features"][0]["geometry"])

        self.initialized = True

    def analyze_alignment(
        self,
        coordinates: List[Tuple[float, float]],
        corridor_width_m: float = 30.0,
        project_type: str = "highway",
        alignment_name: str = "Proposed Alignment A"
    ) -> Dict[str, Any]:
        """
        Executes deterministic GIS corridor analysis:
        - Route length in planar UTM 43N meters
        - Corridor buffer geometry
        - Unique building footprint intersections and area (m²)
        - Road network crossings & highway hierarchy
        - 405-grid flood risk exposure (mean & peak probability)
        - Proximity to verified BMC waterlogging points
        - Evidence-based feasibility classification
        """
        self.initialize()

        if len(coordinates) < 2:
            raise ValueError("At least 2 coordinate points required for alignment.")

        # Construct LineString in WGS84: coordinates are [(lon, lat), ...]
        line_wgs = LineString(coordinates)
        line_utm = stransform(line_wgs, _project_to_utm)
        route_length_m = float(line_utm.length)

        # Buffer corridor in UTM (half-width each side)
        half_width = max(5.0, float(corridor_width_m) / 2.0)
        corridor_utm = line_utm.buffer(half_width)
        corridor_area_m2 = float(corridor_utm.area)
        corridor_area_ha = corridor_area_m2 / 10000.0

        corridor_wgs = stransform(corridor_utm, _project_to_wgs)

        # 1. Boundary coverage check
        inside_coverage_pct = 100.0
        if self.boundary_geom:
            clipped_line = line_wgs.intersection(self.boundary_geom)
            inside_length_m = (
                float(stransform(clipped_line, _project_to_utm).length)
                if not clipped_line.is_empty else 0.0
            )
            inside_coverage_pct = round((inside_length_m / route_length_m) * 100.0, 1)

        # 2. Building Footprint Conflicts
        intersected_bldgs = []
        total_bldg_area_m2 = 0.0

        if self.building_tree and self.buildings_data:
            hits = self.building_tree.query(corridor_wgs, predicate="intersects")
            for idx in hits:
                bldg_feat = self.buildings_data["features"][idx]
                props = bldg_feat.get("properties", {})
                bldg_geom = self.building_geoms[idx]

                # Calculate actual intersected area in UTM
                intersection_wgs = bldg_geom.intersection(corridor_wgs)
                inter_utm = stransform(intersection_wgs, _project_to_utm)
                inter_area = float(inter_utm.area)

                total_bldg_area_m2 += inter_area
                intersected_bldgs.append({
                    "building_id": props.get("building_id", idx),
                    "total_area_m2": round(props.get("area_m2", 0), 1),
                    "intersected_area_m2": round(inter_area, 1),
                })

        # 3. Road Network Conflicts & Crossings
        crossed_roads = []
        unique_road_names = set()
        road_hierarchy_counts = {}

        if self.road_tree and self.roads_data:
            road_hits = self.road_tree.query(line_wgs, predicate="intersects")
            for idx in road_hits:
                feat = self.roads_data["features"][idx]
                props = feat.get("properties", {})
                name = props.get("name", "Unnamed Road")
                hw_type = props.get("highway", "local")

                if name and name != "Unnamed Road":
                    unique_road_names.add(name)

                road_hierarchy_counts[hw_type] = road_hierarchy_counts.get(hw_type, 0) + 1
                crossed_roads.append({
                    "name": name,
                    "highway": hw_type,
                    "osm_id": props.get("osm_id", idx)
                })

        # 4. Flood Risk Exposure across 405 Grid Cells
        crossed_grids = []
        flood_probs = []

        if self.grid_tree and self.grids_data:
            grid_hits = self.grid_tree.query(corridor_wgs, predicate="intersects")
            for idx in grid_hits:
                feat = self.grids_data["features"][idx]
                props = feat.get("properties", {})
                gid = props.get("grid_id", f"GRID_{idx}")
                prob = props.get("scenario_baseline_probability",
                       props.get("CIVORA_Scenario_Impact_All_Grids_baseline_prediction", 0.0))
                prob = float(prob) if prob is not None else 0.0

                flood_probs.append(prob)
                crossed_grids.append({
                    "grid_id": gid,
                    "baseline_probability": round(prob, 4),
                    "dominant_scenario": props.get("CIVORA_Scenario_Impact_All_Grids_dominant_scenario", "NDVI +20%"),
                    "impact_magnitude": props.get("CIVORA_Scenario_Impact_All_Grids_impact_magnitude", "Moderate")
                })

        mean_flood_prob = float(np.mean(flood_probs)) if flood_probs else 0.0
        peak_flood_prob = float(np.max(flood_probs)) if flood_probs else 0.0
        peak_grid_id = ""
        if crossed_grids:
            peak_grid = max(crossed_grids, key=lambda x: x["baseline_probability"])
            peak_grid_id = peak_grid["grid_id"]

        high_risk_cells = sum(1 for p in flood_probs if p >= 0.20)
        severe_risk_cells = sum(1 for p in flood_probs if p >= 0.40)

        # 5. Nearby Verified BMC Historical Waterlogging Spots
        nearby_spots = []
        direct_spots = []

        for spot in self.flood_spots:
            dist_m = float(line_utm.distance(spot["point_utm"]))
            if dist_m <= half_width:
                direct_spots.append({
                    "name": spot["name"],
                    "distance_m": round(dist_m, 1),
                    "depth": spot["depth"],
                    "location": spot["location"],
                    "coords": spot["coords"]
                })
            elif dist_m <= 150.0:
                nearby_spots.append({
                    "name": spot["name"],
                    "distance_m": round(dist_m, 1),
                    "depth": spot["depth"],
                    "location": spot["location"],
                    "coords": spot["coords"]
                })

        # 6. Preliminary Feasibility Classification & Multi-Dimensional Scoring
        # Scoring scale 0 (best) to 100 (severe conflict)
        bldg_score = min(40, len(intersected_bldgs) * 1.5 + (total_bldg_area_m2 / 1000.0) * 2.0)
        flood_score = min(30, mean_flood_prob * 40.0 + severe_risk_cells * 4.0)
        spot_score = min(20, len(direct_spots) * 8.0 + len(nearby_spots) * 2.0)
        road_score = min(10, len(unique_road_names) * 1.2)

        conflict_score = round(bldg_score + flood_score + spot_score + road_score, 1)

        if conflict_score < 30.0:
            classification = "Lower Apparent Spatial Conflict"
            badge_color = "#10b981"
        elif conflict_score < 60.0:
            classification = "Moderate Apparent Spatial Conflict"
            badge_color = "#f59e0b"
        else:
            classification = "Higher Apparent Spatial Conflict"
            badge_color = "#ef4444"

        # Key recommendations
        recommendations = []
        if len(intersected_bldgs) > 15:
            recommendations.append(
                f"High building footprint density ({len(intersected_bldgs)} structures). Consider alignment shift or elevated viaduct design to minimize structural displacement."
            )
        if severe_risk_cells > 0 or len(direct_spots) > 0:
            recommendations.append(
                f"Traverses {severe_risk_cells} severe flood cells and {len(direct_spots)} BMC flood spots. Mandatory box-culvert stormwater conduits and elevated road grades required."
            )
        if len(unique_road_names) > 3:
            recommendations.append(
                f"Intersects {len(unique_road_names)} existing road corridors including {list(unique_road_names)[:2]}. Grade-separated junctions required to prevent traffic bottlenecks."
            )
        if not recommendations:
            recommendations.append("Alignment shows minimal spatial conflicts with existing structures and waterways.")

        return {
            "alignment_name": alignment_name,
            "project_type": project_type,
            "corridor_width_m": corridor_width_m,
            "metrics": {
                "route_length_m": round(route_length_m, 1),
                "alignment_length_m": round(route_length_m, 1),
                "corridor_buffer_width_m": corridor_width_m,
                "corridor_area_m2": round(corridor_area_m2, 1),
                "total_corridor_area_m2": round(corridor_area_m2, 1),
                "corridor_area_ha": round(corridor_area_ha, 2),
                "inside_ward_coverage_pct": inside_coverage_pct,
            },
            "building_conflicts": {
                "intersected_count": len(intersected_bldgs),
                "total_intersected_area_m2": round(total_bldg_area_m2, 1),
                "sample_buildings": intersected_bldgs[:8],
            },
            "road_conflicts": {
                "total_intersections": len(crossed_roads),
                "intersected_segments_count": len(crossed_roads),
                "unique_named_roads": sorted(list(unique_road_names)),
                "traversed_road_names": sorted(list(unique_road_names)),
                "hierarchy_breakdown": road_hierarchy_counts,
            },
            "flood_risk_exposure": {
                "crossed_grids_count": len(crossed_grids),
                "mean_baseline_probability": round(mean_flood_prob, 4),
                "peak_baseline_probability": round(peak_flood_prob, 4),
                "peak_grid_id": peak_grid_id,
                "high_risk_cells_count": high_risk_cells,
                "severe_risk_cells_count": severe_risk_cells,
                "crossed_grids": crossed_grids,
            },
            "bmc_flood_spots": {
                "direct_corridor_spots": direct_spots,
                "nearby_spots_within_150m": nearby_spots,
            },
            "feasibility_assessment": {
                "classification": classification,
                "conflict_score": conflict_score,
                "badge_color": badge_color,
                "component_scores": {
                    "building_conflict": round(bldg_score, 1),
                    "flood_exposure": round(flood_score, 1),
                    "historical_spots": round(spot_score, 1),
                    "road_disruption": round(road_score, 1),
                },
                "recommendations": recommendations,
            },
            "geojson": {
                "line": mapping(line_wgs),
                "corridor_buffer": mapping(corridor_wgs),
            },
            "limitations_disclaimer": (
                "Preliminary GIS spatial screening based on 2D footprint intersection and XGBoost model outputs. "
                "Does not constitute statutory planning approval, demolition notice, or structural engineering clearance."
            ),
        }

    def get_corridor_presets(self) -> List[Dict[str, Any]]:
        """Returns verified landmark corridor presets in K/East Ward."""
        return [
            {
                "id": "milan_subway_relief",
                "name": "Milan Subway In Nala Flood Relief Bypass",
                "project_type": "highway",
                "description": "Bypass corridor designed to alleviate recurring severe waterlogging at Milan Subway underpass.",
                "coordinates": [
                    [72.8442, 19.1028],
                    [72.8510, 19.1065],
                    [72.8575, 19.1102]
                ],
                "corridor_width_m": 25.0
            },
            {
                "id": "jvlr_airport_connector",
                "name": "JVLR - Airport Cargo Terminal Link",
                "project_type": "highway",
                "description": "East-west arterial link connecting Jogeshwari-Vikhroli Link Road with northern airport perimeter.",
                "coordinates": [
                    [72.8620, 19.1280],
                    [72.8680, 19.1235],
                    [72.8750, 19.1170]
                ],
                "corridor_width_m": 35.0
            },
            {
                "id": "saki_naka_sponge_corridor",
                "name": "Saki Naka - Marol Permeable Green Corridor",
                "project_type": "green_corridor",
                "description": "Multi-modal sponge transit corridor retrofitting high-density junctions with bioswales and permeable road pavers.",
                "coordinates": [
                    [72.8800, 19.1080],
                    [72.8825, 19.1140],
                    [72.8850, 19.1210]
                ],
                "corridor_width_m": 20.0
            }
        ]


# Singleton instance
ENGINE = FeasibilityEngine()

