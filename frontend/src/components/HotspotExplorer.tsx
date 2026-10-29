import React, { useState, useMemo } from "react";
import type { HotspotItem } from "../types/civora";

interface HotspotExplorerProps {
  hotspots: HotspotItem[];
  selectedGridId: string;
  onSelectGrid: (gridId: string) => void;
  onExploreSHAP?: (gridId: string) => void;
}

export const HotspotExplorer: React.FC<HotspotExplorerProps> = ({
  hotspots,
  selectedGridId,
  onSelectGrid,
  onExploreSHAP,
}) => {
  const [filterText, setFilterText] = useState("");
  const [selectedMagnitude, setSelectedMagnitude] = useState<string>("ALL");

  const filteredHotspots = useMemo(() => {
    return hotspots.filter((item) => {
      const matchesSearch =
        item.grid_id.toLowerCase().includes(filterText.toLowerCase()) ||
        (item.roads && item.roads.some((r) => r.toLowerCase().includes(filterText.toLowerCase()))) ||
        (item.flood_spots && item.flood_spots.some((s) => s.toLowerCase().includes(filterText.toLowerCase())));

      const matchesMagnitude =
        selectedMagnitude === "ALL" || item.impact_magnitude === selectedMagnitude;

      return matchesSearch && matchesMagnitude;
    });
  }, [hotspots, filterText, selectedMagnitude]);

  return (
    <div className="hotspot-explorer panel">
      <div className="panel-header">
        <div>
          <span className="section-label">PREDICTIVE RISK RANKING</span>
          <h3>Ranked Flood Hotspot Explorer</h3>
          <p className="panel-desc">
            Grid cells with highest predicted baseline flood vulnerability across K/East Ward, derived from the trained XGBoost model.
          </p>
        </div>
        <div className="hotspot-stats-badge">
          <span>TOP HOTSPOTS</span>
          <strong>{filteredHotspots.length} Cells</strong>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="hotspot-toolbar">
        <div className="hotspot-search">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search by Grid ID or Street (e.g. JVLR, Milan Subway)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          {filterText && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setFilterText("")}
            >
              ×
            </button>
          )}
        </div>

        <div className="magnitude-filters">
          <span>Filter by Impact:</span>
          {["ALL", "Very High", "High", "Moderate", "Low"].map((mag) => (
            <button
              key={mag}
              type="button"
              className={`filter-chip ${selectedMagnitude === mag ? "active" : ""}`}
              onClick={() => setSelectedMagnitude(mag)}
            >
              {mag}
            </button>
          ))}
        </div>
      </div>

      {/* Hotspots Table */}
      <div className="hotspot-table-wrapper">
        <table className="hotspot-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Grid ID</th>
              <th>Baseline Flood Risk</th>
              <th>Location / Verified Landmarks</th>
              <th>Dominant Scenario</th>
              <th>Impact Magnitude</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHotspots.slice(0, 25).map((item) => {
              const isSelected = item.grid_id === selectedGridId;
              const probPct = (item.baseline_prediction * 100).toFixed(1);

              return (
                <tr
                  key={item.grid_id}
                  className={`hotspot-row ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectGrid(item.grid_id)}
                >
                  <td className="hotspot-rank">
                    <span className={`rank-badge ${item.rank <= 3 ? "top-three" : ""}`}>
                      #{item.rank}
                    </span>
                  </td>
                  <td className="hotspot-grid-id">
                    <strong>{item.grid_id}</strong>
                  </td>
                  <td className="hotspot-risk">
                    <div className="risk-bar-container">
                      <div
                        className="risk-bar-fill"
                        style={{
                          width: `${Math.min(100, item.baseline_prediction * 100)}%`,
                          backgroundColor:
                            item.baseline_prediction > 0.4
                              ? "#ef4444"
                              : item.baseline_prediction > 0.2
                              ? "#f97316"
                              : "#facc15",
                        }}
                      />
                    </div>
                    <span className="risk-number">{probPct}%</span>
                  </td>
                  <td className="hotspot-location">
                    {item.flood_spots && item.flood_spots.length > 0 && (
                      <span className="location-warning-tag" title="Official BMC Flood Spot">
                        ⚠️ {item.flood_spots[0]}
                      </span>
                    )}
                    {item.roads && item.roads.length > 0 ? (
                      <span className="location-road-text">
                        {item.roads.slice(0, 2).join(", ")}
                        {item.roads.length > 2 ? ` +${item.roads.length - 2} more` : ""}
                      </span>
                    ) : (
                      <span className="location-generic">K/East Interior</span>
                    )}
                  </td>
                  <td className="hotspot-scenario">
                    <span className="dominant-scenario-chip">
                      {item.dominant_scenario}
                    </span>
                  </td>
                  <td className="hotspot-magnitude">
                    <span className={`magnitude-pill ${item.impact_magnitude.toLowerCase().replace(" ", "-")}`}>
                      {item.impact_magnitude}
                    </span>
                  </td>
                  <td className="hotspot-actions">
                    <button
                      type="button"
                      className="btn-focus-map"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectGrid(item.grid_id);
                        document.getElementById("digital-twin")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      title="Inspect cell on Digital Twin map"
                    >
                      Focus Map ◈
                    </button>
                    {onExploreSHAP && (
                      <button
                        type="button"
                        className="btn-explain-row"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectGrid(item.grid_id);
                          onExploreSHAP(item.grid_id);
                        }}
                        title="View SHAP feature contributions"
                      >
                        Explain ✦
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredHotspots.length === 0 && (
              <tr>
                <td colSpan={7} className="hotspot-empty">
                  No flood hotspots matched the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filteredHotspots.length > 25 && (
        <div className="hotspot-footer-note">
          Showing top 25 of {filteredHotspots.length} filtered hotspot cells. Use search or filters to narrow results.
        </div>
      )}
    </div>
  );
};

export default HotspotExplorer;
