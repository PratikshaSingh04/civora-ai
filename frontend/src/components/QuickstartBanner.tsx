
interface QuickstartBannerProps {
  onSelectGoal: (goalType: "hotspots" | "hospital" | "flyover" | "sponge") => void;
  onDismiss: () => void;
}

export function QuickstartBanner({
  onSelectGoal,
  onDismiss,
}: QuickstartBannerProps) {
  return (
    <div className="quickstart-container">
      <div className="quickstart-header">
        <div className="quickstart-badge">
          <span className="pulse-indicator"></span>
          DECISION-SUPPORT ONBOARDING
        </div>
        <button
          type="button"
          className="quickstart-dismiss-btn"
          onClick={onDismiss}
          title="Dismiss Quickstart"
        >
          ✕
        </button>
      </div>

      <div className="quickstart-title-row">
        <h3>Select a Municipal Planning Objective</h3>
        <p>
          Calibrate the K/East Digital Twin to your operational focus. Select an objective below to
          automatically load verified datasets, run AI inference, and display spatial recommendations.
        </p>
      </div>

      <div className="quickstart-grid">
        <div
          className="quickstart-card"
          onClick={() => onSelectGoal("hotspots")}
        >
          <div className="card-top-icon purple">◈</div>
          <h4>Inspect Monsoon Flood Hotspots</h4>
          <p>
            Locate high-vulnerability basins including Milan Subway and Saki Naka. Review 57 official
            BMC waterlogging spots with 92.65% ML capture validation.
          </p>
          <span className="card-action-text">Launch Hotspot Inspection →</span>
        </div>

        <div
          className="quickstart-card"
          onClick={() => onSelectGoal("hospital")}
        >
          <div className="card-top-icon cyan">✦</div>
          <h4>Hospital & Healthcare Siting</h4>
          <p>
            Execute Multi-Criteria Evaluation (MCE) to identify flood-free cells with high arterial
            road connectivity and elevation above 22m AMSL.
          </p>
          <span className="card-action-text">Find Optimal Facility Sites →</span>
        </div>

        <div
          className="quickstart-card"
          onClick={() => onSelectGoal("flyover")}
        >
          <div className="card-top-icon amber">◉</div>
          <h4>Flyover & Corridor Feasibility</h4>
          <p>
            Evaluate proposed bypass corridors against 11,584 building footprints, 600 road segments,
            and compute composite spatial conflict scores.
          </p>
          <span className="card-action-text">Screen Proposed Corridors →</span>
        </div>

        <div
          className="quickstart-card"
          onClick={() => onSelectGoal("sponge")}
        >
          <div className="card-top-icon green">◫</div>
          <h4>Sponge City Policy Sandbox</h4>
          <p>
            Simulate the hydrological impact of 20% vegetation expansion (NDVI) and permeable road
            pavement across 405 municipal grid cells.
          </p>
          <span className="card-action-text">Open Scenario Simulator →</span>
        </div>
      </div>
    </div>
  );
}
