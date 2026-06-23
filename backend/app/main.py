import os

from dotenv import load_dotenv

# Load .env before any other imports that read environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routes import router
from app.providers.provider_factory import register_provider, list_providers
from app.providers.mock_provider import MockProvider

# Import all models BEFORE create_all so tables are registered
from app.models import User, Project, Workflow, Asset, Task  # noqa: F401

# Create all tables on startup
Base.metadata.create_all(bind=engine)

# Provider registration
register_provider("mock", MockProvider())
if os.environ.get("VIDU_API_KEY"):
    from app.providers.vidu_provider import ViduProvider
    register_provider("vidu", ViduProvider())

app = FastAPI(title="Cubex Backend", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory and mount static file serving
UPLOADS_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(os.path.join(UPLOADS_ROOT, "images"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT), name="uploads")

# Register routers
app.include_router(router)

from app.routers.auth import router as auth_router
from app.routers.workflows import router as workflow_router
from app.routers.projects import router as project_router

app.include_router(auth_router)
app.include_router(workflow_router)
app.include_router(project_router)


@app.get("/")
def root():
    return {"status": "ok", "message": "Cubex Backend is running"}


@app.get("/debug/test-vidu")
def test_vidu():
    import urllib.request, json
    _os = os
    key = _os.environ.get("VIDU_API_KEY", "")
    body = json.dumps({"model":"viduq3-turbo","prompt":"connectivity test","duration":5}).encode()
    req = urllib.request.Request(
        "https://api.vidu.cn/ent/v2/text2video",
        data=body,
        headers={"Authorization": f"Token {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"ok": True, "vidu_response": json.loads(resp.read().decode())}
    except Exception as e:
        return {"ok": False, "error": str(e), "type": type(e).__name__}


@app.get("/health/providers")
def health_providers():
    """Returns which providers are available and ready for use."""
    providers = list_providers()
    result: dict = {}
    for name in ("mock", "vidu"):
        result[name] = name in providers
    if not result.get("vidu"):
        result["error"] = "VIDU_API_KEY missing or not set"
    return result


@app.get("/debug/test-provider")
def test_provider():
    from app.providers.provider_factory import get_provider
    import traceback as tb
    provider = get_provider("vidu")
    try:
        result = provider.create_task({"prompt":"provider test","duration":5}, "text2video")
        return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e), "type": type(e).__name__, "traceback": tb.format_exc()}


@app.get("/debug/task/{task_id}")
def debug_task(task_id: str):
    from app.routes import _tasks
    t = _tasks.get(task_id)
    if t is None: return {"error": "task not found"}
    return {"task_id": task_id, "provider_name": t.get("provider_name"), "provider_task_id": t.get("provider_task_id"), "status": t.get("status")}
