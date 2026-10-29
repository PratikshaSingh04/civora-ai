import { useState } from "react";
import type { DepartmentInfo, DepartmentRole, UserProfile } from "../types/civora";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectDepartment: (deptId: DepartmentRole, email?: string) => void;
}

const DEPARTMENTS: DepartmentInfo[] = [
  {
    id: "urban_planning",
    code: "MCGM-UPD",
    name: "Urban Planning Department",
    description: "Zoning regulations, master land-use allocation, and sponge city greening directives.",
    primary_focus: "Land-Use & Master Plan Allocation",
    assigned_layers: ["building", "ndvi", "scenario", "baseline"],
  },
  {
    id: "disaster_management",
    code: "MCGM-DMC",
    name: "Disaster Management Cell",
    description: "Pre-monsoon hazard mitigation, waterlogging response logistics, and emergency shelters.",
    primary_focus: "Flood Vulnerability & Relief Logistics",
    assigned_layers: ["baseline", "difference", "flood_spots"],
  },
  {
    id: "traffic_transport",
    code: "MCGM-TRD",
    name: "Traffic & Roads Authority",
    description: "Corridor capacity, flyover feasibility, permeable pavement retrofits, and right-of-way screening.",
    primary_focus: "Corridor Feasibility & Transit Nodes",
    assigned_layers: ["road", "difference", "corridors"],
  },
  {
    id: "health_sanitation",
    code: "MCGM-PHD",
    name: "Public Health Department",
    description: "Multi-criteria healthcare facility site suitability, clinic distribution, and vector surveillance.",
    primary_focus: "Hospital & Healthcare Facility Siting",
    assigned_layers: ["baseline", "building", "flood_spots"],
  },
  {
    id: "municipal_admin",
    code: "MCGM-ADM",
    name: "Municipal Administration",
    description: "Executive decision sign-off, inter-agency resource allocation, and official planning dossiers.",
    primary_focus: "Executive Oversight & Budget Ratification",
    assigned_layers: ["baseline", "scenario", "difference", "building", "road", "ndvi"],
  },
];

export function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onSelectDepartment,
}: AuthModalProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<DepartmentRole>(
    currentUser.department_id
  );

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="auth-modal-header">
          <div>
            <span className="auth-pretitle">MUNICIPAL CORPORATION OF GREATER MUMBAI</span>
            <h3 id="auth-modal-title">Department Access & Role Selection</h3>
            <p className="auth-subtitle">
              Select an authorized municipal department role to calibrate system telemetry,
              feasibility clearances, and planning copilot directives.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Department Selector"
          >
            ✕
          </button>
        </div>

        <div className="auth-dept-list">
          {DEPARTMENTS.map((dept) => {
            const isSelected = dept.id === selectedDeptId;
            const isCurrent = dept.id === currentUser.department_id;

            return (
              <div
                key={dept.id}
                className={`auth-dept-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedDeptId(dept.id)}
              >
                <div className="auth-dept-top">
                  <div className="dept-code-tag">{dept.code}</div>
                  {isCurrent && <span className="dept-active-badge">Active Session</span>}
                </div>

                <div className="auth-dept-info">
                  <h4>{dept.name}</h4>
                  <p>{dept.description}</p>
                </div>

                <div className="auth-dept-footer">
                  <span className="focus-label">Primary Focus:</span>
                  <span className="focus-val">{dept.primary_focus}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="auth-modal-footer">
          <div className="auth-session-details">
            <span>Authenticated User:</span>
            <strong>{currentUser.name}</strong>
            <small>({currentUser.designation})</small>
          </div>

          <div className="auth-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn glow"
              onClick={() => {
                onSelectDepartment(selectedDeptId);
                onClose();
              }}
            >
              Switch Department Role ◈
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
