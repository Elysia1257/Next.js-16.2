"""
Project CRUD 鈥?user-scoped.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Workflow
from app.schemas import ProjectCreate, ProjectResponse, WorkflowResponse
from app.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    proj = Project(owner_id=user.id, name=payload.name)
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


@router.get("/", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return db.query(Project).filter(Project.owner_id == user.id).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == user.id
    ).first()
    if proj is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == user.id
    ).first()
    if proj is None:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(proj)
    db.commit()


@router.get("/{project_id}/workflows", response_model=list[WorkflowResponse])
def list_project_workflows(
    project_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    proj = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == user.id
    ).first()
    if proj is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(Workflow).filter(
        Workflow.project_id == project_id, Workflow.owner_id == user.id
    ).all()
