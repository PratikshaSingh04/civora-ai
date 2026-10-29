from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
import datetime

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class DepartmentInfo(BaseModel):
    id: str
    code: str
    name: str
    description: str
    primary_focus: str
    assigned_layers: List[str]

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    department_id: str
    department_name: str
    designation: str
    clearance_level: str
    token: str

class LoginRequest(BaseModel):
    email: str
    department_id: Optional[str] = None

# 5 Official Municipal Departments from Chapter 4 ER & Chapter 5 Modules
MUNICIPAL_DEPARTMENTS: Dict[str, Dict[str, Any]] = {
    "urban_planning": {
        "id": "urban_planning",
        "code": "MCGM-UPD",
        "name": "Urban Planning Department",
        "description": "Responsible for zoning, land-use allocation, master plan development, and sponge city interventions across K/East Ward.",
        "primary_focus": "Master Plan & Land Allocation",
        "assigned_layers": ["building", "ndvi", "scenario", "baseline"],
        "default_user": {
            "id": "usr_plan_01",
            "name": "Pratiksha Singh",
            "email": "planner@mcgm.gov.in",
            "designation": "Lead Urban Planner",
            "clearance_level": "Level 3 (Planning Clearance)"
        }
    },
    "disaster_management": {
        "id": "disaster_management",
        "code": "MCGM-DMC",
        "name": "Disaster Management Cell",
        "description": "Pre-monsoon preparedness, real-time flood monitoring, emergency response logistics, and waterlogging mitigation.",
        "primary_focus": "Flood Risk & Waterlogging Response",
        "assigned_layers": ["baseline", "difference", "flood_spots"],
        "default_user": {
            "id": "usr_dmc_02",
            "name": "Rajesh V. Patil",
            "email": "disaster@mcgm.gov.in",
            "designation": "Chief Disaster Officer",
            "clearance_level": "Level 4 (Emergency Command)"
        }
    },
    "traffic_transport": {
        "id": "traffic_transport",
        "code": "MCGM-TRD",
        "name": "Traffic & Roads Authority",
        "description": "Road network expansion, flyover feasibility, permeable pavement retrofits, and corridor conflict evaluation.",
        "primary_focus": "Roads & Transit Feasibility",
        "assigned_layers": ["road", "difference", "corridors"],
        "default_user": {
            "id": "usr_traffic_03",
            "name": "Kavita Deshmukh",
            "email": "traffic@mcgm.gov.in",
            "designation": "Superintending Engineer (Roads)",
            "clearance_level": "Level 3 (Infrastructure Clearance)"
        }
    },
    "health_sanitation": {
        "id": "health_sanitation",
        "code": "MCGM-PHD",
        "name": "Public Health Department",
        "description": "Civic healthcare infrastructure, hospital site suitability, disease vector surveillance in waterlogging zones.",
        "primary_focus": "Hospital & Clinic Suitability",
        "assigned_layers": ["baseline", "building", "flood_spots"],
        "default_user": {
            "id": "usr_health_04",
            "name": "Dr. Sameer Joshi",
            "email": "health@mcgm.gov.in",
            "designation": "Chief Medical Planning Officer",
            "clearance_level": "Level 3 (Healthcare Facility Planning)"
        }
    },
    "municipal_admin": {
        "id": "municipal_admin",
        "code": "MCGM-ADM",
        "name": "Municipal Administration",
        "description": "Executive oversight, inter-departmental resource allocation, policy ratification, and municipal dossier sign-off.",
        "primary_focus": "Executive Governance & Budget Approvals",
        "assigned_layers": ["baseline", "scenario", "difference", "building", "road", "ndvi"],
        "default_user": {
            "id": "usr_admin_05",
            "name": "A. S. Mehta, IAS",
            "email": "commissioner@mcgm.gov.in",
            "designation": "Additional Municipal Commissioner",
            "clearance_level": "Level 5 (Executive Admin Clearance)"
        }
    }
}


@router.get("/departments", response_model=List[DepartmentInfo])
def get_departments():
    """Returns official municipal departments defined in CIVORA AI synopsis."""
    return [
        DepartmentInfo(
            id=dept["id"],
            code=dept["code"],
            name=dept["name"],
            description=dept["description"],
            primary_focus=dept["primary_focus"],
            assigned_layers=dept["assigned_layers"]
        )
        for dept in MUNICIPAL_DEPARTMENTS.values()
    ]


@router.post("/login", response_model=UserResponse)
def login(request: LoginRequest):
    """
    Simulates secure departmental authentication.
    Matches user against registered municipal departments or seeds role-based session.
    """
    dept_id = request.department_id or "urban_planning"
    if dept_id not in MUNICIPAL_DEPARTMENTS:
        # Match by email pattern if available
        matched = False
        for k, v in MUNICIPAL_DEPARTMENTS.items():
            if v["default_user"]["email"].lower() == request.email.lower():
                dept_id = k
                matched = True
                break
        if not matched:
            dept_id = "urban_planning"

    dept = MUNICIPAL_DEPARTMENTS[dept_id]
    user_info = dept["default_user"]

    # Generate deterministic session token
    token = f"civora_token_{dept['code'].lower()}_{int(datetime.datetime.now().timestamp())}"

    return UserResponse(
        id=user_info["id"],
        name=user_info["name"],
        email=request.email if "@" in request.email else user_info["email"],
        department_id=dept["id"],
        department_name=dept["name"],
        designation=user_info["designation"],
        clearance_level=user_info["clearance_level"],
        token=token
    )


@router.get("/me", response_model=UserResponse)
def get_current_user(department_id: Optional[str] = "urban_planning"):
    """Returns active profile based on department context."""
    dept = MUNICIPAL_DEPARTMENTS.get(department_id, MUNICIPAL_DEPARTMENTS["urban_planning"])
    user_info = dept["default_user"]
    return UserResponse(
        id=user_info["id"],
        name=user_info["name"],
        email=user_info["email"],
        department_id=dept["id"],
        department_name=dept["name"],
        designation=user_info["designation"],
        clearance_level=user_info["clearance_level"],
        token="civora_active_session"
    )
