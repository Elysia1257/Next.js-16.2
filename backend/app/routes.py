import logging
import uuid
import pathlib
import traceback

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ---- Generators -------------------------------------------------------

class GenerateImageRequest(BaseModel):
    prompt: str
    model: str = "viduq2"
    aspect_ratio: str = "16:9"
    quality: str = "Standard"
    resolution: str = "2K"
    reference_images: list[str] = []

class GenerateVideoRequest(BaseModel):
    prompt: str
    model: str = "viduq3-turbo"
    duration: int = 10
    aspect_ratio: str = "16:9"
    resolution: str = "1080p"
    audio_enabled: bool = True
    seed: int | None = None
    subtitle_enabled: bool | None = None
    vidu_mode: str | None = None
    reference_images: list[str] = []
    start_frame_url: str | None = None
    end_frame_url: str | None = None

class GenerateResponse(BaseModel):
    task_id: str
    status: str = "running"

class TaskResultResponse(BaseModel):
    id: str
    status: str
    result: dict | None = None
    image_url: str | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    error_message: str | None = None

# In-memory task store
_tasks: dict[str, dict] = {}


@router.post("/generate/image", response_model=GenerateResponse, status_code=201)
async def generate_image(payload: GenerateImageRequest):
    """Submit an image generation task."""
    task_id = uuid.uuid4().hex
    from app.executors.task_type import TaskType

    if payload.reference_images:
        task_type = TaskType.IMAGE_TO_IMAGE
    else:
        task_type = TaskType.TEXT_TO_IMAGE

    import os as _os
    from app.providers.provider_factory import get_provider
    provider_name = "vidu" if _os.environ.get("VIDU_API_KEY") else "mock"
    provider = get_provider(provider_name)

    try:
        result = provider.create_task({
            "prompt": payload.prompt,
            "model": payload.model,
            "aspect_ratio": payload.aspect_ratio,
            "quality": payload.quality,
            "resolution": payload.resolution,
            "reference_images": payload.reference_images,
        }, task_type)
        provider_task_id = result.get("provider_task_id", task_id)
    except Exception:
        traceback.print_exc()
        provider_task_id = "FAILED"

    _tasks[task_id] = {
        "id": task_id,
        "status": "running",
        "provider_name": provider_name,
        "provider_task_id": provider_task_id,
        "task_type": task_type.value,
    }
    return GenerateResponse(task_id=task_id)


@router.post("/generate/video", response_model=GenerateResponse, status_code=201)
async def generate_video(payload: GenerateVideoRequest):
    """Submit a video generation task. Returns a task_id to poll."""
    import urllib.request as _req, json as _json, os as _os
    task_id = uuid.uuid4().hex
    task_type = "text2video"
    if payload.vidu_mode == "img2video": task_type = "img2video"
    elif payload.vidu_mode == "start_end2video": task_type = "start-end2video"
    vidu_payload = {"model":payload.model,"prompt":payload.prompt,"duration":payload.duration,"aspect_ratio":payload.aspect_ratio,"resolution":payload.resolution,"audio":payload.audio_enabled}
    if payload.subtitle_enabled is not None: vidu_payload["subtitle"] = payload.subtitle_enabled
    if payload.seed is not None and payload.seed != 0: vidu_payload["seed"] = payload.seed
    if payload.reference_images: vidu_payload["images"] = payload.reference_images
    if task_type == "start-end2video":
        img_arr = [u for u in (payload.start_frame_url, payload.end_frame_url) if u]
        if img_arr:
            vidu_payload["images"] = img_arr
    api_key = _os.environ.get("VIDU_API_KEY","")
    url = f"https://api.vidu.cn/ent/v2/{task_type}"
    body = _json.dumps(vidu_payload).encode()
    req = _req.Request(url,data=body,headers={"Authorization":f"Token {api_key}","Content-Type":"application/json"},method="POST")
    try:
        with _req.urlopen(req,timeout=15) as resp:
            r = _json.loads(resp.read().decode())
            ptid = r.get("task_id",task_id)
    except Exception as e:
        traceback.print_exc()
        ptid = f"ERROR:{e}"
    _tasks[task_id] = {"id":task_id,"status":"running","provider_name":"vidu","provider_task_id":ptid}
    return GenerateResponse(task_id=task_id)


@router.get("/task/{task_id}", response_model=TaskResultResponse)
async def get_task_result(task_id: str):
    """Poll for the result of a generation task."""
    import urllib.request as _req, json as _json, os as _os
    from app.providers.provider_factory import get_provider

    task = _tasks.get(task_id)

    if task is None:
        static_url = f"/uploads/images/{task_id}"
        return TaskResultResponse(
            id=task_id, status="success", image_url=static_url
        )

    provider_name = task.get("provider_name", "vidu")
    ptid = str(task.get("provider_task_id", task_id))

    if provider_name == "mock":
        provider = get_provider("mock")
        if provider:
            result = provider.query_task(ptid)
            task["status"] = result.get("status", "success")
            return TaskResultResponse(
                id=task_id,
                status=result.get("status", "success"),
                image_url=result.get("image_url"),
                video_url=result.get("video_url"),
            )
        return TaskResultResponse(
            id=task_id, status="success", image_url="demo.png"
        )

    if ptid.startswith("ERROR") or ptid.startswith("FAILED"):
        return TaskResultResponse(id=task_id, status="failed", error_message=f"Task submission failed: {ptid}")

    api_key = _os.environ.get("VIDU_API_KEY","")
    url = f"https://api.vidu.cn/ent/v2/tasks/{ptid}/creations"
    req = _req.Request(url, headers={"Authorization":f"Token {api_key}"})
    try:
        with _req.urlopen(req, timeout=10) as resp:
            raw = _json.loads(resp.read().decode())
            state = raw.get("state","running")
            creations = raw.get("creations",[])
            response = TaskResultResponse(id=task_id, status=state)
            if creations:
                c0 = creations[0]
                response.video_url = c0.get("url")
                response.image_url = c0.get("url")
                response.thumbnail_url = c0.get("cover_url")
                if c0.get("duration"): response.result = str(c0["duration"])
            task["status"] = state
            return response
    except Exception as e:
        logger.warning("Failed to query Vidu: %s", e)
        return TaskResultResponse(id=task_id, status="pending")


class ImageUploadResponse(BaseModel):
    success: bool
    filename: str
    url: str

UPLOAD_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "uploads" / "images"

@router.post("/upload/image", response_model=ImageUploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """Accept a single image file and return the public URL."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = pathlib.Path(file.filename or "image.png").suffix or ".png"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / safe_name
    content = await file.read()
    dest.write_bytes(content)
    return ImageUploadResponse(
        success=True,
        filename=safe_name,
        url=f"/uploads/images/{safe_name}",
    )
