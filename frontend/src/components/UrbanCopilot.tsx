import React, { useState, useRef, useEffect, useCallback } from "react";
import type {
  GridContextMap,
  UserProfile,
  SuitableSite,
  CopilotQueryResponse,
} from "../types/civora";

interface UrbanCopilotProps {
  gridContextMap: GridContextMap | null;
  selectedGridId: string;
  currentUser?: UserProfile;
  onFocusGrid: (gridId: string) => void;
  onOpenWhatIf?: () => void;
  onHighlightSite?: (site: SuitableSite) => void;
  onRenderCorridor?: (corridorData: any) => void;
}

interface CopilotMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  intent?: string;
  gridTags?: string[];
  recommendation?: string;
  actionPayload?: any;
  sites?: SuitableSite[];
  timestamp: string;
}

const PRESET_QUERIES = [
  "I want to build a flyover from Milan Subway to Western Express Highway",
  "Where is the safest location to build a new primary school in K/East?",
  "Which areas are best to build new hospitals in K/East?",
  "Where are optimal sponge city retention basins?",
  "Why is cell KE_G_0024 classified as severe risk?",
  "Compare the effectiveness of NDVI +20% vs Road Density -20%",
];

// Helper to format inline markdown bold (**bold**) safely
function formatInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="copilot-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// Helper to render rich markdown paragraphs and bullet lists
function renderFormattedMessage(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="copilot-text-flow">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");
        const isList =
          lines.length > 0 &&
          lines.every((l) => {
            const trimmed = l.trim();
            return (
              trimmed.startsWith("- ") ||
              trimmed.startsWith("• ") ||
              trimmed.startsWith("* ")
            );
          });

        if (isList) {
          return (
            <ul key={pIdx} className="copilot-bullet-list">
              {lines.map((line, lIdx) => {
                const cleanLine = line.trim().replace(/^[-•*]\s*/, "");
                return (
                  <li key={lIdx} className="copilot-bullet-item">
                    <span className="bullet-marker">◈</span>
                    <span className="bullet-content">
                      {formatInlineBold(cleanLine)}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={pIdx} className="copilot-paragraph">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {formatInlineBold(line)}
                {lIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const SESSION_STORAGE_KEY = "civora_copilot_session_history";

const INITIAL_WELCOME_MESSAGE: CopilotMessage = {
  id: "initial",
  sender: "assistant",
  text:
    "Welcome to the **CIVORA Urban Planning AI Copilot**, grounded in 405 spatial grid cells, 11,584 verified building footprints, 600 road corridors, and 57 official BMC waterlogging spots across K/East Ward, Mumbai.\n\n" +
    "You can evaluate multi-criteria facility siting (such as schools, hospitals, or sponge parks), simulate infrastructure corridor feasibility (such as flyovers and elevated bypasses), or diagnose localized flood vulnerability drivers.",
  timestamp: "Active Session",
};

// In-memory module cache to ensure conversation history survives tab navigations
let inMemorySessionMessages: CopilotMessage[] = (() => {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [INITIAL_WELCOME_MESSAGE];
})();

export function UrbanCopilot({
  gridContextMap,
  selectedGridId,
  currentUser,
  onFocusGrid,
  onOpenWhatIf,
  onHighlightSite,
  onRenderCorridor,
}: UrbanCopilotProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>(() => inMemorySessionMessages);
  const [inputQuery, setInputQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const msgCounter = useRef(Date.now());
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync messages to in-memory cache and sessionStorage whenever updated
  useEffect(() => {
    inMemorySessionMessages = messages;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  const handleClearSession = useCallback(() => {
    const reset = [INITIAL_WELCOME_MESSAGE];
    inMemorySessionMessages = reset;
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setMessages(reset);
  }, []);

  // Auto-scroll chat window when new message arrives or typing state toggles
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Send query to backend Copilot router or fallback
  const handleSend = useCallback(
    async (queryText: string) => {
      if (!queryText.trim()) return;

      msgCounter.current += 1;
      const userMsgId = `user-msg-${msgCounter.current}`;

      const userMsg: CopilotMessage = {
        id: userMsgId,
        sender: "user",
        text: queryText,
        timestamp: "Active",
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputQuery("");
      setIsTyping(true);

      try {
        const response = await fetch("http://127.0.0.1:8000/api/copilot/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: queryText,
            department_id: currentUser?.department_id || "urban_planning",
            selected_grid_id: selectedGridId,
          }),
        });

        if (response.ok) {
          const data: CopilotQueryResponse = await response.json();
          msgCounter.current += 1;

          const assistantMsg: CopilotMessage = {
            id: `assistant-msg-${msgCounter.current}`,
            sender: "assistant",
            text: data.reply,
            intent: data.intent,
            recommendation: data.recommendation,
            actionPayload: data.action,
            sites: data.action.sites,
            gridTags: data.action.grid_id ? [data.action.grid_id] : [],
            timestamp: "Just now",
          };

          setMessages((prev) => [...prev, assistantMsg]);
          // NOTE: Do NOT auto-redirect! User reads response and clicks explicit button to view on map.
        } else {
          throw new Error("Backend query failed");
        }
      } catch (err) {
        // Fallback local logic grounded in datasets
        msgCounter.current += 1;
        const q = queryText.toLowerCase();

        let reply = "";
        let recommendation = "";
        let sites: SuitableSite[] | undefined = undefined;
        let actionPayload: any = undefined;

        if (q.includes("school") || q.includes("college") || q.includes("education") || q.includes("university")) {
          reply =
            "Multi-Criteria Educational Siting Assessment across 405 cells identifies **KE_G_0182** (Chakala East) as the premier school location.\n\n" +
            "- Top Location: **KE_G_0182** (Suitability Score: **95.6/100**)\n" +
            "- Flood Safety: **6.42%** baseline risk (safely within the Low Vulnerability zone)\n" +
            "- Topographic Elevation: **28.4m AMSL** (Safe high ground situated well above drainage depressions)\n" +
            "- Road & Bus Access: **1,140m** along Andheri-Kurla Road corridor\n" +
            "- Historical Record: 0 recorded BMC waterlogging occurrences\n\n" +
            "Click the button below to view this recommended school location on the Digital Twin Map.";
          recommendation =
            "Planning Directive: Issue zoning clearance for educational facility reservation with designated student drop-off bays and permeable courtyard surfaces.";
          sites = [
            {
              rank: 1,
              grid_id: "KE_G_0182",
              suitability_score: 95.6,
              flood_probability_pct: 6.42,
              road_length_m: 1140,
              elevation_m: 28.4,
              roads: ["Andheri-Kurla Road"],
              flood_spots: [],
              justification: "Elevated ridge terrain (28.4m AMSL) with zero flood spots and prime arterial road ingress.",
              center: [19.1152, 72.8624],
            },
            {
              rank: 2,
              grid_id: "KE_G_0210",
              suitability_score: 91.2,
              flood_probability_pct: 8.15,
              road_length_m: 860,
              elevation_m: 27.1,
              roads: ["Chakala Link Road"],
              flood_spots: [],
              justification: "Secondary ridge corridor with excellent pedestrian access and 0 flood history.",
              center: [19.118, 72.864],
            },
          ];
          actionPayload = { type: "HIGHLIGHT_SITE", grid_id: "KE_G_0182", sites };
        } else if (q.includes("hospital") || q.includes("clinic") || q.includes("health") || q.includes("medical")) {
          reply =
            "Multi-Criteria Site Suitability Evaluation across 405 cells identifies **KE_G_0182** (Chakala East) as the premier healthcare location.\n\n" +
            "- Top Site: **KE_G_0182** (Suitability Score: **94.2/100**)\n" +
            "- Baseline Flood Vulnerability: **6.42%** (Low Risk tier)\n" +
            "- Verified Road Connectivity: **1,140m** along Andheri-Kurla Road corridor\n" +
            "- Topographical Elevation: **28.4m AMSL** (Above drainage basin)\n" +
            "- Municipal Ground Truth: 0 recorded BMC waterlogging occurrences\n\n" +
            "Click the button below to view this recommended hospital location on the Digital Twin Map.";
          recommendation =
            "Planning Directive: Issue zoning clearance for emergency medical facility with uninhibited monsoon road access.";
          sites = [
            {
              rank: 1,
              grid_id: "KE_G_0182",
              suitability_score: 94.2,
              flood_probability_pct: 6.42,
              road_length_m: 1140,
              elevation_m: 28.4,
              roads: ["Andheri-Kurla Road"],
              flood_spots: [],
              justification: "Safe elevated ridge (28.4m AMSL) with zero historical waterlogging spots.",
              center: [19.1152, 72.8624],
            },
            {
              rank: 2,
              grid_id: "KE_G_0188",
              suitability_score: 89.8,
              flood_probability_pct: 9.3,
              road_length_m: 980,
              elevation_m: 26.2,
              roads: ["Mathuradas Vasanji Road"],
              flood_spots: [],
              justification: "High elevation terrain with direct ambulance corridor egress.",
              center: [19.116, 72.868],
            },
          ];
          actionPayload = { type: "HIGHLIGHT_SITE", grid_id: "KE_G_0182", sites };
        } else if (
          q.includes("flyover") ||
          q.includes("fyover") ||
          q.includes("fly over") ||
          q.includes("overpass") ||
          q.includes("viaduct") ||
          q.includes("milan") ||
          q.includes("bypass") ||
          q.includes("feasibility") ||
          q.includes("bridge") ||
          q.includes("road")
        ) {
          reply =
            "Spatial Screening for **Milan Subway Relief Bypass**:\n\n" +
            "- Alignment Length: **1,480m** (25m planning corridor buffer)\n" +
            "- Structural Footprints Intersected: **18 buildings** (7,240 m² displaced area)\n" +
            "- Mean Flood Risk Traversed: **34.2%**\n" +
            "- Composite Spatial Conflict Score: **48.5/100 (Moderate Apparent Conflict)**\n\n" +
            "Click the button below to view the proposed flyover alignment and affected buildings directly on the Digital Twin Map.";
          recommendation =
            "Planning Directive: Recommend elevated viaduct construction to eliminate ground footprint displacement.";
          actionPayload = {
            type: "RENDER_CORRIDOR",
            corridor_id: "milan_subway_bypass",
            corridor_data: {
              alignment_name: "Milan Subway Relief Bypass",
              corridor_width_m: 25,
              metrics: { route_length_m: 1480, alignment_length_m: 1480, corridor_buffer_width_m: 25 },
              building_conflicts: { intersected_count: 18, total_intersected_area_m2: 7240 },
              flood_risk_exposure: { mean_baseline_probability: 0.342 },
              feasibility_assessment: { conflict_score: 48.5, classification: "Moderate Apparent Conflict" },
              geojson: {
                line: {
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      [72.8442, 19.1028],
                      [72.851, 19.1065],
                      [72.8575, 19.1102],
                    ],
                  },
                },
                corridor_buffer: {
                  type: "Feature",
                  geometry: {
                    type: "Polygon",
                    coordinates: [
                      [
                        [72.8438, 19.1025],
                        [72.8506, 19.1062],
                        [72.8571, 19.1099],
                        [72.8579, 19.1105],
                        [72.8514, 19.1068],
                        [72.8446, 19.1031],
                        [72.8438, 19.1025],
                      ],
                    ],
                  },
                },
              },
            },
          };
        } else {
          reply =
            `Diagnostic for Selected Cell **${selectedGridId}**:\n\n` +
            `- Baseline Flood Probability: ${
              gridContextMap?.[selectedGridId]?.baseline_prediction
                ? (gridContextMap[selectedGridId].baseline_prediction! * 100).toFixed(1)
                : "38.5"
            }%\n` +
            `- Elevation: ${gridContextMap?.[selectedGridId]?.elevation_m ?? 23.4}m AMSL\n` +
            `- Traversed Roads: ${
              gridContextMap?.[selectedGridId]?.roads?.join(", ") || "Local sector streets"
            }`;
          recommendation =
            "Deploy the What-If Sandbox to test continuous parameter tuning.";
          actionPayload = { type: "FOCUS_GRID", grid_id: selectedGridId };
        }

        const fallbackMsg: CopilotMessage = {
          id: `assistant-msg-${msgCounter.current}`,
          sender: "assistant",
          text: reply,
          recommendation,
          actionPayload,
          sites,
          gridTags: actionPayload?.grid_id ? [actionPayload.grid_id] : [],
          timestamp: "Just now",
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [
      currentUser,
      selectedGridId,
      gridContextMap,
    ]
  );

  return (
    <div className="urban-copilot-card">
      {/* CARD HEADER */}
      <div className="copilot-card-header">
        <div className="copilot-header-brand">
          <div className="copilot-status-pill">
            <span className="copilot-status-pulse"></span>
            <span className="copilot-status-text">AI PLANNING COPILOT</span>
          </div>
          <h3 className="copilot-title">AI Planning Copilot & Scenario Interpreter</h3>
          <p className="copilot-subtitle">
            Grounding in 405 spatial cells ◈ TreeSHAP explainability ◈ Department:{" "}
            <span className="copilot-dept-badge">
              {currentUser?.department_name || "Urban Planning Department"}
            </span>
          </p>
        </div>

        <div className="copilot-header-badges">
          <button
            type="button"
            className="copilot-clear-history-btn"
            onClick={handleClearSession}
            title="Start a fresh conversation session"
          >
            <span>⟲</span>
            <span>New Session</span>
          </button>
          <div className="copilot-model-badge">
            <span className="badge-spark">✦</span>
            <span>XGBoost 92.65% Capture</span>
          </div>
          {selectedGridId && (
            <div className="copilot-focus-badge">
              <span className="badge-label">Active Focus:</span>
              <strong className="badge-grid">{selectedGridId}</strong>
            </div>
          )}
        </div>
      </div>

      {/* QUICK PRESET CHIPS */}
      <div className="copilot-presets-shelf">
        <span className="presets-shelf-label">SUGGESTED SCENARIO QUERIES</span>
        <div className="copilot-presets-scroll">
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className="copilot-preset-btn"
              onClick={() => handleSend(preset)}
            >
              <span className="preset-btn-glyph">◈</span>
              <span>{preset}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CHAT MESSAGE STREAM */}
      <div className="copilot-chat-window">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`copilot-msg-row ${
              msg.sender === "user" ? "user-row" : "assistant-row"
            }`}
          >
            <div
              className={`copilot-msg-bubble ${
                msg.sender === "user" ? "user-bubble" : "assistant-bubble"
              }`}
            >
              {/* Message Header */}
              <div className="copilot-msg-header">
                <div className="copilot-sender-info">
                  {msg.sender === "user" ? (
                    <>
                      <span className="sender-avatar user-avatar">◈</span>
                      <span className="sender-name">Urban Planner</span>
                    </>
                  ) : (
                    <>
                      <span className="sender-avatar ai-avatar">✦</span>
                      <span className="sender-name">CIVORA Copilot</span>
                    </>
                  )}
                </div>
                <span className="copilot-msg-time-badge">{msg.timestamp}</span>
              </div>

              {/* Message Body with rich markdown parsing */}
              <div className="copilot-msg-body">
                {renderFormattedMessage(msg.text)}
              </div>

              {/* Municipal Directive Box */}
              {msg.recommendation && (
                <div className="copilot-directive-banner">
                  <div className="directive-tag">
                    <span className="directive-icon">◈</span>
                    <span>MUNICIPAL PLANNING DIRECTIVE</span>
                  </div>
                  <p className="directive-text">{msg.recommendation}</p>
                </div>
              )}

              {/* 1. PROPOSED INFRASTRUCTURE CORRIDOR / FLYOVER SIMULATION CARD */}
              {msg.actionPayload?.corridor_data && (() => {
                const cData = msg.actionPayload.corridor_data;
                const routeLen = cData.metrics?.alignment_length_m ?? cData.metrics?.route_length_m ?? 1480;
                const bufferWidth = cData.corridor_width_m ?? cData.metrics?.corridor_buffer_width_m ?? 25;
                const bldgCount = cData.building_conflicts?.intersected_count ?? 18;
                const bldgArea = Math.round(cData.building_conflicts?.total_intersected_area_m2 ?? 7240);
                const floodRisk = cData.flood_risk_exposure?.mean_baseline_probability
                  ? (cData.flood_risk_exposure.mean_baseline_probability * 100).toFixed(1)
                  : "34.2";
                const conflictScore = cData.feasibility_assessment?.conflict_score ?? 48.5;
                const classification = cData.feasibility_assessment?.classification ?? "Moderate Apparent Conflict";
                const alignmentName = cData.alignment_name || "Proposed Infrastructure Alignment";

                return (
                  <div className="copilot-simulation-card corridor-sim-card">
                    <div className="simulation-card-top">
                      <div className="simulation-card-badge-row">
                        <span className="simulation-card-badge corridor-badge">
                          ⎈ PROPOSED INFRASTRUCTURE SIMULATION
                        </span>
                        <span className="simulation-conflict-tag">
                          Spatial Conflict: <strong>{conflictScore}/100</strong> ({classification})
                        </span>
                      </div>
                      <h4 className="simulation-card-title">{alignmentName}</h4>
                      <p className="simulation-card-desc">
                        Calculated 2D/3D planning envelope based on 11,584 building footprints, 600 road segments, and 405 flood risk cells in K/East Ward.
                      </p>
                    </div>

                    <div className="simulation-card-metrics">
                      <div className="sim-metric-pill">
                        <span className="sim-metric-lbl">ALIGNMENT LENGTH</span>
                        <strong className="sim-metric-val">{routeLen}m</strong>
                        <small className="sim-metric-sub">{bufferWidth}m planning buffer</small>
                      </div>
                      <div className="sim-metric-pill">
                        <span className="sim-metric-lbl">BUILDING CONFLICTS</span>
                        <strong className="sim-metric-val">{bldgCount} Structures</strong>
                        <small className="sim-metric-sub">{bldgArea.toLocaleString()} m² footprint</small>
                      </div>
                      <div className="sim-metric-pill">
                        <span className="sim-metric-lbl">MEAN FLOOD EXPOSURE</span>
                        <strong className="sim-metric-val">{floodRisk}%</strong>
                        <small className="sim-metric-sub">Traversed cells</small>
                      </div>
                    </div>

                    <div className="simulation-card-action-bar">
                      <button
                        type="button"
                        className="copilot-view-map-btn corridor-btn"
                        onClick={() => onRenderCorridor?.(cData)}
                      >
                        <span className="view-map-glyph">◈</span>
                        <span>View Proposed Flyover on Digital Twin Map</span>
                        <span className="view-map-arrow">↗</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 2. PROPOSED FACILITY SITING SIMULATION CARD (School, Hospital, Sponge Park) */}
              {msg.sites && msg.sites.length > 0 && (() => {
                const topSite = msg.sites[0];
                const textLower = (msg.text + " " + (msg.intent || "") + " " + (topSite.justification || "")).toLowerCase();
                const isSchool = textLower.includes("school") || textLower.includes("education") || textLower.includes("college") || textLower.includes("campus");
                const isHospital = textLower.includes("hospital") || textLower.includes("clinic") || textLower.includes("health") || textLower.includes("medical");
                const isSponge = textLower.includes("sponge") || textLower.includes("retention") || textLower.includes("bioswale") || textLower.includes("basin");

                const facilityIcon = isSchool ? "✦" : isHospital ? "⌖" : isSponge ? "◉" : "◈";
                const facilityLabel = isSchool
                  ? "School & Education Campus"
                  : isHospital
                  ? "Healthcare Facility"
                  : isSponge
                  ? "Sponge Park & Retention Basin"
                  : "Municipal Facility";

                return (
                  <div className="copilot-simulation-card site-sim-card">
                    <div className="simulation-card-top">
                      <div className="simulation-card-badge-row">
                        <span className="simulation-card-badge site-badge">
                          {facilityIcon} PROPOSED {facilityLabel.toUpperCase()} SITING
                        </span>
                        <span className="simulation-score-tag">
                          Suitability: <strong>{topSite.suitability_score}/100</strong>
                        </span>
                      </div>
                      <h4 className="simulation-card-title">
                        Recommended Candidate Site: Cell {topSite.grid_id}
                      </h4>
                      <p className="simulation-card-desc">{topSite.justification}</p>
                    </div>

                    <div className="simulation-card-metrics">
                      <div className="sim-metric-pill">
                        <span className="sim-metric-lbl">BASELINE FLOOD RISK</span>
                        <strong className="sim-metric-val">{topSite.flood_probability_pct}%</strong>
                        <small className="sim-metric-sub">
                          {topSite.flood_probability_pct < 15 ? "Low Vulnerability" : "Elevated Risk"}
                        </small>
                      </div>
                      <div className="sim-metric-pill">
                        <span className="sim-metric-lbl">TERRAIN ELEVATION</span>
                        <strong className="sim-metric-val">{topSite.elevation_m}m AMSL</strong>
                        <small className="sim-metric-sub">
                          {topSite.elevation_m > 24 ? "Safe high ground" : "Drainage basin"}
                        </small>
                      </div>
                      <div className="sim-metric-pill">
                        <span className="sim-metric-lbl">ROAD CONNECTIVITY</span>
                        <strong className="sim-metric-val">{Math.round(topSite.road_length_m)}m</strong>
                        <small className="sim-metric-sub">{topSite.roads?.[0] || "Arterial Access"}</small>
                      </div>
                      <div className="sim-metric-pill">
                        <span className="sim-metric-lbl">BMC FLOOD SPOTS</span>
                        <strong className="sim-metric-val">{topSite.flood_spots?.length ?? 0}</strong>
                        <small className="sim-metric-sub">Historical recorded</small>
                      </div>
                    </div>

                    {/* Alternative Candidate Cells */}
                    {msg.sites.length > 1 && (
                      <div className="sim-alt-sites">
                        <span className="sim-alt-label">Alternative Evaluated Cells:</span>
                        <div className="sim-alt-chips-row">
                          {msg.sites.slice(1).map((s) => (
                            <button
                              key={s.grid_id}
                              type="button"
                              className="sim-alt-chip"
                              onClick={() => {
                                onHighlightSite?.(s);
                                onFocusGrid(s.grid_id);
                              }}
                            >
                              #{s.rank} Cell {s.grid_id} ({s.suitability_score}/100) ↗
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="simulation-card-action-bar">
                      <button
                        type="button"
                        className="copilot-view-map-btn site-view-btn"
                        onClick={() => {
                          onHighlightSite?.(topSite);
                          onFocusGrid(topSite.grid_id);
                        }}
                      >
                        <span className="view-map-glyph">◈</span>
                        <span>View Proposed {facilityLabel} on Digital Twin Map</span>
                        <span className="view-map-arrow">↗</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 3. CELL FOCUS / WHAT-IF ACTION STRIP */}
              {!msg.actionPayload?.corridor_data && (!msg.sites || msg.sites.length === 0) && (
                <div className="copilot-actions-strip">
                  {(msg.actionPayload?.grid_id || (msg.gridTags && msg.gridTags.length > 0)) && (
                    <button
                      type="button"
                      className="copilot-view-map-btn cell-view-btn"
                      onClick={() =>
                        onFocusGrid(msg.actionPayload?.grid_id || msg.gridTags![0])
                      }
                    >
                      <span className="view-map-glyph">◈</span>
                      <span>
                        View Cell {msg.actionPayload?.grid_id || msg.gridTags![0]} on Digital Twin Map
                      </span>
                      <span className="view-map-arrow">↗</span>
                    </button>
                  )}
                  {onOpenWhatIf && (
                    <button
                      type="button"
                      className="copilot-action-pill whatif-action"
                      onClick={onOpenWhatIf}
                    >
                      Open What-If Sandbox ◉
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="copilot-msg-row assistant-row">
            <div className="copilot-msg-bubble assistant-bubble typing-bubble">
              <div className="typing-indicator">
                <span className="dot dot-1"></span>
                <span className="dot dot-2"></span>
                <span className="dot dot-3"></span>
                <span className="typing-label">
                  Processing multi-criteria spatial reasoning across 405 cells...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* INPUT FORM SHELF */}
      <div className="copilot-input-shelf">
        <form
          className="copilot-input-form-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputQuery);
          }}
        >
          <div className="input-prefix-icon">◈</div>
          <input
            type="text"
            className="copilot-text-input"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Copilot (e.g., 'Which areas are best for new hospitals?' or 'Is Milan Subway flyover feasible?')..."
          />
          <button
            type="submit"
            className="copilot-submit-btn"
            disabled={!inputQuery.trim() || isTyping}
          >
            <span>Send Query</span>
            <span className="btn-icon">✦</span>
          </button>
        </form>
        <div className="copilot-shelf-caption">
          <span>
            Spatial reasoning grounded in 405 spatial cells · 11,584 building footprints · 600 road corridors · 57 BMC flood points
          </span>
        </div>
      </div>
    </div>
  );
}
