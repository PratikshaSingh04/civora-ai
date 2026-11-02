import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
  searchFlyTarget?: { center: [number, number]; zoom?: number; timestamp: number } | null;
}

function MapController({
  selectedGridId,
  gridData,
  triggerFitBounds,
  triggerResetView,
  activeCorridorData,
  highlightedSite,
  searchFlyTarget,
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

  // Pan and zoom to searched landmark or explicit search target
  useEffect(() => {
    if (!searchFlyTarget) return;
    map.flyTo(searchFlyTarget.center, searchFlyTarget.zoom || 15.5, {
      duration: 1.0,
      animate: true,
    });
  }, [searchFlyTarget, map]);

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
   CURATED K/EAST WARD LANDMARKS & TRANSIT HUBS
   ========================================================= */
export interface CuratedLandmark {
  id: string;
  name: string;
  category: "landmark" | "transit" | "hospital" | "flood_spot" | "grid";
  gridId: string;
  aliases: string[];
  lat: number;
  lng: number;
  tag: string;
  badgeClass?: string;
  desc?: string;
}

const CURATED_LANDMARKS: CuratedLandmark[] = [
  {
    id: "saki-naka",
    name: "Saki Naka Junction",
    category: "flood_spot",
    gridId: "KE_G_0449",
    aliases: ["SAKI NAKA", "SAKINAKA", "SAKI NAKA METRO", "ANDHERI KURLA ROAD", "JUNCTION"],
    lat: 19.1065,
    lng: 72.8817,
    tag: "62.7% Flood Risk",
    badgeClass: "badge-hotspot",
    desc: "Critical intersection & Metro Line 1 interchange",
  },
  {
    id: "milan-subway",
    name: "Milan Subway",
    category: "flood_spot",
    gridId: "KE_G_0024",
    aliases: ["MILAN SUBWAY", "MILAN", "SANTA CRUZ SUBWAY", "MILAN FLYOVER"],
    lat: 19.0925,
    lng: 72.8441,
    tag: "88.6% Critical Hotspot",
    badgeClass: "badge-hotspot",
    desc: "Highest flood vulnerability basin in K/East Ward",
  },
  {
    id: "airport-t2",
    name: "Mumbai International Airport (CSMIA / T2)",
    category: "landmark",
    gridId: "KE_G_0372",
    aliases: ["AIRPORT", "T2", "CSMIA", "TERMINAL 2", "INTERNATIONAL AIRPORT", "SAHAR AIRPORT"],
    lat: 19.0974,
    lng: 72.8747,
    tag: "Aviation Hub",
    badgeClass: "badge-hub",
    desc: "Chhatrapati Shivaji Maharaj International Airport",
  },
  {
    id: "chakala-metro",
    name: "Chakala (J.B. Nagar) Metro Hub",
    category: "transit",
    gridId: "KE_G_0257",
    aliases: ["CHAKALA", "CHAKALA METRO", "J.B. NAGAR", "JB NAGAR", "MIDC CROSSING"],
    lat: 19.1131,
    lng: 72.8650,
    tag: "Transit Hub",
    badgeClass: "badge-transit",
    desc: "Andheri-Kurla arterial transit hub & commercial node",
  },
  {
    id: "weh-junction",
    name: "Western Express Highway (WEH / Gundavali)",
    category: "transit",
    gridId: "KE_G_0120",
    aliases: ["WEH", "WESTERN EXPRESS HIGHWAY", "GUNDAVALI", "HIGHWAY", "GUNDAVALI METRO"],
    lat: 19.1175,
    lng: 72.8531,
    tag: "Arterial Highway",
    badgeClass: "badge-transit",
    desc: "Primary north-south traffic corridor of Mumbai",
  },
  {
    id: "jvlr-junction",
    name: "JVLR (Jogeshwari-Vikhroli Link Road)",
    category: "transit",
    gridId: "KE_G_0276",
    aliases: ["JVLR", "JOGESHWARI VIKHROLI LINK ROAD", "LINK ROAD", "MAJJAS DEPOT"],
    lat: 19.1312,
    lng: 72.8672,
    tag: "Arterial Spine",
    badgeClass: "badge-transit",
    desc: "Major east-west connector linking Western & Eastern Express Highways",
  },
  {
    id: "andheri-subway",
    name: "Andheri Subway & SV Road",
    category: "flood_spot",
    gridId: "KE_G_0061",
    aliases: ["ANDHERI SUBWAY", "ANDHERI UNDERPASS", "STATION SUBWAY", "SV ROAD"],
    lat: 19.1193,
    lng: 72.8470,
    tag: "Flood Hotspot",
    badgeClass: "badge-hotspot",
    desc: "Chronic low-lying railway underpass prone to monsoon inundation",
  },
  {
    id: "andheri-station",
    name: "Andheri Railway Station (East)",
    category: "transit",
    gridId: "KE_G_0064",
    aliases: ["ANDHERI STATION", "ANDHERI EAST", "ANDHERI METRO", "STATION TERMINUS"],
    lat: 19.1205,
    lng: 72.8485,
    tag: "Railway Terminus",
    badgeClass: "badge-transit",
    desc: "Suburban railway interchange and Line 1 Metro terminus",
  },
  {
    id: "midc-it-park",
    name: "MIDC Industrial & IT Area",
    category: "landmark",
    gridId: "KE_G_0334",
    aliases: ["MIDC", "MIDC ANDHERI", "CROSS ROAD", "CENTRAL ROAD MIDC", "IT PARK"],
    lat: 19.1222,
    lng: 72.8720,
    tag: "Tech Corridor",
    badgeClass: "badge-hub",
    desc: "Major commercial IT park and corporate headquarters district",
  },
  {
    id: "seepz",
    name: "SEEPZ Special Economic Zone",
    category: "landmark",
    gridId: "KE_G_0384",
    aliases: ["SEEPZ", "SEEPZ GATE", "SEEPZ ANDHERI", "SPECIAL ECONOMIC ZONE"],
    lat: 19.1304,
    lng: 72.8759,
    tag: "Export Zone",
    badgeClass: "badge-hub",
    desc: "Export processing zone with high workforce concentration",
  },
  {
    id: "marol-naka",
    name: "Marol Naka Metro & Andheri-Kurla Rd",
    category: "flood_spot",
    gridId: "KE_G_0420",
    aliases: ["MAROL NAKA", "MAROL", "MAROL METRO", "ANDHERI KURLA ROAD MAROL"],
    lat: 19.1110,
    lng: 72.8793,
    tag: "66.2% Hotspot",
    badgeClass: "badge-hotspot",
    desc: "High-density commercial junction & Metro Line 1 & Line 3 interchange",
  },
  {
    id: "seven-hills",
    name: "SevenHills Hospital (Marol)",
    category: "hospital",
    gridId: "KE_G_0470",
    aliases: ["SEVENHILLS", "SEVEN HILLS HOSPITAL", "SEVENHILLS MAROL", "HOSPITAL MAROL"],
    lat: 19.1201,
    lng: 72.8839,
    tag: "Lifeline Hospital",
    badgeClass: "badge-hospital",
    desc: "Premier 1,500-bed emergency tertiary healthcare facility",
  },
  {
    id: "holy-spirit",
    name: "Holy Spirit Hospital (Mahakali)",
    category: "hospital",
    gridId: "KE_G_0306",
    aliases: ["HOLY SPIRIT", "HOLY SPIRIT HOSPITAL", "MAHAKALI HOSPITAL"],
    lat: 19.1245,
    lng: 72.8696,
    tag: "Lifeline Hospital",
    badgeClass: "badge-hospital",
    desc: "300-bed multispecialty hospital and critical care center",
  },
  {
    id: "mahakali-caves",
    name: "Mahakali Caves (Kondivite)",
    category: "landmark",
    gridId: "KE_G_0277",
    aliases: ["MAHAKALI CAVES", "KONDIVITE CAVES", "MAHAKALI ROAD", "CAVES"],
    lat: 19.1289,
    lng: 72.8672,
    tag: "Heritage Site",
    badgeClass: "badge-hub",
    desc: "Ancient 1st-century BCE rock-cut Buddhist heritage monument",
  },
  {
    id: "mithi-river",
    name: "Mithi River Catchment",
    category: "flood_spot",
    gridId: "KE_G_0318",
    aliases: ["MITHI", "MITHI RIVER", "RIVER BASIN", "MITHI NALLAH", "KRISHNA NAGAR"],
    lat: 19.0974,
    lng: 72.8700,
    tag: "Hydrological Core",
    badgeClass: "badge-hotspot",
    desc: "Primary storm drainage watercourse and tidal discharge channel",
  },
  {
    id: "vile-parle-east",
    name: "Vile Parle East & Sathye College",
    category: "landmark",
    gridId: "KE_G_0020",
    aliases: ["VILE PARLE", "VILE PARLE EAST", "NEHRU ROAD", "SATHYE COLLEGE", "DIXIT ROAD"],
    lat: 19.0993,
    lng: 72.8445,
    tag: "Civic Node",
    badgeClass: "badge-hub",
    desc: "Residential and educational corridor adjacent to domestic airport",
  },
  {
    id: "vishal-hall",
    name: "Vishal Hall / MV Road",
    category: "transit",
    gridId: "KE_G_0119",
    aliases: ["VISHAL HALL", "MV ROAD", "MATHURADAS VASANJI ROAD", "SIR MV ROAD"],
    lat: 19.1175,
    lng: 72.8531,
    tag: "Commercial Spine",
    badgeClass: "badge-transit",
    desc: "Major retail junction on Andheri-Ghatkopar transit corridor",
  },
  {
    id: "sher-e-punjab",
    name: "Sher-e-Punjab Colony",
    category: "landmark",
    gridId: "KE_G_0185",
    aliases: ["SHER-E-PUNJAB", "SHER E PUNJAB", "PUNJAB COLONY", "TOLANI COLLEGE"],
    lat: 19.1265,
    lng: 72.8590,
    tag: "Residential Core",
    badgeClass: "badge-hub",
    desc: "Established residential enclave near Mahakali and JVLR",
  },
];

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFlyTarget, setSearchFlyTarget] = useState<{
    center: [number, number];
    zoom?: number;
    timestamp: number;
  } | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [triggerFitBounds, setTriggerFitBounds] = useState(0);
  const [triggerResetView, setTriggerResetView] = useState(0);
  const [error, setError] = useState<string>("");

  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  // Handle click outside to close search suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-dismiss search error after 4.5 seconds
  useEffect(() => {
    if (searchError) {
      const timer = setTimeout(() => setSearchError(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [searchError]);

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

  /* Build Autocomplete Suggestions for Landmarks, Roads, and Grids */
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();

    // If query is empty, show top 6 featured landmarks
    if (!q) {
      return CURATED_LANDMARKS.slice(0, 6).map((lm) => ({
        ...lm,
        icon:
          lm.category === "hospital"
            ? "🏥"
            : lm.category === "flood_spot"
            ? "💧"
            : lm.category === "transit"
            ? "🛣️"
            : "🏛️",
      }));
    }

    const results: Array<{
      id: string;
      name: string;
      category: string;
      gridId: string;
      lat?: number;
      lng?: number;
      tag: string;
      badgeClass?: string;
      desc?: string;
      icon: string;
    }> = [];

    // 1. Curated Landmarks & Aliases
    for (const lm of CURATED_LANDMARKS) {
      const matchName = lm.name.toUpperCase().includes(q);
      const matchAlias = lm.aliases.some((a) => a.toUpperCase().includes(q));
      const matchGrid = lm.gridId.toUpperCase().includes(q);
      if (matchName || matchAlias || matchGrid) {
        results.push({
          ...lm,
          icon:
            lm.category === "hospital"
              ? "🏥"
              : lm.category === "flood_spot"
              ? "💧"
              : lm.category === "transit"
              ? "🛣️"
              : "🏛️",
        });
      }
    }

    // 2. Direct Grid ID Matching (handles 'KE_G_0024', '0024', '24')
    const cleanNum = q.replace(/[^0-9]/g, "");
    if (gridData) {
      for (const feat of gridData.features) {
        const gid = feat.properties?.grid_id || "";
        const matchesExact = gid.toUpperCase() === q;
        const matchesPrefix = gid.toUpperCase().includes(q);
        const matchesNum = cleanNum && gid.endsWith(cleanNum.padStart(4, "0"));

        if ((matchesExact || matchesPrefix || matchesNum) && !results.some((r) => r.gridId === gid)) {
          const riskVal = feat.properties?.CIVORA_Scenario_Impact_All_Grids_baseline_prediction ?? 0;
          results.push({
            id: `grid-${gid}`,
            name: `Grid Cell ${gid}`,
            category: "grid",
            gridId: gid,
            tag: `Risk: ${(riskVal * 100).toFixed(1)}%`,
            badgeClass: riskVal > 0.4 ? "badge-hotspot" : "badge-grid",
            desc: `Spatial analysis unit ${gid}`,
            icon: "▦",
          });
          if (results.length >= 8) break;
        }
      }
    }

    // 3. Match from gridContextMap (Roads & Flood Spots)
    if (gridContextMap && results.length < 8) {
      for (const item of Object.values(gridContextMap)) {
        if (results.some((r) => r.gridId === item.grid_id)) continue;

        const matchedRoad = item.roads.find((r) => r.toUpperCase().includes(q));
        if (matchedRoad) {
          results.push({
            id: `road-${item.grid_id}-${matchedRoad}`,
            name: matchedRoad,
            category: "road",
            gridId: item.grid_id,
            tag: "Arterial Road",
            badgeClass: "badge-transit",
            desc: `Passes through ${item.grid_id}`,
            icon: "🛣️",
          });
          if (results.length >= 8) break;
          continue;
        }

        const matchedSpot = item.flood_spots.find((s) => s.toUpperCase().includes(q));
        if (matchedSpot) {
          const cleanSpot = matchedSpot.replace(/\(Delete\)/gi, "").trim();
          results.push({
            id: `spot-${item.grid_id}-${matchedSpot}`,
            name: cleanSpot,
            category: "flood_spot",
            gridId: item.grid_id,
            tag: "BMC Flood Spot",
            badgeClass: "badge-hotspot",
            desc: `Historical waterlogging in ${item.grid_id}`,
            icon: "💧",
          });
          if (results.length >= 8) break;
        }
      }
    }

    return results.slice(0, 8);
  }, [searchQuery, gridData, gridContextMap]);

  /* Select Landmark and Fly to it */
  const handleSelectLandmark = useCallback(
    (item: { gridId: string; lat?: number; lng?: number; name: string }) => {
      onGridSelect?.(item.gridId);
      setSearchError("");
      setIsSearchOpen(false);
      setSearchQuery(item.name);

      let targetCenter: [number, number] | null =
        item.lat && item.lng ? [item.lat, item.lng] : null;

      if (!targetCenter && gridData) {
        const feat = gridData.features.find((f) => f.properties?.grid_id === item.gridId);
        if (feat?.geometry) {
          if (feat.geometry.type === "Polygon") {
            const coords = feat.geometry.coordinates[0];
            let latSum = 0,
              lngSum = 0;
            coords.forEach((c) => {
              lngSum += c[0];
              latSum += c[1];
            });
            targetCenter = [latSum / coords.length, lngSum / coords.length];
          }
        }
      }

      if (targetCenter) {
        setSearchFlyTarget({
          center: targetCenter,
          zoom: 16,
          timestamp: Date.now(),
        });
      }
    },
    [gridData, onGridSelect]
  );

  /* Handle Grid Search Submit */
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");

    if (!searchQuery.trim()) {
      setIsSearchOpen(true);
      return;
    }

    if (searchSuggestions.length > 0) {
      handleSelectLandmark(searchSuggestions[0]);
      return;
    }

    // Direct grid ID fallback
    const formatted = searchQuery.trim().toUpperCase();
    const cleanNum = formatted.replace(/[^0-9]/g, "");
    const validGrid = gridData?.features.find((f) => {
      const gid = f.properties?.grid_id.toUpperCase();
      return (
        gid === formatted ||
        gid === `KE_G_${cleanNum.padStart(4, "0")}`
      );
    });

    if (validGrid) {
      handleSelectLandmark({
        name: `Grid Cell ${validGrid.properties.grid_id}`,
        gridId: validGrid.properties.grid_id,
      });
      return;
    }

    setSearchError(`'${searchQuery}' not found in K/East Ward grids or landmarks.`);
  };

  /* Get Style for Grid Cells */
  const getFeatureStyle = useCallback(
    (feature: Feature<Geometry, ScenarioProperties> | undefined) => {
      const props = feature?.properties as ScenarioProperties;
      const isSelected = props?.grid_id === selectedGridId;

      let fillColor = "#1e293b";

      if (activeLayer === "scenario") {
        const dominant = props?.CIVORA_Scenario_Impact_All_Grids_dominant_scenario;
        if (dominant === "NDVI +20%") fillColor = "#22d3ee"; // Sponge City (Cyan)
        else if (dominant === "Road Density -20%") fillColor = "#3b82f6"; // Porous Road (Electric Blue)
        else if (dominant === "Building Density -20%") fillColor = "#7c5cff"; // Setback Buffer (Violet)
      } else if (activeLayer === "baseline") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_baseline_prediction ?? 0;
        if (val < 0.15) fillColor = "#22d3ee"; // Low Risk: Cyan
        else if (val < 0.35) fillColor = "#3b82f6"; // Moderate Risk: Electric Blue
        else if (val < 0.55) fillColor = "#7c5cff"; // High Risk: Violet
        else fillColor = "#f87171"; // Severe/Critical Hotspot: Warning Coral
      } else if (activeLayer === "ndvi") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_ndvi_change ?? 0;
        if (val < -0.05) fillColor = "#3b82f6";
        else if (val < 0) fillColor = "#22d3ee";
        else if (val < 0.05) fillColor = "#7c5cff";
        else fillColor = "#f87171";
      } else if (activeLayer === "road") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_road_change ?? 0;
        if (val < -0.05) fillColor = "#3b82f6";
        else if (val < 0) fillColor = "#22d3ee";
        else if (val < 0.05) fillColor = "#7c5cff";
        else fillColor = "#f87171";
      } else if (activeLayer === "building") {
        const val = props?.CIVORA_Scenario_Impact_All_Grids_building_change ?? 0;
        if (val < -0.05) fillColor = "#3b82f6";
        else if (val < 0) fillColor = "#22d3ee";
        else if (val < 0.05) fillColor = "#7c5cff";
        else fillColor = "#f87171";
      } else if (activeLayer === "difference") {
        let diff = 0;
        if (selectedScenario === "NDVI +20%") {
          diff = props?.CIVORA_Scenario_Impact_All_Grids_ndvi_change ?? 0;
        } else if (selectedScenario === "Road Density -20%") {
          diff = props?.CIVORA_Scenario_Impact_All_Grids_road_change ?? 0;
        } else if (selectedScenario === "Building Density -20%") {
          diff = props?.CIVORA_Scenario_Impact_All_Grids_building_change ?? 0;
        }
        if (diff < -0.03) fillColor = "#3b82f6";
        else if (diff < 0) fillColor = "#22d3ee";
        else if (diff === 0) fillColor = "#64748b";
        else if (diff < 0.03) fillColor = "#7c5cff";
        else fillColor = "#f87171";
      }

      if (isSelected) {
        return {
          color: "#22d3ee",
          weight: 3.5,
          opacity: 1,
          fillColor: fillColor,
          fillOpacity: 0.88,
          dashArray: undefined,
        };
      }

      return {
        color: "rgba(148, 163, 184, 0.22)",
        weight: 1,
        opacity: 0.8,
        fillColor: fillColor,
        fillOpacity: 0.62,
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
        {/* Search Container with Live Landmark Autocomplete */}
        <div className="map-search-container" ref={searchContainerRef}>
          <form className="map-search-form" onSubmit={handleSearchSubmit}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search Landmark, Metro, Road, or Grid..."
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
                setSearchError("");
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery("");
                  setSearchError("");
                  setIsSearchOpen(false);
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
            <button type="submit" className="search-submit-btn">
              Go
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && (
            <div className="search-suggestions-dropdown">
              <div className="suggestions-header">
                {searchQuery.trim()
                  ? `Matching Locations (${searchSuggestions.length})`
                  : "Popular K/East Landmarks & Corridors"}
              </div>
              <div className="suggestions-list">
                {searchSuggestions.length > 0 ? (
                  searchSuggestions.map((item) => (
                    <div
                      key={item.id}
                      className="search-suggestion-item"
                      onClick={() => handleSelectLandmark(item)}
                    >
                      <span className="suggestion-icon">{item.icon}</span>
                      <div className="suggestion-details">
                        <div className="suggestion-title-row">
                          <span className="suggestion-name">{item.name}</span>
                          <span className={`suggestion-badge ${item.badgeClass || ""}`}>
                            {item.tag}
                          </span>
                        </div>
                        <div className="suggestion-meta">
                          <span className="suggestion-grid">{item.gridId}</span>
                          {item.desc && <span className="suggestion-desc">• {item.desc}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="suggestion-empty">
                    No landmarks found for "{searchQuery}". Try "Saki Naka", "Airport", "WEH", "Milan", or "0024".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Warning / Error Message */}
          {searchError && (
            <div className="map-search-warning">
              <span>⚠️ {searchError}</span>
              <button
                type="button"
                className="warning-dismiss-btn"
                onClick={() => setSearchError("")}
                title="Dismiss warning"
              >
                ✕
              </button>
            </div>
          )}
        </div>

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
            searchFlyTarget={searchFlyTarget}
          />
        </div>
      ) : (
        <>
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
          searchFlyTarget={searchFlyTarget}
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
              <span className="legend-box" style={{ background: "#22d3ee" }}></span>
              <span>NDVI +20% (Vegetation)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#3b82f6" }}></span>
              <span>Road Density -20%</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#7c5cff" }}></span>
              <span>Building Density -20%</span>
            </div>
          </div>
        )}

        {activeLayer === "baseline" && (
          <div className="legend-items">
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#22d3ee" }}></span>
              <span>&lt; 15% (Low Risk)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#3b82f6" }}></span>
              <span>15% – 35% (Moderate Risk)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#7c5cff" }}></span>
              <span>35% – 55% (High Risk)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#f87171" }}></span>
              <span>&gt; 55% (Severe Hotspot)</span>
            </div>
          </div>
        )}

        {(activeLayer === "ndvi" ||
          activeLayer === "road" ||
          activeLayer === "building" ||
          activeLayer === "difference") && (
          <div className="legend-items">
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#3b82f6" }}></span>
              <span>&lt; -5.0 pp (Strong Reduction)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#22d3ee" }}></span>
              <span>-5.0 pp to 0 (Moderate Reduction)</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#64748b" }}></span>
              <span>Neutral / Negligible</span>
            </div>
            <div className="legend-row">
              <span className="legend-box" style={{ background: "#f87171" }}></span>
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
