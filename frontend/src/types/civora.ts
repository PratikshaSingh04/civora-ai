import type { FeatureCollection, Geometry } from "geojson";

export type MapLayer =
  | "scenario"
  | "baseline"
  | "ndvi"
  | "road"
  | "building"
  | "difference";

export type BasemapType = "dark" | "street" | "satellite" | "voyager";

export interface ScenarioProperties {
  id: number;
  grid_id: string;
  scenario_baseline_probability?: number;
  scenario_ndvi_plus_20_probability?: number;
  scenario_road_density_minus_20_probability?: number;
  scenario_building_density_minus_20_probability?: number;
  scenario_ndvi_change?: number;
  scenario_road_density_change?: number;
  scenario_building_density_change?: number;
  CIVORA_Scenario_Impact_All_Grids_baseline_prediction: number;
  CIVORA_Scenario_Impact_All_Grids_ndvi_prediction: number;
  CIVORA_Scenario_Impact_All_Grids_road_prediction: number;
  CIVORA_Scenario_Impact_All_Grids_building_prediction: number;
  CIVORA_Scenario_Impact_All_Grids_ndvi_change: number;
  CIVORA_Scenario_Impact_All_Grids_road_change: number;
  CIVORA_Scenario_Impact_All_Grids_building_change: number;
  CIVORA_Scenario_Impact_All_Grids_dominant_scenario: string;
  CIVORA_Scenario_Impact_All_Grids_maximum_absolute_change: number;
  CIVORA_Scenario_Impact_All_Grids_impact_magnitude: string;
}

export type ScenarioFeatureCollection = FeatureCollection<Geometry, ScenarioProperties>;

export interface GridContextItem {
  grid_id: string;
  center: [number, number];
  roads: string[];
  flood_spots: string[];
  elevation_m: number | null;
  building_density: number | null;
  building_area_m2: number | null;
  road_density: number | null;
  road_length_m: number | null;
  ndvi_mean: number | null;
  baseline_prediction: number | null;
  ndvi_prediction: number | null;
  road_prediction: number | null;
  building_prediction: number | null;
  dominant_scenario: string | null;
  impact_magnitude: string | null;
  maximum_absolute_change: number | null;
}

export type GridContextMap = Record<string, GridContextItem>;

export interface HotspotItem {
  rank: number;
  grid_id: string;
  baseline_prediction: number;
  ndvi_prediction: number;
  road_prediction: number;
  building_prediction: number;
  dominant_scenario: string;
  maximum_absolute_change: number;
  impact_magnitude: string;
  roads?: string[];
  flood_spots?: string[];
}

export interface ExplanationFeature {
  feature: string;
  value: number;
  shap_value: number;
  direction: "increases" | "decreases" | "neutral";
}

export interface ExplanationData {
  grid_id: string;
  flood_probability: number;
  features: ExplanationFeature[];
}

export interface ScenarioStats {
  mean_prediction: number;
  median_prediction: number;
  minimum_prediction: number;
  maximum_prediction: number;
  mean_change_from_baseline: number;
  percentage_change_from_baseline: number;
  grids_increased: number;
  grids_decreased: number;
  grids_unchanged: number;
  percent_grids_increased: number;
  percent_grids_decreased: number;
}

export interface CivoraSummaryData {
  project: string;
  study_area: string;
  analysis: string;
  total_grids: number;
  baseline_mean_prediction: number;
  scenario_statistics: {
    Baseline: ScenarioStats;
    "NDVI +20%": ScenarioStats;
    "Road Density -20%": ScenarioStats;
    "Building Density -20%": ScenarioStats;
  };
  dominant_scenario_by_grid: {
    "NDVI +20%": number;
    "Building Density -20%": number;
    "Road Density -20%": number;
  };
  impact_magnitude_distribution: {
    "Very Low": number;
    Low: number;
    Moderate: number;
    High: number;
    "Very High": number;
  };
}

export interface CustomSimulationResult {
  grid_id: string;
  baseline_probability: number;
  simulated_probability: number;
  delta_probability: number;
  delta_pp: number;
  relative_change_pct: number;
  interventions: {
    ndvi_delta_pct: number;
    road_density_delta_pct: number;
    building_density_delta_pct: number;
  };
  features: {
    baseline: Record<string, number>;
    simulated: Record<string, number>;
  };
  shap_explanations: ExplanationFeature[];
}

export interface ValidationBenchmarkData {
  study_area: string;
  total_grids: number;
  official_bmc_flood_spots: number;
  grids_containing_flood_spots: number;
  mean_flood_probability_in_flood_spots: number;
  mean_flood_probability_unaffected_grids: number;
  risk_concentration_ratio: number;
  top_tier_capture_rate_pct: number;
  elevation_stats: {
    mean_elevation_flood_grids_m: number;
    mean_elevation_non_flood_grids_m: number;
    elevation_unit: string;
  };
  methodology: Record<string, string>;
}

export type DepartmentRole =
  | "urban_planning"
  | "disaster_management"
  | "traffic_transport"
  | "health_sanitation"
  | "municipal_admin";

export interface DepartmentInfo {
  id: DepartmentRole;
  code: string;
  name: string;
  description: string;
  primary_focus: string;
  assigned_layers: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  department_id: DepartmentRole;
  department_name: string;
  designation: string;
  clearance_level: string;
  token: string;
}

export interface SuitableSite {
  rank: number;
  grid_id: string;
  suitability_score: number;
  flood_probability_pct: number;
  road_length_m: number;
  elevation_m: number;
  roads: string[];
  flood_spots: string[];
  justification: string;
  center: [number, number];
}

export interface CopilotActionPayload {
  type: "HIGHLIGHT_SITE" | "RENDER_CORRIDOR" | "FOCUS_GRID" | "OPEN_WHATIF" | "GENERAL_INFO";
  grid_id?: string;
  center?: [number, number];
  corridor_id?: string;
  corridor_data?: any;
  sites?: SuitableSite[];
}

export interface CopilotQueryResponse {
  intent: string;
  reply: string;
  recommendation: string;
  action: CopilotActionPayload;
  metadata: Record<string, any>;
}

export interface CorridorPreset {
  id: string;
  name: string;
  project_type: "highway" | "road_widening" | "green_corridor";
  description: string;
  coordinates: [number, number][];
  corridor_width_m: number;
}

export interface BuildingConflictItem {
  building_id: string;
  total_area_m2: number;
  intersected_area_m2: number;
}

export interface CrossGridItem {
  grid_id: string;
  baseline_probability: number;
  dominant_scenario: string;
  impact_magnitude: string;
}

export interface CorridorFeasibilityResult {
  alignment_name: string;
  project_type: string;
  corridor_width_m: number;
  metrics: {
    alignment_length_m?: number;
    route_length_m?: number;
    corridor_buffer_width_m?: number;
    total_corridor_area_m2?: number;
    corridor_area_m2?: number;
    corridor_area_ha?: number;
    inside_ward_coverage_pct?: number;
  };
  feasibility_assessment: {
    conflict_score: number;
    classification: string;
    badge_color: string;
    component_scores: {
      building_conflict: number;
      flood_exposure: number;
      historical_spots: number;
      road_disruption: number;
    };
    recommendations: string[];
  };
  building_conflicts: {
    intersected_count: number;
    total_intersected_area_m2: number;
    sample_buildings: BuildingConflictItem[];
  };
  flood_risk_exposure: {
    crossed_grids_count: number;
    mean_baseline_probability: number;
    peak_baseline_probability: number;
    peak_grid_id: string;
    high_risk_cells_count: number;
    severe_risk_cells_count: number;
    crossed_grids: CrossGridItem[];
  };
  road_conflicts: {
    intersected_segments_count?: number;
    total_intersections?: number;
    traversed_road_names?: string[];
    unique_named_roads?: string[];
    hierarchy_breakdown?: Record<string, number>;
  };
  bmc_flood_spots: {
    spot_conflicts_count: number;
    spots: any[];
  };
  geojson: {
    line: any;
    corridor_buffer: any;
  };
  limitations_disclaimer: string;
}

export interface ErAttribute {
  column: string;
  type: string;
  is_pk: boolean;
  description: string;
}

export interface ErEntity {
  id: string;
  name: string;
  table_name: string;
  category: "Governance" | "Spatial" | "Mobility" | "Environmental" | "Disaster" | "Built Environment" | "Machine Learning" | "Explainable AI" | "Simulation" | "Decision Support" | "Reporting";
  primary_key: string;
  foreign_keys: string[];
  row_count: number;
  description: string;
  attributes: ErAttribute[];
}

export interface ErRelationship {
  source: string;
  target: string;
  cardinality: string;
  synopsis_ref: string;
  description: string;
}

export interface SoftwareModuleInfo {
  id: string;
  name: string;
  purpose: string;
  technology: string;
  status: string;
  active_endpoints: string[];
}

export interface ArchitectureSchemaResponse {
  project: string;
  synopsis_chapter_4: string;
  synopsis_chapter_5: string;
  pilot_ward: string;
  entities: ErEntity[];
  relationships: ErRelationship[];
  modules: SoftwareModuleInfo[];
  stats: {
    total_entities: number;
    total_relationships: number;
    total_modules: number;
    spatial_cells_monitored: number;
    verified_building_footprints: number;
    road_segments_evaluated: number;
    ground_truth_flood_points: number;
  };
}


