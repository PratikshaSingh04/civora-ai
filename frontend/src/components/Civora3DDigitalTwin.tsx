import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { FeatureCollection } from "geojson";
import type {
  ScenarioFeatureCollection,
  MapLayer,
  GridContextMap,
  SuitableSite,
} from "../types/civora";

/* =========================================================
   3D DIGITAL TWIN TYPES & PRESETS
   ========================================================= */
export interface Civora3DProps {
  activeLayer: MapLayer;
  selectedGridId: string;
  selectedScenario: string;
  onGridSelect?: (gridId: string) => void;
  gridData: ScenarioFeatureCollection | null;
  boundaryData: FeatureCollection | null;
  roadsData: FeatureCollection | null;
  floodSpotsData: FeatureCollection | null;
  buildingsData: FeatureCollection | null;
  gridContextMap?: GridContextMap | null;
  highlightedSite?: SuitableSite | null;
  onClearCorridor?: () => void;
  onClearSite?: () => void;
  onSwitchTo2D?: () => void;
  basemap3D?: "dark" | "satellite";
  onBasemap3DChange?: (bm: "dark" | "satellite") => void;
  activeCorridorData?: any;
  triggerFitBounds?: number;
  triggerResetView?: number;
}

interface CameraBookmark {
  id: string;
  name: string;
  icon: string;
  pitch: number;
  bearing: number;
  zoom: number;
  center: [number, number];
  description: string;
}

const CAMERA_BOOKMARKS: CameraBookmark[] = [
  {
    id: "chakala-hub",
    name: "Chakala Hub",
    icon: "🏢",
    pitch: 62,
    bearing: -32,
    zoom: 15.6,
    center: [72.8656, 19.1130],
    description: "MIDC IT Park & Metro 1 interchange high-density urban core",
  },
  {
    id: "mithi-basin",
    name: "Mithi River Basin",
    icon: "🌊",
    pitch: 65,
    bearing: 42,
    zoom: 15.2,
    center: [72.8710, 19.0980],
    description: "Critical hydrological catchment (KE_G_0024 & Saki Naka flood zone)",
  },
  {
    id: "weh-flyover",
    name: "WEH Junction",
    icon: "🛣️",
    pitch: 60,
    bearing: -78,
    zoom: 15.8,
    center: [72.8520, 19.1170],
    description: "Western Express Highway multi-level arterial transit spine",
  },
  {
    id: "seepz-hills",
    name: "SEEPZ Slopes",
    icon: "⛰️",
    pitch: 58,
    bearing: 15,
    zoom: 14.8,
    center: [72.8780, 19.1320],
    description: "Elevated topography transition (66m DEM max elevation)",
  },
  {
    id: "ward-overview",
    name: "K/East Orbit",
    icon: "🌐",
    pitch: 52,
    bearing: -15,
    zoom: 13.8,
    center: [72.8640, 19.1140],
    description: "Complete 16.5 km² municipal expanse with 405 spatial grid cells",
  },
];

/**
 * Robust centroid extraction supporting GeoJSON Point, Polygon, and MultiPolygon geometries
 */
function getFeatureCentroid(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;

  const pts: [number, number][] = [];

  function collectPoints(arr: any) {
    if (!Array.isArray(arr) || arr.length === 0) return;
    if (typeof arr[0] === "number" && typeof arr[1] === "number") {
      const lng = arr[0];
      const lat = arr[1];
      if (
        typeof lng === "number" &&
        !isNaN(lng) &&
        typeof lat === "number" &&
        !isNaN(lat) &&
        lng >= -180 &&
        lng <= 180 &&
        lat >= -90 &&
        lat <= 90
      ) {
        pts.push([lng, lat]);
      }
      return;
    }
    for (const item of arr) {
      collectPoints(item);
    }
  }

  collectPoints(geometry.coordinates);

  if (pts.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of pts) {
    sumLng += lng;
    sumLat += lat;
  }

  const avgLng = sumLng / pts.length;
  const avgLat = sumLat / pts.length;

  if (isNaN(avgLng) || isNaN(avgLat)) return null;
  return [avgLng, avgLat];
}

export default function Civora3DDigitalTwin({
  activeLayer,
  selectedGridId,
  selectedScenario,
  onGridSelect,
  gridData,
  boundaryData,
  roadsData,
  floodSpotsData,
  buildingsData,
  activeCorridorData,
  basemap3D = "dark",
  triggerFitBounds,
  triggerResetView,
}: Civora3DProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const isOrbitingRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const prevBuildingsRef = useRef<any>(null);
  const prevGridDataRef = useRef<any>(null);
  const prevRoadsDataRef = useRef<any>(null);
  const prevBoundaryDataRef = useRef<any>(null);
  const prevFloodSpotsRef = useRef<any>(null);

  // Dynamic scenario property based on activeLayer / selectedScenario
  const scenarioProbField = useMemo(() => {
    if (activeLayer === "ndvi" || selectedScenario.includes("NDVI")) {
      return "CIVORA_Scenario_Results_All_Grids_ndvi_plus_20_probability";
    }
    if (activeLayer === "road" || selectedScenario.includes("Road")) {
      return "CIVORA_Scenario_Results_All_Grids_road_density_minus_20_probability";
    }
    if (activeLayer === "building" || selectedScenario.includes("Building")) {
      return "CIVORA_Scenario_Results_All_Grids_building_density_minus_20_probability";
    }
    return "CIVORA_Scenario_Results_All_Grids_baseline_probability";
  }, [activeLayer, selectedScenario]);

  // 3D Controls State
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState("");
  const [pitch, setPitch] = useState(58);
  const [bearing, setBearing] = useState(-20);
  const [zoom, setZoom] = useState(14.5);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [floodSimulationLevel, setFloodSimulationLevel] = useState(8.5); // Meters
  const [buildingHeightScale, setBuildingHeightScale] = useState(1.0);
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [show3DRiskPillars, setShow3DRiskPillars] = useState(true);
  const [show3DRoads, setShow3DRoads] = useState(true);
  const [showFloodBeacons, setShowFloodBeacons] = useState(true);
  const [activeBookmark, setActiveBookmark] = useState("chakala-hub");

  // Inspected 3D Entity
  const [inspectedEntity, setInspectedEntity] = useState<{
    type: "building" | "grid" | "flood_spot";
    id: string;
    properties: Record<string, any>;
    coordinates?: [number, number];
  } | null>(null);

  // Self-heal buildings data if not passed or not loaded yet
  const [internalBuildings, setInternalBuildings] = useState<FeatureCollection | null>(buildingsData);

  useEffect(() => {
    if (buildingsData) {
      setInternalBuildings(buildingsData);
      return;
    }
    fetch("/data/K_East_Buildings_WGS84.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setInternalBuildings(json);
      })
      .catch((err) => console.warn("Auto-load 3D buildings warning:", err));
  }, [buildingsData]);

  const effectiveBuildings = internalBuildings || buildingsData;

  // Statistics for 3D Inundation & Conflict
  const simulationMetrics = useMemo(() => {
    const totalBuildings = effectiveBuildings?.features.length || 11584;
    const floodDiff = Math.max(0, floodSimulationLevel - 7.5);
    const affectedRatio = Math.min(0.75, Math.pow(floodDiff / 15, 1.3));
    const submergedCount = Math.round(totalBuildings * affectedRatio);
    const submergedAreaSqKm = ((submergedCount * 140) / 1000000).toFixed(2);
    const corridorConflicts = activeCorridorData?.building_conflicts?.count ?? 0;

    return {
      submergedCount,
      submergedAreaSqKm,
      corridorConflicts,
    };
  }, [floodSimulationLevel, effectiveBuildings, activeCorridorData]);

  /* =========================================================
     1. INITIALIZE MAPLIBRE 3D ENGINE (RESILIENT LOADER)
     ========================================================= */
  useEffect(() => {
    let isCancelled = false;

    async function init3DMap() {
      if (!mapContainerRef.current) return;
      setIsInitializing(true);
      setInitError("");

      const win = window as any;
      let maplibregl = win.maplibregl;

      // 1. Check if MapLibre is already loaded or loading
      if (!maplibregl) {
        for (let i = 0; i < 40; i++) {
          if (win.maplibregl) {
            maplibregl = win.maplibregl;
            break;
          }
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      // 2. If still missing, inject script directly
      if (!maplibregl) {
        try {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => {
              const fallback = document.createElement("script");
              fallback.src = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js";
              fallback.async = true;
              fallback.onload = () => resolve();
              fallback.onerror = () => reject(new Error("Failed to load MapLibre CDN"));
              document.head.appendChild(fallback);
            };
            document.head.appendChild(script);
          });
          maplibregl = win.maplibregl;
        } catch {
          // If script failed
        }
      }

      if (isCancelled) return;

      if (!maplibregl) {
        setInitError("3D WebGL engine is connecting. Please ensure your browser has WebGL enabled.");
        setIsInitializing(false);
        return;
      }

      if (mapInstanceRef.current) {
        setIsInitializing(false);
        return;
      }

      try {
        // High-definition Esri Dark & Satellite basemaps (Zero watermarks, No API key needed)
        const style = {
          version: 8,
          sources: {
            "esri-dark": {
              type: "raster",
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              attribution: "Tiles © Esri, DeLorme, NAVTEQ",
            },
            "esri-satellite": {
              type: "raster",
              tiles: [
                "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              attribution: "Tiles © Esri, Earthstar Geographics",
            },
          },
          layers: [
            {
              id: "esri-dark-layer",
              type: "raster",
              source: "esri-dark",
              minzoom: 0,
              maxzoom: 20,
              layout: {
                visibility: basemap3D === "satellite" ? "none" : "visible",
              },
            },
            {
              id: "esri-satellite-layer",
              type: "raster",
              source: "esri-satellite",
              minzoom: 0,
              maxzoom: 20,
              layout: {
                visibility: basemap3D === "satellite" ? "visible" : "none",
              },
            },
          ],
        };

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: style,
          center: [72.8656, 19.1130],
          zoom: 14.5,
          pitch: 58,
          bearing: -20,
          maxPitch: 85,
          minPitch: 0,
          antialias: true,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

        map.on("load", () => {
          if (isCancelled) return;
          mapInstanceRef.current = map;
          setMapLoaded(true);
          setIsInitializing(false);

          try {
            if (typeof map.setLight === "function") {
              map.setLight({
                anchor: "viewport",
                color: "#ffffff",
                intensity: 0.55,
                position: [1.5, 180, 55],
              });
            }
          } catch {
            // ignore
          }
        });

        map.on("rotate", () => {
          setBearing(Math.round(map.getBearing()));
          setPitch(Math.round(map.getPitch()));
        });

        map.on("zoom", () => {
          setZoom(Number(map.getZoom().toFixed(1)));
        });
      } catch (err: any) {
        console.error("MapLibre initialization error:", err);
        if (!isCancelled) {
          setInitError(err.message || "Failed to initialize 3D viewport");
          setIsInitializing(false);
        }
      }
    }

    init3DMap();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /* =========================================================
     DYNAMIC 3D BASEMAP & TOP TOOLBAR INTEGRATION
     ========================================================= */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;
    try {
      if (map.getLayer("esri-dark-layer")) {
        map.setLayoutProperty("esri-dark-layer", "visibility", basemap3D === "satellite" ? "none" : "visible");
      }
      if (map.getLayer("esri-satellite-layer")) {
        map.setLayoutProperty("esri-satellite-layer", "visibility", basemap3D === "satellite" ? "visible" : "none");
      }
      if (map.getLayer("lyr-3d-buildings")) {
        map.setPaintProperty(
          "lyr-3d-buildings",
          "fill-extrusion-opacity",
          basemap3D === "satellite" ? 0.65 : 0.92
        );
      }
    } catch (e) {
      console.warn("Failed to toggle 3D basemap:", e);
    }
  }, [basemap3D, mapLoaded]);

  // Fit Ward Trigger from Toolbar
  useEffect(() => {
    if (!triggerFitBounds || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({
      center: [72.8640, 19.1140],
      zoom: 13.8,
      pitch: 52,
      bearing: -15,
      duration: 1600,
    });
  }, [triggerFitBounds]);

  // Reset View Trigger from Toolbar
  useEffect(() => {
    if (!triggerResetView || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({
      center: [72.8656, 19.1130],
      zoom: 14.5,
      pitch: 58,
      bearing: -20,
      duration: 1500,
    });
  }, [triggerResetView]);

  /* =========================================================
     2. SYNC GEOJSON SOURCES & 3D LAYERS
     ========================================================= */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    // A. Boundary Layer
    if (boundaryData) {
      if (!map.getSource("src-boundary")) {
        map.addSource("src-boundary", { type: "geojson", data: boundaryData });
        map.addLayer({
          id: "lyr-boundary-glow",
          type: "line",
          source: "src-boundary",
          paint: {
            "line-color": "#06b6d4",
            "line-width": 3,
            "line-opacity": 0.8,
            "line-blur": 2,
          },
        });
        map.addLayer({
          id: "lyr-boundary-core",
          type: "line",
          source: "src-boundary",
          paint: {
            "line-color": "#22d3ee",
            "line-width": 1.5,
          },
        });
      } else {
        if (prevBoundaryDataRef.current !== boundaryData) {
          prevBoundaryDataRef.current = boundaryData;
          map.getSource("src-boundary").setData(boundaryData);
        }
      }
    }

    // B. Roads Layer (3D Elevated Transit Lines)
    if (roadsData) {
      if (!map.getSource("src-roads")) {
        map.addSource("src-roads", { type: "geojson", data: roadsData });
        map.addLayer({
          id: "lyr-roads",
          type: "line",
          source: "src-roads",
          layout: {
            visibility: show3DRoads ? "visible" : "none",
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "highway"], "primary"],
              "#f59e0b",
              ["==", ["get", "highway"], "secondary"],
              "#38bdf8",
              "#64748b",
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              1,
              16,
              3.5,
            ],
            "line-opacity": 0.75,
          },
        });
      } else {
        if (prevRoadsDataRef.current !== roadsData) {
          prevRoadsDataRef.current = roadsData;
          map.getSource("src-roads").setData(roadsData);
        }
        map.setLayoutProperty("lyr-roads", "visibility", show3DRoads ? "visible" : "none");
      }
    }

    // C. 405 Spatial Risk Grids (Extruded 3D Territorial Columns)
    if (gridData) {
      if (!map.getSource("src-grids")) {
        map.addSource("src-grids", { type: "geojson", data: gridData });

        map.addLayer({
          id: "lyr-grids-extrusion",
          type: "fill-extrusion",
          source: "src-grids",
          layout: {
            visibility: show3DRiskPillars ? "visible" : "none",
          },
          paint: {
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", scenarioProbField], 0.05],
              0.0,
              4,
              0.2,
              25,
              0.4,
              65,
              0.7,
              140,
              1.0,
              220,
            ],
            "fill-extrusion-base": 0,
            "fill-extrusion-color": [
              "case",
              ["==", ["get", "grid_id"], selectedGridId],
              "#f59e0b", // Highlighted selected cell in Gold
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", scenarioProbField], 0.05],
                0.0,
                "#10b981", // Low risk Green
                0.25,
                "#06b6d4", // Moderate Cyan
                0.45,
                "#eab308", // Elevated Yellow
                0.65,
                "#f97316", // High Orange
                0.85,
                "#ef4444", // Severe Crimson
              ],
            ],
            "fill-extrusion-opacity": 0.45,
          },
        });

        // Click grid cell to inspect
        map.on("click", "lyr-grids-extrusion", (e: any) => {
          if (!e.features || !e.features[0]) return;
          if ((e.originalEvent as any)?._civoraHandled || (e as any)?._civoraHandled) return;

          // Priority shield: if a 3D building or flood beacon is at this exact point, let it handle the event
          try {
            const hitOverlays = map.queryRenderedFeatures(e.point, {
              layers: ["lyr-3d-buildings", "lyr-flood-spots-glow"].filter((id) => map.getLayer(id)),
            });
            if (hitOverlays && hitOverlays.length > 0) return;
          } catch {
            // ignore query failure if layer not rendered
          }

          const feat = e.features[0];
          const gid = feat.properties?.grid_id;
          if (gid) {
            onGridSelect?.(gid);
            setInspectedEntity({
              type: "grid",
              id: gid,
              properties: feat.properties,
              coordinates: [e.lngLat.lng, e.lngLat.lat],
            });
          }
        });

        map.on("mouseenter", "lyr-grids-extrusion", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "lyr-grids-extrusion", () => {
          map.getCanvas().style.cursor = "";
        });
      } else {
        if (prevGridDataRef.current !== gridData) {
          prevGridDataRef.current = gridData;
          map.getSource("src-grids").setData(gridData);
        }
        map.setLayoutProperty("lyr-grids-extrusion", "visibility", show3DRiskPillars ? "visible" : "none");
        map.setPaintProperty("lyr-grids-extrusion", "fill-extrusion-height", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", scenarioProbField], 0.05],
          0.0,
          4,
          0.2,
          25,
          0.4,
          65,
          0.7,
          140,
          1.0,
          220,
        ]);
        // Update color expression for selection
        map.setPaintProperty("lyr-grids-extrusion", "fill-extrusion-color", [
          "case",
          ["==", ["get", "grid_id"], selectedGridId],
          "#f59e0b",
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", scenarioProbField], 0.05],
            0.0,
            "#10b981",
            0.25,
            "#06b6d4",
            0.45,
            "#eab308",
            0.65,
            "#f97316",
            0.85,
            "#ef4444",
          ],
        ]);
      }
    }

    // D. 11,584 Extruded 3D Buildings
    if (effectiveBuildings) {
      if (!map.getSource("src-buildings")) {
        map.addSource("src-buildings", { type: "geojson", data: effectiveBuildings });

        map.addLayer({
          id: "lyr-3d-buildings",
          type: "fill-extrusion",
          source: "src-buildings",
          layout: {
            visibility: show3DBuildings ? "visible" : "none",
          },
          paint: {
            "fill-extrusion-height": [
              "*",
              buildingHeightScale,
              [
                "interpolate",
                ["linear"],
                ["sqrt", ["coalesce", ["get", "area_m2"], 100]],
                5,
                7,
                12,
                18,
                22,
                38,
                35,
                75,
                50,
                110,
              ],
            ],
            "fill-extrusion-base": 0,
            "fill-extrusion-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#38bdf8", // Cyan on hover
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "area_m2"], 100],
                50,
                "#1e293b",
                250,
                "#334155",
                800,
                "#475569",
                2500,
                "#64748b",
              ],
            ],
            "fill-extrusion-opacity": 0.92,
          },
        });

        // Click building to inspect
        map.on("click", "lyr-3d-buildings", (e: any) => {
          if (!e.features || !e.features[0]) return;
          if (e.originalEvent) {
            (e.originalEvent as any)._civoraHandled = true;
          }
          (e as any)._civoraHandled = true;

          const feat = e.features[0];
          const rawArea = Number(feat.properties?.area_m2);
          const area = !isNaN(rawArea) && rawArea > 0 ? rawArea : 120;
          const estFloors = Math.min(32, Math.max(1, Math.round(Math.sqrt(area) * 0.35)));
          const estHeight = estFloors * 3.2;

          setInspectedEntity({
            type: "building",
            id: feat.properties?.building_id || `BLDG_${feat.properties?.fid || "K"}`,
            properties: {
              ...feat.properties,
              area_m2: area,
              calculated_height_m: estHeight.toFixed(1),
              estimated_floors: estFloors,
            },
            coordinates: [e.lngLat.lng, e.lngLat.lat],
          });
        });

        map.on("mouseenter", "lyr-3d-buildings", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "lyr-3d-buildings", () => {
          map.getCanvas().style.cursor = "";
        });
      } else {
        if (prevBuildingsRef.current !== effectiveBuildings) {
          prevBuildingsRef.current = effectiveBuildings;
          map.getSource("src-buildings").setData(effectiveBuildings);
        }
        map.setLayoutProperty("lyr-3d-buildings", "visibility", show3DBuildings ? "visible" : "none");
        map.setPaintProperty("lyr-3d-buildings", "fill-extrusion-height", [
          "*",
          buildingHeightScale,
          [
            "interpolate",
            ["linear"],
            ["sqrt", ["coalesce", ["get", "area_m2"], 100]],
            5,
            7,
            12,
            18,
            22,
            38,
            35,
            75,
            50,
            110,
          ],
        ]);
      }
    }

    // E. 57 Official BMC Flooding Spots (Tactical Cyber Beacons)
    if (floodSpotsData) {
      if (!map.getSource("src-flood-spots")) {
        map.addSource("src-flood-spots", { type: "geojson", data: floodSpotsData });

        // Outer Radar Halo
        map.addLayer({
          id: "lyr-flood-spots-radar",
          type: "circle",
          source: "src-flood-spots",
          layout: {
            visibility: showFloodBeacons ? "visible" : "none",
          },
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              5,
              14,
              8,
              17,
              14,
            ],
            "circle-color": "#f43f5e",
            "circle-opacity": 0.22,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fda4af",
            "circle-stroke-opacity": 0.4,
          },
        });

        // Inner Tactical Core
        map.addLayer({
          id: "lyr-flood-spots-glow",
          type: "circle",
          source: "src-flood-spots",
          layout: {
            visibility: showFloodBeacons ? "visible" : "none",
          },
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              2.5,
              14,
              4.5,
              17,
              7.5,
            ],
            "circle-color": "#ef4444",
            "circle-opacity": 0.95,
            "circle-stroke-width": 1.2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("click", "lyr-flood-spots-glow", (e: any) => {
          if (!e.features || !e.features[0]) return;
          if (e.originalEvent) {
            (e.originalEvent as any)._civoraHandled = true;
          }
          (e as any)._civoraHandled = true;

          const feat = e.features[0];
          setInspectedEntity({
            type: "flood_spot",
            id: feat.properties?.location_name || "BMC Waterlogging Spot",
            properties: feat.properties,
            coordinates: [e.lngLat.lng, e.lngLat.lat],
          });
        });

        map.on("mouseenter", "lyr-flood-spots-glow", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "lyr-flood-spots-glow", () => {
          map.getCanvas().style.cursor = "";
        });
      } else {
        if (prevFloodSpotsRef.current !== floodSpotsData) {
          prevFloodSpotsRef.current = floodSpotsData;
          map.getSource("src-flood-spots").setData(floodSpotsData);
        }
        map.setLayoutProperty("lyr-flood-spots-radar", "visibility", showFloodBeacons ? "visible" : "none");
        map.setLayoutProperty("lyr-flood-spots-glow", "visibility", showFloodBeacons ? "visible" : "none");
      }
    }

    // F. Active Infrastructure Corridor Alignment (3D Elevated Flyover + Clearance Envelope)
    if (activeCorridorData) {
      const lineGeo = activeCorridorData.geojson?.line;
      const bufferGeo = activeCorridorData.geojson?.corridor_buffer;

      // Corridor Line
      if (lineGeo) {
        if (!map.getSource("src-active-corridor-line")) {
          map.addSource("src-active-corridor-line", { type: "geojson", data: lineGeo });
          map.addLayer({
            id: "lyr-active-corridor-line",
            type: "line",
            source: "src-active-corridor-line",
            paint: {
              "line-color": "#38bdf8",
              "line-width": 5,
              "line-dasharray": [1, 0.5],
            },
          });
        } else {
          map.getSource("src-active-corridor-line").setData(lineGeo);
        }
      }

      // Corridor 3D Buffer Clearance Envelope
      if (bufferGeo) {
        if (!map.getSource("src-active-corridor-buffer")) {
          map.addSource("src-active-corridor-buffer", { type: "geojson", data: bufferGeo });
          map.addLayer({
            id: "lyr-active-corridor-buffer",
            type: "fill-extrusion",
            source: "src-active-corridor-buffer",
            paint: {
              "fill-extrusion-height": 16, // 16m elevated clearance envelope
              "fill-extrusion-base": 0,
              "fill-extrusion-color": "#0284c7",
              "fill-extrusion-opacity": 0.35,
            },
          });
        } else {
          map.getSource("src-active-corridor-buffer").setData(bufferGeo);
        }
      }
    } else {
      if (map.getLayer("lyr-active-corridor-line")) map.removeLayer("lyr-active-corridor-line");
      if (map.getSource("src-active-corridor-line")) map.removeSource("src-active-corridor-line");
      if (map.getLayer("lyr-active-corridor-buffer")) map.removeLayer("lyr-active-corridor-buffer");
      if (map.getSource("src-active-corridor-buffer")) map.removeSource("src-active-corridor-buffer");
    }

    // G. Volumetric 3D Flood Inundation Plane (Rises dynamically with MSL simulation slider)
    if (boundaryData) {
      if (!map.getSource("src-flood-water")) {
        map.addSource("src-flood-water", { type: "geojson", data: boundaryData });
        map.addLayer({
          id: "lyr-3d-water-plane",
          type: "fill-extrusion",
          source: "src-flood-water",
          paint: {
            "fill-extrusion-height": floodSimulationLevel * 1.5,
            "fill-extrusion-base": 0,
            "fill-extrusion-color": "#0284c7",
            "fill-extrusion-opacity": 0.48,
          },
        });
        map.addLayer({
          id: "lyr-3d-water-glow",
          type: "line",
          source: "src-flood-water",
          paint: {
            "line-color": "#38bdf8",
            "line-width": 3,
            "line-opacity": 0.75,
            "line-blur": 2,
          },
        });
      } else {
        map.getSource("src-flood-water").setData(boundaryData);
        map.setPaintProperty("lyr-3d-water-plane", "fill-extrusion-height", floodSimulationLevel * 1.5);
      }
    }
  }, [
    mapLoaded,
    boundaryData,
    roadsData,
    gridData,
    effectiveBuildings,
    floodSpotsData,
    activeCorridorData,
    selectedGridId,
    buildingHeightScale,
    show3DBuildings,
    show3DRiskPillars,
    show3DRoads,
    showFloodBeacons,
    scenarioProbField,
    floodSimulationLevel,
  ]);

  /* =========================================================
     3. CINEMATIC AUTO-ORBIT ANIMATION
     ========================================================= */
  useEffect(() => {
    isOrbitingRef.current = isOrbiting;
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    if (!isOrbiting) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const orbitStep = () => {
      if (!isOrbitingRef.current || !mapInstanceRef.current) return;
      const currentBearing = mapInstanceRef.current.getBearing();
      mapInstanceRef.current.setBearing((currentBearing + 0.18) % 360);
      animFrameRef.current = requestAnimationFrame(orbitStep);
    };

    animFrameRef.current = requestAnimationFrame(orbitStep);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOrbiting, mapLoaded]);

  /* =========================================================
     4. CAMERA BOOKMARKS HANDLER
     ========================================================= */
  const handleFlyToBookmark = useCallback((bm: CameraBookmark) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setActiveBookmark(bm.id);
    map.flyTo({
      center: bm.center,
      zoom: bm.zoom,
      pitch: bm.pitch,
      bearing: bm.bearing,
      duration: 2200,
      essential: true,
    });
  }, []);

  /* =========================================================
     5. PAN TO SELECTED GRID
     ========================================================= */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedGridId || !gridData) return;

    const feature = gridData.features.find(
      (f) => f.properties?.grid_id === selectedGridId
    );
    if (!feature || !feature.geometry) return;

    // Calculate real centroid safely across MultiPolygon and Polygon features
    const center = getFeatureCentroid(feature.geometry);
    if (!center) return;

    // Guard against any NaN camera projection corruption
    if (isNaN(center[0]) || isNaN(center[1])) return;

    map.flyTo({
      center,
      zoom: 15.5,
      pitch: 62,
      duration: 1600,
    });
  }, [selectedGridId, gridData]);

  return (
    <div className="civora-3d-digital-twin-wrapper" style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* 3D Map Canvas Container */}
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", background: "#090d16" }}
      />

      {/* Loading Overlay */}
      {isInitializing && (
        <div className="dt-loading-overlay">
          <div className="dt-loading-content">
            <div className="dt-loading-spinner"></div>
            <h4>INITIALIZING 3D DIGITAL TWIN</h4>
            <p>Loading 11,584 building footprints & 405 spatial risk pillars...</p>
          </div>
        </div>
      )}

      {initError && (
        <div className="dt-error-overlay">
          <p>⚠️ {initError}</p>
          <button type="button" className="dt-hud-btn" onClick={() => window.location.reload()}>Retry Engine</button>
        </div>
      )}

      {/* 3D FLOATING ACTION STRIP (Neatly positioned below top toolbar with zero overlap) */}
      <div className="dt-floating-action-strip">
        {/* Left: Flight Path Camera Bookmarks */}
        <div className="dt-flight-bookmarks">
          <span className="dt-flight-label">✈️ FLIGHT PATHS:</span>
          {CAMERA_BOOKMARKS.map((bm) => (
            <button
              key={bm.id}
              type="button"
              className={`dt-flight-pill ${activeBookmark === bm.id ? "active" : ""}`}
              onClick={() => handleFlyToBookmark(bm)}
              title={bm.description}
            >
              <span className="dt-flight-icon">{bm.icon}</span>
              <span>{bm.name}</span>
            </button>
          ))}
        </div>

        {/* Right: Camera Telemetry & Aerial Controls */}
        <div className="dt-telemetry-controls">
          <div className="dt-telemetry-chip">
            <span>PITCH: <strong>{pitch}°</strong></span>
            <span>BEARING: <strong>{bearing}°</strong></span>
            <span>ZOOM: <strong>{zoom}x</strong></span>
          </div>

          <button
            type="button"
            className={`dt-hud-btn ${isOrbiting ? "active-orbit" : ""}`}
            onClick={() => setIsOrbiting((prev) => !prev)}
            title="Toggle 360° Continuous Cinematic Aerial Orbit"
          >
            {isOrbiting ? "⏸ Stop Orbit" : "🔄 360° Aerial Orbit"}
          </button>

          <button
            type="button"
            className="dt-hud-btn"
            onClick={() => {
              const map = mapInstanceRef.current;
              if (map) {
                map.flyTo({
                  center: [72.8656, 19.1130],
                  zoom: 14.5,
                  pitch: 58,
                  bearing: -20,
                  duration: 1500,
                });
              }
            }}
            title="Reset Camera Angle to Default K/East Perspective"
          >
            ↺ Reset Angle
          </button>
        </div>
      </div>

      {/* 3D INTERACTIVE SIMULATION DOCK (FLOOD & CLEARANCE) */}
      <div className="dt-simulation-dock">
        <div className="dt-dock-header">
          <div className="dt-dock-title">
            <span>🌊 3D Flood Inundation Simulator</span>
            <span className="dt-dock-value">+{floodSimulationLevel.toFixed(1)}m MSL</span>
          </div>
        </div>

        <div className="dt-dock-slider-row">
          <input
            type="range"
            min="5.0"
            max="20.0"
            step="0.5"
            value={floodSimulationLevel}
            onChange={(e) => setFloodSimulationLevel(parseFloat(e.target.value))}
            className="dt-slider"
          />
        </div>

        <div className="dt-dock-metrics">
          <div className="dt-metric-box">
            <span className="dt-metric-lbl">SUBMERGED FOOTPRINTS</span>
            <strong className="dt-metric-val red">{simulationMetrics.submergedCount}</strong>
          </div>
          <div className="dt-metric-box">
            <span className="dt-metric-lbl">INUNDATED AREA</span>
            <strong className="dt-metric-val amber">{simulationMetrics.submergedAreaSqKm} km²</strong>
          </div>
          <div className="dt-metric-box">
            <span className="dt-metric-lbl">CORRIDOR CONFLICTS</span>
            <strong className="dt-metric-val cyan">{simulationMetrics.corridorConflicts}</strong>
          </div>
        </div>

        {/* 3D Layer Quick Toggles */}
        <div className="dt-dock-toggles">
          <button
            type="button"
            className={`dt-layer-toggle-btn ${show3DBuildings ? "on" : ""}`}
            onClick={() => setShow3DBuildings((p) => !p)}
          >
            🏢 11,584 Extrusions
          </button>
          <button
            type="button"
            className={`dt-layer-toggle-btn ${show3DRiskPillars ? "on" : ""}`}
            onClick={() => setShow3DRiskPillars((p) => !p)}
          >
            📊 405 Risk Pillars
          </button>
          <button
            type="button"
            className={`dt-layer-toggle-btn ${showFloodBeacons ? "on" : ""}`}
            onClick={() => setShowFloodBeacons((p) => !p)}
          >
            ⚠️ 57 BMC Spots
          </button>
          <button
            type="button"
            className={`dt-layer-toggle-btn ${show3DRoads ? "on" : ""}`}
            onClick={() => setShow3DRoads((p) => !p)}
          >
            🛣️ Road Network
          </button>
        </div>

        {/* Building Height Exaggeration */}
        <div className="dt-height-scale-row">
          <span>Height Exaggeration:</span>
          {[0.5, 1.0, 1.8, 2.5].map((scale) => (
            <button
              key={scale}
              type="button"
              className={`dt-scale-pill ${buildingHeightScale === scale ? "active" : ""}`}
              onClick={() => setBuildingHeightScale(scale)}
            >
              {scale}x
            </button>
          ))}
        </div>
      </div>

      {/* INSPECTED 3D ENTITY POPUP CARD */}
      {inspectedEntity && (
        <div className="dt-inspector-card">
          <div className="dt-inspector-header">
            <div>
              <span className="dt-inspector-tag">
                {inspectedEntity.type === "building"
                  ? "3D STRUCTURAL FOOTPRINT"
                  : inspectedEntity.type === "grid"
                  ? "SPATIAL RISK CELL"
                  : "WATERLOGGING HOTSPOT"}
              </span>
              <h4>{inspectedEntity.id}</h4>
            </div>
            <button
              type="button"
              className="dt-inspector-close"
              onClick={() => setInspectedEntity(null)}
            >
              ✕
            </button>
          </div>

          <div className="dt-inspector-body">
            {inspectedEntity.type === "building" && (
              <>
                <div className="dt-stat-item">
                  <span>Footprint Area:</span>
                  <strong>{Number(inspectedEntity.properties.area_m2 || 0).toFixed(1)} m²</strong>
                </div>
                <div className="dt-stat-item">
                  <span>Calculated 3D Height:</span>
                  <strong>{inspectedEntity.properties.calculated_height_m} m</strong>
                </div>
                <div className="dt-stat-item">
                  <span>Estimated Storeys:</span>
                  <strong>G + {inspectedEntity.properties.estimated_floors} Floors</strong>
                </div>
                <div className="dt-stat-item">
                  <span>Parent Ward / Subzone:</span>
                  <strong>Andheri East / K-East</strong>
                </div>
              </>
            )}

            {inspectedEntity.type === "grid" && (
              <>
                <div className="dt-stat-item">
                  <span>Baseline Flood Risk:</span>
                  <strong className="red">
                    {(Number(inspectedEntity.properties.CIVORA_Scenario_Results_All_Grids_baseline_probability || 0) * 100).toFixed(1)}%
                  </strong>
                </div>
                <div className="dt-stat-item">
                  <span>NDVI +20% Impact:</span>
                  <strong className="green">
                    {(Number(inspectedEntity.properties.CIVORA_Scenario_Results_All_Grids_ndvi_change || 0) * 100).toFixed(2)}%
                  </strong>
                </div>
                <div className="dt-stat-item">
                  <span>Dominant Policy Strategy:</span>
                  <strong>{inspectedEntity.properties.CIVORA_Scenario_Impact_All_Grids_dominant_scenario || "Canopy Expansion"}</strong>
                </div>
              </>
            )}

            {inspectedEntity.type === "flood_spot" && (
              <>
                <div className="dt-stat-item">
                  <span>BMC Official Designation:</span>
                  <strong className="amber">{inspectedEntity.properties.location_name || inspectedEntity.id}</strong>
                </div>
                <div className="dt-stat-item">
                  <span>Vulnerability Tier:</span>
                  <strong className="red">High Historical Inundation</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE INFRASTRUCTURE CORRIDOR 3D HUD */}
      {activeCorridorData && (
        <div className="dt-corridor-badge">
          <span className="pulse-dot-red"></span>
          <div>
            <strong>3D CORRIDOR CLEARANCE ENVELOPE ACTIVE</strong>
            <p>
              {activeCorridorData.alignment_name} (Buffer: {activeCorridorData.corridor_width_m}m | Clearance: 16m)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
