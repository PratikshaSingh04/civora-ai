import { useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Layer } from "leaflet";
import type {
  ScenarioProperties,
  ScenarioFeatureCollection,
  MapLayer,
  BasemapType,
  GridContextMap,
  SuitableSite,
} from "../types/civora";
import Civora3DDigitalTwin from "./Civora3DDigitalTwin";
import "leaflet/dist/leaflet.css";

/* =========================================================
   BASEMAP URLS & ATTRIBUTIONS (100% Free & Watermark-Free)
   ========================================================= */
interface BasemapConfig {
  name: string;
  url: string;
  referenceUrl?: string;
  attribution: string;
}

const BASEMAPS: Record<BasemapType, BasemapConfig> = {
  dark: {
    name: "Dark Canvas",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    referenceUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, OpenStreetMap contributors",
  },
  street: {
    name: "Street Map",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    name: "Satellite",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  voyager: {
    name: "Light Canvas",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    referenceUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, OpenStreetMap contributors",
  },
};

const K_EAST_CENTER: [number, number] = [19.113038, 72.865632];
const K_EAST_BOUNDS = L.latLngBounds([19.0785, 72.8428], [19.1441, 72.8884]);

/* =========================================================
   MAP CONTROLLER COMPONENT
   ========================================================= */
interface MapControllerProps {
  selectedGridId: string;
  gridData: ScenarioFeatureCollection | null;
  triggerFitBounds: number;
  triggerResetView: number;
  activeCorridorData?: any;
  highlightedSite?: SuitableSite | null;
}

function MapController({
  selectedGridId,
  gridData,
  triggerFitBounds,
  triggerResetView,
  activeCorridorData,
  highlightedSite,
}: MapControllerProps) {
  const map = useMap();

  // Reset view to K/East center
  useEffect(() => {
    if (triggerResetView > 0) {
      map.setView(K_EAST_CENTER, 13, { animate: true });
    }
  }, [triggerResetView, map]);

  // Fit bounds to full K/East Ward
  useEffect(() => {
    if (triggerFitBounds > 0 && gridData) {
      const layer = L.geoJSON(gridData);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], animate: true });
      }
    }
  }, [triggerFitBounds, gridData, map]);

  // Pan and zoom to selected grid cell
  useEffect(() => {
    if (!selectedGridId || !gridData) return;

    const feature = gridData.features.find(
      (f) => f.properties?.grid_id === selectedGridId
    );
    if (!feature) return;

    const tempLayer = L.geoJSON(feature);
    const bounds = tempLayer.getBounds();
    if (bounds.isValid()) {
      map.flyToBounds(bounds, {
        padding: [100, 100],
        maxZoom: 15,
        duration: 0.8,
      });
    }
  }, [selectedGridId, gridData, map]);

  // Fit view to active infrastructure corridor alignment if present
  useEffect(() => {
    if (!activeCorridorData) return;
    const geo = activeCorridorData.geojson?.corridor_buffer || activeCorridorData.geojson?.line;
    if (geo) {
      try {
        const layer = L.geoJSON(geo);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 16, duration: 1.0 });
        }
      } catch {
        // ignore
      }
    }
  }, [activeCorridorData, map]);

  // Pan and zoom to highlighted facility site if selected
  useEffect(() => {
    if (!highlightedSite?.center) return;
    map.flyTo(highlightedSite.center, 15, { duration: 1.0 });
  }, [highlightedSite, map]);

  return null;
}

/* =========================================================
   CIVORA DIGITAL TWIN MAP
   ========================================================= */
interface CivoraMapProps {
  activeLayer: MapLayer;
  selectedGridId: string;
  selectedScenario: string;
  onGridSelect?: (gridId: string) => void;
  gridContextMap?: GridContextMap | null;
  highlightedSite?: SuitableSite | null;
  activeCorridorData?: any;
  onClearCorridor?: () => void;
  onClearSite?: () => void;
  viewDimension?: "2d" | "3d";
  onDimensionChange?: (dim: "2d" | "3d") => void;
}

export default function CivoraMap({
  activeLayer,
  selectedGridId,
  selectedScenario,
  onGridSelect,
  gridContextMap,
  highlightedSite,
  activeCorridorData,
  onClearCorridor,
  onClearSite,
  viewDimension: externalDimension,
  onDimensionChange,
}: CivoraMapProps) {
  // Layer data states
  const [gridData, setGridData] = useState<ScenarioFeatureCollection | null>(null);
  const [boundaryData, setBoundaryData] = useState<FeatureCollection | null>(null);
  const [roadsData, setRoadsData] = useState<FeatureCollection | null>(null);
  const [floodSpotsData, setFloodSpotsData] = useState<FeatureCollection | null>(null);
  const [buildingsData, setBuildingsData] = useState<FeatureCollection | null>(null);

  // Map dimension & view state
  const [internalDimension, setInternalDimension] = useState<"2d" | "3d">("2d");
  const currentDimension = externalDimension ?? internalDimension;
  const setDimension = useCallback(
    (dim: "2d" | "3d") => {
      setInternalDimension(dim);
      onDimensionChange?.(dim);
    },
    [onDimensionChange]
  );

  const [basemap, setBasemap] = useState<BasemapType>("dark");
  const [basemap3D, setBasemap3D] = useState<"dark" | "satellite">("dark");
  const [showBoundary, setShowBoundary] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showFloodSpots, setShowFloodSpots] = useState(true);
  const [showBuildings, setShowBuildings] = useState(false);
  const [loadingBuildings, setLoadingBuildings] = useState(false);

  // Search and view triggers
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [triggerFitBounds, setTriggerFitBounds] = useState(0);
  const [triggerResetView, setTriggerResetView] = useState(0);
  const [error, setError] = useState<string>("");

  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  /* Load Grid GeoJSON */
  useEffect(() => {
    fetch("/data/K_East_CIVORA_Scenario_Decision_WGS84.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load scenario decision GeoJSON");
        return res.json();
      })
      .then((json: ScenarioFeatureCollection) => setGridData(json))
      .catch((err) => {
        console.error("CIVORA grid load error:", err);
        setError("Unable to load CIVORA 405-grid spatial data.");
      });
  }, []);

  /* Load K/East Boundary */
  useEffect(() => {
    fetch("/data/K_East_Boundary_WGS84.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setBoundaryData(json);
      })
      .catch((err) => console.warn("Boundary load warning:", err));
  }, []);

  /* Load Verified Road Network */
  useEffect(() => {
    fetch("/data/K_East_Roads_WGS84.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setRoadsData(json);
      })
      .catch((err) => console.warn("Roads load warning:", err));
  }, []);

  /* Load Official BMC Flooding Spots */
  useEffect(() => {
    fetch("/data/K_East_Flooding_Spots_WGS84.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setFloodSpotsData(json);
      })
      .catch((err) => console.warn("Flood spots load warning:", err));
  }, []);

  /* Lazy Load Buildings when user toggles on */
  const handleToggleBuildings = useCallback(() => {
    if (!showBuildings && !buildingsData && !loadingBuildings) {
      setLoadingBuildings(true);
      fetch("/data/K_East_Buildings_WGS84.geojson")
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          setBuildingsData(json);
          setShowBuildings(true);
        })
        .catch((err) => {
          console.warn("Buildings load warning:", err);
        })
        .finally(() => setLoadingBuildings(false));
    } else {
      setShowBuildings((prev) => !prev);
    }
  }, [showBuildings, buildingsData, loadingBuildings]);

  /* Handle Grid Search Submit */
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");
    const formatted = searchQuery.trim().toUpperCase();

    // Check if query matches a grid ID directly
    const validGrid = gridData?.features.find(
      (f) => f.properties?.grid_id.toUpperCase() === formatted
    );

    if (validGrid) {
      onGridSelect?.(validGrid.properties.grid_id);
      setSearchQuery("");
      return;
    }

    // Check if query matches a verified road or flood spot name
    if (gridContextMap) {
      const matched = Object.values(gridContextMap).find(
        (item) =>
          item.roads.some((r) => r.toUpperCase().includes(formatted)) ||
          item.flood_spots.some((s) => s.toUpperCase().includes(formatted))
      );
      if (matched) {
        onGridSelect?.(matched.grid_id);
        setSearchQuery("");
        return;
      }
    }

    setSearchError(`'${searchQuery}' not found in K/East Ward grids or landmarks.`);
  };

  /* Get Style for Grid Cells */
  const getFeatureStyle = useCallback(
    (feature: Feature<Geometry, ScenarioProperties> | undefined) => {
      const props = feature?.properties as ScenarioProperties;
      const isSelected = props?.grid_id === selectedGridId;

      let fillColor = "#475569";

      if (activeLayer === "scenario") {
        const dominant = props?.CIVORA_Scenario_Impact_All_Grids_dominant_scenario;
        if (dominant === "NDVI +20%") fillColor = "#10b981"; // Emerald
        else if (dominant === "Road Density -20%") fillColor = "#f59e0b"; // Amber
        else if (dominant === "Building Density -20%") fillColor = "#ef4444"; // Red
      } else if (activeLayer === "baseline") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_baseline_prediction ?? 0;
        if (val < 0.10) fillColor = "#10b981";
        else if (val < 0.20) fillColor = "#06b6d4";
        else if (val < 0.40) fillColor = "#f59e0b";
        else fillColor = "#ef4444";
      } else if (activeLayer === "ndvi") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_ndvi_change ?? 0;
        if (val < -0.05) fillColor = "#1d4ed8";
        else if (val < 0) fillColor = "#38bdf8";
        else if (val < 0.05) fillColor = "#facc15";
        else fillColor = "#ef4444";
      } else if (activeLayer === "road") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_road_change ?? 0;
        if (val < -0.05) fillColor = "#1d4ed8";
        else if (val < 0) fillColor = "#38bdf8";
        else if (val < 0.05) fillColor = "#facc15";
        else fillColor = "#ef4444";
      } else if (activeLayer === "building") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_building_change ?? 0;
        if (val < -0.05) fillColor = "#1d4ed8";
        else if (val < 0) fillColor = "#38bdf8";
        else if (val < 0.05) fillColor = "#facc15";
        else fillColor = "#ef4444";
      } else if (activeLayer === "difference") {
        let diff = 0;
        if (selectedScenario === "NDVI +20%") {
          diff = props?.CIVORA_Scenario_Impact_All_Grids_ndvi_change ?? 0;
        } else if (selectedScenario === "Road Density -20%") {
          diff = props?.CIVORA_Scenario_Impact_All_Grids_road_change ?? 0;
        } else if (selectedScenario === "Building Density -20%") {
          diff = props?.CIVORA_Scenario_Impact_All_Grids_building_change ?? 0;
        }
        if (diff < -0.03) fillColor = "#1d4ed8";
        else if (diff < 0) fillColor = "#38bdf8";
        else if (diff === 0) fillColor = "#64748b";
        else if (diff < 0.03) fillColor = "#fbbf24";
        else fillColor = "#ef4444";
      }

      if (isSelected) {
        return {
          color: "#00f0ff",
          weight: 3.5,
          opacity: 1,
          fillColor: fillColor,
          fillOpacity: 0.85,
          dashArray: undefined,
        };
      }

      return {
        color: "#1e293b",
        weight: 1,
        opacity: 0.7,
        fillColor: fillColor,
        fillOpacity: 0.55,
      };
    },
    [activeLayer, selectedGridId, selectedScenario]
  );

  /* Layer Binding & Tooltips */
  const onEachGridFeature = useCallback(
    (feature: Feature<Geometry, ScenarioProperties>, layer: Layer) => {
      const props = feature.properties as ScenarioProperties;
      const gridId = props.grid_id;
      const ctx = gridContextMap?.[gridId];

      layer.on({
        click: () => onGridSelect?.(gridId),
        mouseover: (e) => {
          const target = e.target;
          if (props.grid_id !== selectedGridId) {
            target.setStyle({ weight: 2.5, color: "#94a3b8", fillOpacity: 0.75 });
          }
        },
        mouseout: (e) => {
          const target = e.target;
          if (props.grid_id !== selectedGridId) {
            target.setStyle(getFeatureStyle(feature));
          }
        },
      });

      // Construct verified tooltip text
      const baselineRisk = (
        (props.CIVORA_Scenario_Impact_All_Grids_baseline_prediction ?? 0) * 100
      ).toFixed(1);
      const roadText = ctx?.roads && ctx.roads.length > 0 ? ctx.roads[0] : "";
      const floodAlert = ctx?.flood_spots && ctx.flood_spots.length > 0 ? "Recorded Waterlogging Spot" : "";

      layer.bindTooltip(
        `
        <div class="map-grid-tooltip">
          <strong>${gridId}</strong>
          ${roadText ? `<small class="tooltip-road">Corridor: ${roadText}</small>` : ""}
          ${floodAlert ? `<small class="tooltip-alert">${floodAlert}</small>` : ""}
          <div class="tooltip-metric">Baseline Risk: <span>${baselineRisk}%</span></div>
          <div class="tooltip-hint">Click to inspect cell</div>
        </div>
        `,
        { sticky: true, className: "civora-leaflet-tooltip" }
      );
    },
    [onGridSelect, selectedGridId, gridContextMap, getFeatureStyle]
  );

  if (error) {
    return <div className="civora-map-error">{error}</div>;
  }

  if (!gridData) {
    return (
      <div className="civora-map-loading">
        <div className="loading-spinner"></div>
        <span>Loading CIVORA Digital Twin GIS Data...</span>
      </div>
    );
  }

  return (
    <div className="civora-map-wrapper">
      {/* Top Map Action Toolbar */}
      <div className="map-toolbar">
        {/* Search Input */}
        <form className="map-search-form" onSubmit={handleSearchSubmit}>
          <span className="search-icon">Search:</span>
          <input
            type="text"
            placeholder="Search Grid (e.g. KE_G_0024) or Road..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-submit-btn">
            Go
          </button>
        </form>

        {/* View Actions */}
        <div className="map-view-actions">
          <button
            type="button"
            className="map-action-chip"
            onClick={() => setTriggerFitBounds((prev) => prev + 1)}
            title="Fit to K/East Ward boundary"
          >
            ⛶ Fit Ward
          </button>
          <button
            type="button"
            className="map-action-chip"
            onClick={() => setTriggerResetView((prev) => prev + 1)}
            title="Reset map view to center"
          >
            ↺ Reset
          </button>
        </div>

        {/* 2D / 3D Dimension Switcher */}
        <div className="dimension-switcher">
          <button
            type="button"
            className={`dim-pill ${currentDimension === "2d" ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDimension("2d");
            }}
            title="Switch to 2D Cartographic GIS Map"
          >
            🗺️ 2D Map
          </button>
          <button
            type="button"
            className={`dim-pill ${currentDimension === "3d" ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!buildingsData) {
                handleToggleBuildings();
              }
              setDimension("3d");
            }}
            title="Switch to 3D Digital Twin with 11,584 Extruded Buildings"
          >
            🌐 3D Digital Twin
          </button>
        </div>

        {/* Basemap Switcher */}
        {currentDimension === "3d" ? (
          <div className="map-basemap-selector">
            <button
              type="button"
              className={`basemap-pill ${basemap3D === "dark" ? "active" : ""}`}
              onClick={() => setBasemap3D("dark")}
              title="Clean Dark Architecture 3D Basemap"
            >
              🌃 Dark 3D
            </button>
            <button
              type="button"
              className={`basemap-pill ${basemap3D === "satellite" ? "active" : ""}`}
              onClick={() => setBasemap3D("satellite")}
              title="Photorealistic Satellite 3D Basemap"
            >
              🛰️ Satellite 3D
            </button>
          </div>
        ) : (
          <div className="map-basemap-selector">
            {(["dark", "street", "satellite", "voyager"] as BasemapType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`basemap-pill ${basemap === type ? "active" : ""}`}
                onClick={() => setBasemap(type)}
              >
                {BASEMAPS[type].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {currentDimension === "3d" ? (
        <div
          className="civora-3d-wrapper-host"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
          }}
        >
          <Civora3DDigitalTwin
            activeLayer={activeLayer}
            selectedGridId={selectedGridId}
            selectedScenario={selectedScenario}
            onGridSelect={onGridSelect}
            gridData={gridData}
            boundaryData={boundaryData}
            roadsData={roadsData}
            floodSpotsData={floodSpotsData}
            buildingsData={buildingsData}
            gridContextMap={gridContextMap}
            highlightedSite={highlightedSite}
            activeCorridorData={activeCorridorData}
            onClearCorridor={onClearCorridor}
            onClearSite={onClearSite}
            onSwitchTo2D={() => setDimension("2d")}
            basemap3D={basemap3D}
            onBasemap3DChange={setBasemap3D}
            triggerFitBounds={triggerFitBounds}
            triggerResetView={triggerResetView}
          />
        </div>
      ) : (
        <>
          {searchError && <div className="map-search-warning">{searchError}</div>}

      {/* Layer Visibility Toggles */}
      <div className="map-layer-toggles">
        <label className={`toggle-chip ${showBoundary ? "active" : ""}`}>
          <input
            type="checkbox"
            checked={showBoundary}
            onChange={(e) => setShowBoundary(e.target.checked)}
          />
          <span>Ward Boundary</span>
        </label>

        <label className={`toggle-chip ${showRoads ? "active" : ""}`}>
          <input
            type="checkbox"
            checked={showRoads}
            onChange={(e) => setShowRoads(e.target.checked)}
          />
          <span>Road Network</span>
        </label>

        <label className={`toggle-chip ${showFloodSpots ? "active" : ""}`}>
          <input
            type="checkbox"
            checked={showFloodSpots}
            onChange={(e) => setShowFloodSpots(e.target.checked)}
          />
          <span>BMC Flood Spots</span>
        </label>

        <label className={`toggle-chip ${showBuildings ? "active" : ""}`}>
          <input
            type="checkbox"
            checked={showBuildings}
            disabled={loadingBuildings}
            onChange={handleToggleBuildings}
          />
          <span>{loadingBuildings ? "Loading Buildings..." : "Building Footprints"}</span>
        </label>
      </div>

      {/* Leaflet Map Container */}
      <MapContainer
        className="civora-map"
        center={K_EAST_CENTER}
        zoom={13}
        minZoom={11}
        maxZoom={18}
        scrollWheelZoom={true}
        maxBounds={K_EAST_BOUNDS.pad(0.3)}
      >
        {/* Base Map Tile Layer */}
        <TileLayer
          key={`base-${basemap}-${BASEMAPS[basemap].url}`}
          attribution={BASEMAPS[basemap].attribution}
          url={BASEMAPS[basemap].url}
        />

        {/* Optional Reference Labels Layer (for Esri Canvas) */}
        {BASEMAPS[basemap].referenceUrl && (
          <TileLayer
            key={`ref-${basemap}-${BASEMAPS[basemap].referenceUrl}`}
            attribution=""
            url={BASEMAPS[basemap].referenceUrl!}
          />
        )}

        {/* Map View & Camera Controller */}
        <MapController
          selectedGridId={selectedGridId}
          gridData={gridData}
          triggerFitBounds={triggerFitBounds}
          triggerResetView={triggerResetView}
          activeCorridorData={activeCorridorData}
          highlightedSite={highlightedSite}
        />

        {/* K/East Administrative Boundary Layer */}
        {showBoundary && boundaryData && (
          <GeoJSON
            key="boundary-layer"
            data={boundaryData}
            style={{
              color: "#00f0ff",
              weight: 2.2,
              opacity: 0.9,
              fillColor: "transparent",
              dashArray: "6, 4",
            }}
          />
        )}

        {/* Building Footprints Layer (Optional / Heavy) */}
        {showBuildings && buildingsData && (
          <GeoJSON
            key="buildings-layer"
            data={buildingsData}
            style={{
              color: "#334155",
              weight: 0.6,
              opacity: 0.8,
              fillColor: "#475569",
              fillOpacity: 0.35,
            }}
            onEachFeature={(feature, layer) => {
              const bldgId = feature.properties?.building_id;
              const area = feature.properties?.area_m2;
              layer.bindTooltip(
                `<div class="map-popup-text"><strong>Building ${bldgId}</strong><br/>Footprint Area: ${area} m²</div>`
              );
            }}
          />
        )}

        {/* Verified Road Network Layer */}
        {showRoads && roadsData && (
          <GeoJSON
            key="roads-layer"
            data={roadsData}
            style={(feature) => {
              const highway = feature?.properties?.highway;
              const isMajor = highway === "primary" || highway === "secondary";
              return {
                color: isMajor ? "#38bdf8" : "#64748b",
                weight: isMajor ? 2.5 : 1.2,
                opacity: 0.75,
              };
            }}
            onEachFeature={(feature, layer) => {
              const name = feature.properties?.name;
              const highway = feature.properties?.highway;
              if (name && name !== "Unnamed Road") {
                layer.bindTooltip(
                  `<div class="map-popup-text"><strong>${name}</strong><br/><small>Class: ${highway}</small></div>`,
                  { sticky: true }
                );
              }
            }}
          />
        )}

        {/* The 405 Scenario Grid Cells */}
        <GeoJSON
          key={`grid-layer-${activeLayer}-${selectedScenario}`}
          ref={geoJsonLayerRef}
          data={gridData}
          style={getFeatureStyle}
          onEachFeature={onEachGridFeature}
        />

        {/* Verified BMC Historical Flooding Spots */}
        {showFloodSpots &&
          floodSpotsData &&
          floodSpotsData.features.map((feature, index) => {
            const props = feature.properties as {
              centroid?: [number, number];
              fid?: number;
              name?: string;
              location?: string;
              depth?: string;
            } | null;
            const centroid = props?.centroid;
            if (!centroid) return null;
            const fid = props?.fid ?? index;
            const name = props?.name ?? "Flood Spot";
            const location = props?.location;
            const depth = props?.depth ?? "Recorded waterlogging";

            return (
              <CircleMarker
                key={`flood-spot-${fid}`}
                center={[centroid[0], centroid[1]]}
                radius={6}
                pathOptions={{
                  color: "#ffffff",
                  weight: 1.5,
                  fillColor: "#ef4444",
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div className="flood-spot-popup">
                    <span className="flood-spot-tag">BMC Historical Waterlogging Spot</span>
                    <h4>{name}</h4>
                    {location && <p className="spot-loc">{location}</p>}
                    <div className="spot-depth">
                      <span>Waterlogging Level:</span>
                      <strong>{depth}</strong>
                    </div>
                  </div>
                </Popup>
                <Tooltip direction="top">
                  <div>
                    <strong>[Spot] {name}</strong>
                    <br />
                    <small>{depth}</small>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}

        {/* Proposed Infrastructure Corridor Buffer Band */}
        {activeCorridorData?.geojson?.corridor_buffer && (
          <GeoJSON
            key={`corridor-buffer-${activeCorridorData.alignment_name}`}
            data={activeCorridorData.geojson.corridor_buffer}
            style={{
              color: "#a855f7",
              weight: 2,
              dashArray: "6, 6",
              fillColor: "#c084fc",
              fillOpacity: 0.32,
            }}
          />
        )}

        {/* Proposed Infrastructure Corridor Centerline */}
        {activeCorridorData?.geojson?.line && (
          <GeoJSON
            key={`corridor-line-${activeCorridorData.alignment_name}`}
            data={activeCorridorData.geojson.line}
            style={{
              color: "#38bdf8",
              weight: 4.5,
              opacity: 0.95,
            }}
          />
        )}

        {/* Highlighted Facility Site (e.g. School, Hospital, Sponge Park MCE Recommendation) */}
        {highlightedSite && highlightedSite.center && (() => {
          const textLower = (highlightedSite.justification || "").toLowerCase();
          const isSchool = textLower.includes("school") || textLower.includes("education") || textLower.includes("campus");
          const isHospital = textLower.includes("hospital") || textLower.includes("clinic") || textLower.includes("health") || textLower.includes("medical");
          const isSponge = textLower.includes("sponge") || textLower.includes("retention") || textLower.includes("basin");

          const tagText = isSchool
            ? "✦ Recommended School Site"
            : isHospital
            ? "⌖ Recommended Hospital Site"
            : isSponge
            ? "◉ Proposed Sponge Park Basin"
            : "◈ Recommended Facility Site";

          const beaconColor = isSchool ? "#6366f1" : isHospital ? "#10b981" : isSponge ? "#06b6d4" : "#10b981";

          return (
            <>
              {/* Outer Pulsing Aura Ring */}
              <CircleMarker
                center={highlightedSite.center}
                radius={26}
                pathOptions={{
                  color: beaconColor,
                  weight: 2,
                  fillColor: beaconColor,
                  fillOpacity: 0.18,
                  dashArray: "5, 5",
                }}
              />
              {/* Core Facility Marker */}
              <CircleMarker
                center={highlightedSite.center}
                radius={15}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: beaconColor,
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div className="flood-spot-popup">
                    <span className="flood-spot-tag" style={{ background: beaconColor, color: "#ffffff" }}>
                      {tagText}
                    </span>
                    <h4>Cell {highlightedSite.grid_id}</h4>
                    <p className="spot-loc">{highlightedSite.justification}</p>
                    <div className="spot-depth">
                      <span>Suitability Score:</span>
                      <strong>{highlightedSite.suitability_score}/100</strong>
                    </div>
                    <div className="spot-depth">
                      <span>Baseline Flood Risk:</span>
                      <strong>{highlightedSite.flood_probability_pct}%</strong>
                    </div>
                    <div className="spot-depth">
                      <span>Terrain Elevation:</span>
                      <strong>{highlightedSite.elevation_m}m AMSL</strong>
                    </div>
                  </div>
                </Popup>
                <Tooltip direction="top" permanent>
                  <span>{tagText}: Cell {highlightedSite.grid_id} (Score: {highlightedSite.suitability_score})</span>
                </Tooltip>
              </CircleMarker>
            </>
          );
        })()}
      </MapContainer>

      {/* Floating Active Corridor Assessment Banner */}
      {activeCorridorData && (
        <div className="corridor-active-banner">
          <div className="corridor-banner-info">
            <span className="corridor-tag">Active Alignment Screening</span>
            <strong>{activeCorridorData.alignment_name}</strong>
            <span className="corridor-stat">
              Score: <strong>{activeCorridorData.feasibility_assessment.conflict_score}/100</strong> ({activeCorridorData.feasibility_assessment.classification})
            </span>
            <span className="corridor-stat">
              Structural Conflicts: <strong>{activeCorridorData.building_conflicts.intersected_count} buildings</strong>
            </span>
            <span className="corridor-stat">
              Displaced Area: <strong>{Math.round(activeCorridorData.building_conflicts.total_intersected_area_m2).toLocaleString()} m²</strong>
            </span>
          </div>
          {onClearCorridor && (
            <button
              type="button"
              className="corridor-clear-btn"
              onClick={onClearCorridor}
              title="Clear alignment overlay"
            >
              Clear Overlay ✕
            </button>
          )}
        </div>
      )}

      {/* Floating Active Site Recommendation Banner */}
      {highlightedSite && (
        <div className="site-active-banner">
          <div className="site-banner-info">
            <span className="site-tag">MCE Facility Recommendation</span>
            <strong>Cell {highlightedSite.grid_id}</strong>
            <span className="site-stat">
              Suitability Score: <strong>{highlightedSite.suitability_score}/100</strong>
            </span>
            <span className="site-stat">
              Flood Risk: <strong>{highlightedSite.flood_probability_pct}%</strong>
            </span>
            <span className="site-stat">
              Road Access: <strong>{Math.round(highlightedSite.road_length_m)}m</strong>
            </span>
          </div>
          {onClearSite && (
            <button
              type="button"
              className="site-clear-btn"
              onClick={onClearSite}
              title="Clear site highlight"
            >
              Clear Highlight ✕
            </button>
          )}
        </div>
      )}

      {/* Dynamic Map Legend Overlay */}
      <div className="map-legend-card">
        <span className="legend-title">
          {activeLayer === "scenario"
            ? "Dominant Scenario"
            : activeLayer === "baseline"
            ? "Baseline Flood Risk"
            : activeLayer === "difference"
            ? `${selectedScenario} Delta`
            : `${activeLayer.toUpperCase()} Impact`}
        </span>

        {activeLayer === "scenario" && (
          <div className="legend-items">
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#10b981" }}></span>
              <span>NDVI +20% (Vegetation)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#f59e0b" }}></span>
              <span>Road Density -20%</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#ef4444" }}></span>
              <span>Building Density -20%</span>
            </div>
          </div>
        )}

        {activeLayer === "baseline" && (
          <div className="legend-items">
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#10b981" }}></span>
              <span>&lt; 10% (Low)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#06b6d4" }}></span>
              <span>10% – 20% (Moderate)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#f59e0b" }}></span>
              <span>20% – 40% (High)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#ef4444" }}></span>
              <span>&gt; 40% (Severe Hotspot)</span>
            </div>
          </div>
        )}

        {(activeLayer === "ndvi" ||
          activeLayer === "road" ||
          activeLayer === "building" ||
          activeLayer === "difference") && (
          <div className="legend-items">
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#1d4ed8" }}></span>
              <span>&lt; -5.0 pp (Strong Reduction)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#38bdf8" }}></span>
              <span>-5.0 pp to 0 (Moderate Reduction)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#64748b" }}></span>
              <span>Neutral / Negligible</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#ef4444" }}></span>
              <span>&gt; 0 (Predicted Increase)</span>
            </div>
          </div>
        )}

        <div className="legend-indicators">
          <div className="indicator-item">
            <span className="indicator-line boundary"></span>
            <span>K/East Boundary</span>
          </div>
          <div className="indicator-item">
            <span className="indicator-dot flood"></span>
            <span>BMC Flood Spot</span>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
