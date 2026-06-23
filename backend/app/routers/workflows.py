"""
Workflow CRUD — user-scoped canvas persistence.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json
import uuid
import time
import logging
from pydantic import BaseModel
from typing import Any

from app.database import get_db
from app.models import Workflow
from app.schemas import WorkflowCreate, WorkflowUpdate, WorkflowResponse
from app.auth import get_current_user, CurrentUser
from app.providers.provider_factory import get_provider, list_providers
from app.executors.task_type import TaskType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _get_workflow_or_404(workflow_id: str, user: CurrentUser, db: Session) -> Workflow:
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.owner_id == user.id,
    ).first()
    if wf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return wf


def _get_generation_provider():
    """Return vidu provider if available, otherwise fall back to mock."""
    providers = list_providers()
    if "vidu" in providers:
        return get_provider("vidu")
    return get_provider("mock")


@router.post("/", response_model=WorkflowResponse, status_code=201)
def create_workflow(
    payload: WorkflowCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    wf = Workflow(
        owner_id=user.id,
        created_by=user.id,
        project_id=payload.project_id,
        name=payload.name,
        nodes_json=payload.nodes_json,
        edges_json=payload.edges_json,
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return wf


@router.get("/", response_model=list[WorkflowResponse])
def list_workflows(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return db.query(Workflow).filter(Workflow.owner_id == user.id).all()


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return _get_workflow_or_404(workflow_id, user, db)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: str,
    payload: WorkflowUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    wf = _get_workflow_or_404(workflow_id, user, db)
    if payload.name is not None:
        wf.name = payload.name
    if payload.nodes_json is not None:
        wf.nodes_json = payload.nodes_json
    if payload.edges_json is not None:
        wf.edges_json = payload.edges_json
    db.commit()
    db.refresh(wf)
    return wf


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    wf = _get_workflow_or_404(workflow_id, user, db)
    db.delete(wf)
    db.commit()


class WorkflowExecuteRequest(BaseModel):
    nodes_json: str
    edges_json: str | None = None


class WorkflowExecuteResponse(BaseModel):
    success: bool
    nodes: list[dict[str, Any]]
    final_result: dict[str, Any] | None = None
    error: str | None = None


@router.post("/execute", response_model=WorkflowExecuteResponse)
def execute_workflow(
    payload: WorkflowExecuteRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Execute a workflow linearly: iterate nodes in order, call generate APIs, return results.

    V1 rules:
      - Nodes execute in array order (no topological sort).
      - Each generator node (imageNode, videoNode) submits a task and polls until completion.
      - Non-generator nodes (noteNode, etc.) pass through immediately.
      - Edge connections determine which upstream outputs feed into each node.
    """
    try:
        nodes: list[dict[str, Any]] = json.loads(payload.nodes_json)
        edges: list[dict[str, Any]] = json.loads(payload.edges_json or "[]")
    except json.JSONDecodeError as e:
        return WorkflowExecuteResponse(success=False, nodes=[], error=f"Invalid JSON: {e}")

    # Build edge lookup: target -> [source_ids]
    edge_targets: dict[str, list[str]] = {}
    for e in edges:
        src = e.get("source", "")
        tgt = e.get("target", "")
        if src and tgt:
            edge_targets.setdefault(tgt, []).append(src)

    node_results: list[dict[str, Any]] = []
    node_outputs: dict[str, dict[str, Any]] = {}  # node_id -> output

    for node in nodes:
        nid = node.get("id", "")
        ntype = node.get("type", "")
        ndata = node.get("data", {}) or {}

        # Collect upstream outputs (edges point to this node)
        upstream: dict[str, Any] = {}
        for src_id in edge_targets.get(nid, []):
            if src_id in node_outputs:
                upstream.update(node_outputs[src_id])

        result: dict[str, Any] = {"node_id": nid, "type": ntype, "status": "success"}

        if ntype == "imageNode":
            result = _execute_image_node(ndata, upstream)
        elif ntype == "videoNode":
            result = _execute_video_node(ndata, upstream)
        elif ntype in ("startEndVideo",):
            result = _execute_video_node(
                {**ndata, "vidu_mode": "start_end2video"}, upstream
            )
        elif ntype in ("noteNode", "assetNode", "imageSource", "videoSource"):
            # Passthrough: carry data forward
            result.update({"image_url": ndata.get("url", ndata.get("image_url", "")),
                           "video_url": ndata.get("url", ndata.get("video_url", "")),
                           "label": ndata.get("label", ndata.get("fileName", ""))})

        result["node_id"] = nid
        result["type"] = ntype
        node_results.append(result)
        node_outputs[nid] = result

    # Final result = last node's output
    final = node_outputs[nodes[-1]["id"]] if nodes else {}
    return WorkflowExecuteResponse(
        success=True,
        nodes=node_results,
        final_result=final,
    )


def _execute_image_node(ndata: dict[str, Any], upstream: dict[str, Any]) -> dict[str, Any]:
    """Execute an image generation node using provider routing (vidu > mock)."""
    prompt = ndata.get("prompt", "") or upstream.get("prompt", "a beautiful landscape")
    ref_images = ndata.get("reference_images", []) or []
    if not ref_images and upstream.get("image_url"):
        ref_images = [upstream["image_url"]]

    task_type = TaskType.IMAGE_TO_IMAGE if ref_images else TaskType.TEXT_TO_IMAGE
    provider = _get_generation_provider()
    if not provider:
        return {"status": "failed", "error": "No provider available"}

    try:
        resp = provider.create_task({
            "prompt": prompt,
            "model": ndata.get("model", "viduq2"),
            "aspect_ratio": ndata.get("aspect_ratio", "16:9"),
            "quality": ndata.get("quality", "Standard"),
            "resolution": ndata.get("resolution", "2K"),
            "reference_images": ref_images,
        }, task_type)
        ptid = resp.get("provider_task_id", "")
        if ptid:
            _poll_until_done(provider, ptid)
        return {
            "status": "success",
            "image_url": resp.get("image_url", "demo.png"),
            "reference_images": ref_images,
            "prompt": prompt,
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}


def _execute_video_node(ndata: dict[str, Any], upstream: dict[str, Any]) -> dict[str, Any]:
    """Execute a video generation node using provider routing (vidu > mock)."""
    prompt = ndata.get("prompt", "") or upstream.get("prompt", "a beautiful video")
    ref_images = ndata.get("reference_images", []) or []
    if not ref_images and upstream.get("image_url"):
        ref_images = [upstream["image_url"]]

    vidu_mode = ndata.get("vidu_mode", "")
    if vidu_mode == "start_end2video":
        task_type = TaskType.START_END_TO_VIDEO
    elif ref_images:
        task_type = TaskType.IMAGE_TO_VIDEO
    else:
        task_type = TaskType.TEXT_TO_VIDEO

    provider = _get_generation_provider()
    if not provider:
        return {"status": "failed", "error": "No provider available"}

    try:
        resp = provider.create_task({
            "prompt": prompt,
            "model": ndata.get("model", "viduq3-turbo"),
            "duration": ndata.get("duration", 5),
            "aspect_ratio": ndata.get("aspect_ratio", "16:9"),
            "resolution": ndata.get("resolution", "1080p"),
            "audio_enabled": ndata.get("audio_enabled", True),
            "subtitle_enabled": ndata.get("subtitle_enabled", False),
            "reference_images": ref_images,
            "start_frame_url": ndata.get("start_frame_url", ""),
            "end_frame_url": ndata.get("end_frame_url", ""),
        }, task_type)
        ptid = resp.get("provider_task_id", "")
        if ptid:
            _poll_until_done(provider, ptid)
        return {
            "status": "success",
            "video_url": resp.get("video_url", "demo.mp4"),
            "thumbnail_url": resp.get("thumbnail_url", ""),
            "prompt": prompt,
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}


def _poll_until_done(provider, ptid: str, max_polls: int = 30, interval: float = 0.3) -> None:
    """Poll the provider until the task completes."""
    for _ in range(max_polls):
        try:
            status_resp = provider.query_task(ptid)
            status = status_resp.get("status", "pending")
            if status in ("success", "failed"):
                return
        except Exception:
            pass
        time.sleep(interval)
