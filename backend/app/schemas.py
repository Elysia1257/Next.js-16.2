
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Auth / User
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    user_id: str
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    display_name: Optional[str] = None

# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str

class ProjectResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    created_at: datetime
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------

class WorkflowCreate(BaseModel):
    name: str
    project_id: Optional[str] = None
    nodes_json: Optional[str] = None
    edges_json: Optional[str] = None

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    nodes_json: Optional[str] = None
    edges_json: Optional[str] = None

class WorkflowResponse(BaseModel):
    id: str
    owner_id: str
    project_id: Optional[str] = None
    name: str
    nodes_json: Optional[str] = None
    edges_json: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Asset (model-only in this phase)
# ---------------------------------------------------------------------------

class AssetResponse(BaseModel):
    id: str
    owner_id: str
    workflow_id: Optional[str] = None
    filename: str
    storage_url: str
    mime_type: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Task  (preserved legacy)
# ---------------------------------------------------------------------------

class TaskResponse(BaseModel):
    id: str
    workflow_id: str
    status: str
    result: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}
