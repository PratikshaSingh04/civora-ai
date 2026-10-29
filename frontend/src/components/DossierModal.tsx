import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { GridContextItem, ExplanationData } from "../types/civora";
import "leaflet/dist/leaflet.css";

interface DossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  gridId: string;
  gridContext: GridContextItem | null;
  explanation: ExplanationData | null;
}

/** Helper component to fit map bounds to the cell polygon */
function DossierMapController({
  center,
  polygon,
}: {
  center: [number, number];
  polygon: [number, number][] | null;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (polygon && polygon.length > 0) {
        map.fitBounds(polygon as any, { padding: [35, 35], maxZoom: 16 });
      } else {
        map.setView(center, 16);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [map, center, polygon]);

  return null;
}

export function DossierModal({
  isOpen,
  onClose,
  gridId,
  gridContext,
  explanation,
}: DossierModalProps) {
  const [cellPolygon, setCellPolygon] = useState<[number, number][] | null>(null);

  // Fetch cell polygon from GeoJSON if available
  useEffect(() => {
    if (!isOpen || !gridId) return;
    let isMounted = true;

    fetch("/data/K_East_CIVORA_Scenario_Decision_WGS84.geojson")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const feature = data.features?.find(
          (f: any) => f.properties?.grid_id === gridId
        );
        if (feature?.geometry?.coordinates) {
          const geomType = feature.geometry.type;
          let coords: [number, number][] = [];
          if (geomType === "MultiPolygon") {
            coords = feature.geometry.coordinates[0][0].map(
              ([lng, lat]: [number, number]) => [lat, lng]
            );
          } else if (geomType === "Polygon") {
            coords = feature.geometry.coordinates[0].map(
              ([lng, lat]: [number, number]) => [lat, lng]
            );
          }
          if (coords.length > 0) {
            setCellPolygon(coords);
          }
        }
      })
      .catch((err) =>
        console.warn("Could not load cell geometry for dossier:", err)
      );

    return () => {
      isMounted = false;
    };
  }, [isOpen, gridId]);

  // Clean print handler that triggers Chrome's native Save as PDF without blank pages
  const handlePrint = () => {
    document.title = `CIVORA_AI_Planning_Dossier_${gridId}`;
    document.body.classList.add("printing-dossier");

    // Give browser brief tick to apply printing class before dialog opens
    setTimeout(() => {
      window.print();
    }, 150);
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("printing-dossier");
      document.title = "CIVORA AI — Urban Digital Twin & Planning Decision Platform";
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  if (!isOpen) return null;

  const center: [number, number] = gridContext?.center || [19.113038, 72.865632];
  const probPct = gridContext?.baseline_prediction
    ? (gridContext.baseline_prediction * 100).toFixed(2)
    : "N/A";

  // Approximate 250m bounding box fallback if polygon not yet loaded
  const latDelta = 0.00113;
  const lngDelta = 0.00118;
  const fallbackBounds: [number, number][] = [
    [center[0] - latDelta, center[1] - lngDelta],
    [center[0] + latDelta, center[1] - lngDelta],
    [center[0] + latDelta, center[1] + lngDelta],
    [center[0] - latDelta, center[1] + lngDelta],
  ];

  return (
    <div className="dossier-modal-overlay" onClick={onClose}>
      <div
        className="dossier-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Toolbar */}
        <div className="dossier-toolbar">
          <span className="dossier-tag">OFFICIAL MUNICIPAL PLANNING DOSSIER</span>
          <div className="dossier-actions">
            <button
              type="button"
              className="print-btn"
              onClick={handlePrint}
              title="Save as PDF or Print Official Brief"
            >
              Print / Save PDF ◈
            </button>
            <button type="button" className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="printable-dossier" id="printable-dossier">
          {/* Header */}
          <div className="dossier-header">
            <div className="dossier-bmc-seal">
              <h3>MUNICIPAL CORPORATION OF GREATER MUMBAI (MCGM)</h3>
              <h4>K/East Ward Urban Resilience & Flood Decision-Support Platform</h4>
              <p className="dossier-meta">
                Study Area: K/East Ward (Andheri East), Mumbai · Model: XGBoost v1.0 · Coordinate System: WGS 84 (EPSG:4326)
              </p>
            </div>
            <div className="dossier-timestamp">
              <span>Date: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</span>
              <span>
                Cell ID: <strong>{gridId}</strong>
              </span>
            </div>
          </div>

          <hr className="dossier-divider" />

          {/* Section 1: Spatial Identification & Risk Assessment */}
          <div className="dossier-section">
            <div className="dossier-section-header">
              <h4>1. Spatial Identification & Risk Assessment</h4>
            </div>
            <div className="dossier-summary-grid">
              <div className="summary-stat">
                <span className="stat-label">BASELINE FLOOD PROBABILITY</span>
                <span className="stat-value severe">{probPct}%</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">DOMINANT MITIGATION SCENARIO</span>
                <span className="stat-value">
                  {gridContext?.dominant_scenario || "NDVI +20%"}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">TERRAIN ELEVATION</span>
                <span className="stat-value">
                  {gridContext?.elevation_m
                    ? `${gridContext.elevation_m.toFixed(1)} m AMSL`
                    : "24.0 m AMSL"}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">BMC HISTORICAL WATERLOGGING</span>
                <span className="stat-value">
                  {gridContext?.flood_spots && gridContext.flood_spots.length > 0
                    ? "VERIFIED HOTSPOT"
                    : "No Direct Alert"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Spatial Extents & Geospatial Digital Twin Map */}
          <div className="dossier-section dossier-map-section">
            <div className="dossier-section-header">
              <h4>2. Spatial Extents & Geospatial Digital Twin Map</h4>
              <span className="dossier-section-badge">
                EPSG:4326 · 250m × 250m Municipal Grid Cell
              </span>
            </div>

            <div className="dossier-map-card">
              {/* Map Telemetry Header */}
              <div className="dossier-map-telemetry">
                <div className="telemetry-item">
                  <span className="label">CENTROID COORDINATES</span>
                  <span className="value mono">
                    {center[0].toFixed(5)}° N, {center[1].toFixed(5)}° E
                  </span>
                </div>
                <div className="telemetry-item">
                  <span className="label">LOCAL ROAD NETWORK</span>
                  <span className="value">
                    {gridContext?.roads && gridContext.roads.length > 0
                      ? gridContext.roads.join(", ")
                      : "Local Municipal Arterial Network"}
                  </span>
                </div>
                <div className="telemetry-item">
                  <span className="label">HISTORICAL HOTSPOT ALERT</span>
                  <span
                    className={`value ${
                      gridContext?.flood_spots && gridContext.flood_spots.length > 0
                        ? "alert"
                        : "clear"
                    }`}
                  >
                    {gridContext?.flood_spots && gridContext.flood_spots.length > 0
                      ? `Alert: ${gridContext.flood_spots.join(", ")}`
                      : "No Direct Alert"}
                  </span>
                </div>
              </div>

              {/* Live & Printable Leaflet Map */}
              <div className="dossier-leaflet-wrapper">
                <MapContainer
                  center={center}
                  zoom={16}
                  scrollWheelZoom={false}
                  dragging={true}
                  className="dossier-map-element"
                >
                  <DossierMapController center={center} polygon={cellPolygon} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />

                  {/* Highlighted Cell Polygon Boundary */}
                  <Polygon
                    positions={cellPolygon && cellPolygon.length > 0 ? cellPolygon : fallbackBounds}
                    pathOptions={{
                      color: "#1d4ed8",
                      weight: 3.5,
                      fillColor: "#3b82f6",
                      fillOpacity: 0.28,
                    }}
                  >
                    <Tooltip permanent direction="center" className="dossier-cell-tooltip">
                      {gridId} ({probPct}%)
                    </Tooltip>
                  </Polygon>

                  {/* Centroid Pin Marker */}
                  <CircleMarker
                    center={center}
                    radius={6}
                    pathOptions={{
                      color: "#1e3a8a",
                      fillColor: "#38bdf8",
                      fillOpacity: 1,
                      weight: 2,
                    }}
                  />

                  {/* Nearby Waterlogging Spots if any */}
                  {gridContext?.flood_spots?.map((spot, idx) => (
                    <CircleMarker
                      key={idx}
                      center={[
                        center[0] + (idx === 0 ? 0.0003 : -0.0003),
                        center[1] + (idx === 0 ? 0.0004 : -0.0004),
                      ]}
                      radius={5}
                      pathOptions={{
                        color: "#991b1b",
                        fillColor: "#ef4444",
                        fillOpacity: 0.9,
                        weight: 1.5,
                      }}
                    >
                      <Tooltip permanent={false} direction="top">
                        BMC Hotspot: {spot}
                      </Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>

                {/* Map Legend Overlay */}
                <div className="dossier-map-legend">
                  <span className="legend-chip">
                    <span className="swatch cell-swatch"></span>
                    Target Cell Boundary ({gridId})
                  </span>
                  <span className="legend-chip">
                    <span className="swatch center-swatch"></span>
                    Centroid Pin
                  </span>
                  {gridContext?.flood_spots && gridContext.flood_spots.length > 0 && (
                    <span className="legend-chip">
                      <span className="swatch flood-swatch"></span>
                      BMC Waterlogging Spot
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Physical Urban Metrics */}
          <div className="dossier-section">
            <div className="dossier-section-header">
              <h4>3. Geospatial Feature Telemetry</h4>
            </div>
            <table className="dossier-table">
              <thead>
                <tr>
                  <th>Physical Feature</th>
                  <th>Value</th>
                  <th>Measurement Unit</th>
                  <th>Provenance / Sensor Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Building Footprint Area</td>
                  <td>
                    {gridContext?.building_area_m2
                      ? gridContext.building_area_m2.toFixed(1)
                      : "N/A"}
                  </td>
                  <td>Square Meters (m²)</td>
                  <td>Microsoft ML Building Footprints</td>
                </tr>
                <tr>
                  <td>Building Density Ratio</td>
                  <td>
                    {gridContext?.building_density
                      ? gridContext.building_density.toFixed(4)
                      : "N/A"}
                  </td>
                  <td>Footprint / Cell Area Ratio</td>
                  <td>GIS Vector Spatial Aggregation</td>
                </tr>
                <tr>
                  <td>Vegetation Canopy Index (NDVI)</td>
                  <td>
                    {gridContext?.ndvi_mean
                      ? gridContext.ndvi_mean.toFixed(4)
                      : "N/A"}
                  </td>
                  <td>Index (-1 to +1)</td>
                  <td>ESA Sentinel-2 L2A Multispectral</td>
                </tr>
                <tr>
                  <td>Road Network Length</td>
                  <td>
                    {gridContext?.road_length_m
                      ? gridContext.road_length_m.toFixed(1)
                      : "N/A"}
                  </td>
                  <td>Meters (m)</td>
                  <td>OpenStreetMap Verified Network</td>
                </tr>
                <tr>
                  <td>Road Density Ratio</td>
                  <td>
                    {gridContext?.road_density
                      ? gridContext.road_density.toFixed(4)
                      : "N/A"}
                  </td>
                  <td>Length / Cell Area Ratio</td>
                  <td>GIS Lineament Density</td>
                </tr>
                <tr>
                  <td>Terrain Elevation (idw250_mean)</td>
                  <td>
                    {gridContext?.elevation_m
                      ? gridContext.elevation_m.toFixed(2)
                      : "N/A"}
                  </td>
                  <td>Meters Above Sea Level (AMSL)</td>
                  <td>Open-Meteo 250m IDW Interpolation</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 4: SHAP Feature Attribution */}
          {explanation && (
            <div className="dossier-section">
              <div className="dossier-section-header">
                <h4>4. Explainable AI: Feature Contributions to Flood Probability</h4>
              </div>
              <p className="dossier-note">
                Computed via TreeSHAP in model log-odds space. Positive values increase predicted flood likelihood, negative values reduce risk.
              </p>
              <table className="dossier-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Measured Value</th>
                    <th>SHAP Contribution</th>
                    <th>Risk Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {explanation.features.map((f) => (
                    <tr key={f.feature}>
                      <td>
                        <strong>{f.feature}</strong>
                      </td>
                      <td>{f.value.toFixed(4)}</td>
                      <td>
                        {f.shap_value > 0
                          ? `+${f.shap_value.toFixed(4)}`
                          : f.shap_value.toFixed(4)}
                      </td>
                      <td>
                        <span className={`direction-badge ${f.direction}`}>
                          {f.direction.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 5: Policy Directive */}
          <div className="dossier-section">
            <div className="dossier-section-header">
              <h4>5. Municipal Policy & Intervention Directive</h4>
            </div>
            <div className="dossier-policy-box">
              <p>
                <strong>Priority Drainage Mandate:</strong> Given that cell{" "}
                <strong>{gridId}</strong> exhibits a baseline risk of{" "}
                <strong>{probPct}%</strong>, municipal engineering teams should
                inspect local storm drains and roadside gullies prior to June 1.
              </p>
              <p>
                <strong>Sponge Infrastructure Recommendation:</strong>{" "}
                Implementation of{" "}
                <strong>
                  {gridContext?.dominant_scenario || "NDVI +20%"}
                </strong>{" "}
                provides the highest modeled reduction in local flood probability.
                Retrofitting roadside pavers with porous asphalt and expanding verge
                bioswales is recommended.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="dossier-footer">
            <p>
              Generated by CIVORA AI Urban Digital Twin Platform · Academic &
              Municipal Decision-Support System · K/East Ward, Mumbai
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
