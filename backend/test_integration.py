import json
import time
import sys
import os
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from fastapi.testclient import TestClient

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Workflow, Task

# ---------------------------------------------------------------------------
# Test Client  setup (shared between sync and async tests)
# ---------------------------------------------------------------------------

@pytest.fixture
def client() -> TestClient:
    """Synchronous TestClient for straightforward request/response tests."""
    return TestClient(app)


@pytest.fixture
async def async_client():
    """Async httpx client for polling loops."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Database lifecycle
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _manage_db() -> None:
    """Create tables before each test module run and drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_WORKFLOW_JSON = json.dumps({
    "nodes": [
        {"id": "img", "type": "imageNode", "data": {}},
        {"id": "vid", "type": "videoNode", "data": {}},
        {"id": "res", "type": "resultNode", "data": {}},
    ],
    "edges": [
        {"source": "img", "target": "vid"},
        {"source": "vid", "target": "res"},
    ],
})

BAD_WORKFLOW_JSON = json.dumps({
    "nodes": [
        {"id": "x", "type": "nonexistent", "data": {}},
    ],
    "edges": [],
})


def save_workflow(client: TestClient, name: str = "test-wf", wf_json: str = VALID_WORKFLOW_JSON) -> dict:
    """POST /workflow/save and return the response JSON."""
    resp = client.post("/workflow/save", json={"name": name, "workflow_json": wf_json})
    assert resp.status_code == 201, resp.text
    return resp.json()


# ===================================================================
#  1.  POST /workflow/save
# ===================================================================

class TestSaveWorkflow:
    def test_save_returns_201_with_correct_shape(self, client: TestClient):
        resp = client.post("/workflow/save", json={
            "name": "my-wf",
            "workflow_json": VALID_WORKFLOW_JSON,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["name"] == "my-wf"
        assert data["workflow_json"] == VALID_WORKFLOW_JSON
        assert "created_at" in data

    def test_save_persists_to_database(self, client: TestClient):
        data = save_workflow(client, name="db-check")
        wf_id = data["id"]

        db = SessionLocal()
        try:
            wf = db.query(Workflow).filter(Workflow.id == wf_id).first()
            assert wf is not None
            assert wf.name == "db-check"
            assert wf.workflow_json == VALID_WORKFLOW_JSON
        finally:
            db.close()

    def test_save_multiple_workflows_get_unique_ids(self, client: TestClient):
        d1 = save_workflow(client, name="wf-1")
        d2 = save_workflow(client, name="wf-2")
        assert d1["id"] != d2["id"]

    def test_save_missing_name_returns_422(self, client: TestClient):
        resp = client.post("/workflow/save", json={"workflow_json": VALID_WORKFLOW_JSON})
        assert resp.status_code == 422

    def test_save_missing_workflow_json_returns_422(self, client: TestClient):
        resp = client.post("/workflow/save", json={"name": "no-json"})
        assert resp.status_code == 422


# ===================================================================
#  2.  POST /workflow/run
# ===================================================================

class TestRunWorkflow:
    def test_run_returns_201_with_task_id(self, client: TestClient):
        wf = save_workflow(client)
        resp = client.post("/workflow/run", json={"workflow_id": wf["id"]})
        assert resp.status_code == 201
        data = resp.json()
        assert "task_id" in data
        assert isinstance(data["task_id"], int)

    def test_run_creates_task_in_db(self, client: TestClient):
        wf = save_workflow(client)
        resp = client.post("/workflow/run", json={"workflow_id": wf["id"]})
        task_id = resp.json()["task_id"]

        db = SessionLocal()
        try:
            task = db.query(Task).filter(Task.id == task_id).first()
            assert task is not None
            assert task.workflow_id == wf["id"]
            assert task.status in ("pending", "running", "success"), f"Unexpected status: {task.status}"
        finally:
            db.close()

    def test_run_nonexistent_workflow_returns_404(self, client: TestClient):
        resp = client.post("/workflow/run", json={"workflow_id": 99999})
        assert resp.status_code == 404

    def test_run_missing_workflow_id_returns_422(self, client: TestClient):
        resp = client.post("/workflow/run", json={})
        assert resp.status_code == 422


# ===================================================================
#  3.  GET /task/{id}
# ===================================================================

class TestGetTask:
    def test_get_task_returns_200(self, client: TestClient):
        wf = save_workflow(client)
        run_resp = client.post("/workflow/run", json={"workflow_id": wf["id"]})
        task_id = run_resp.json()["task_id"]

        resp = client.get(f"/task/{task_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == task_id
        assert data["workflow_id"] == wf["id"]
        assert data["status"] in ("pending", "running", "success", "failed")
        assert "created_at" in data

    def test_get_nonexistent_task_returns_404(self, client: TestClient):
        resp = client.get("/task/99999")
        assert resp.status_code == 404

    def test_task_fields_match_schema(self, client: TestClient):
        wf = save_workflow(client)
        run_resp = client.post("/workflow/run", json={"workflow_id": wf["id"]})
        task_id = run_resp.json()["task_id"]

        resp = client.get(f"/task/{task_id}")
        data = resp.json()
        # All required fields present
        for key in ("id", "workflow_id", "status", "created_at"):
            assert key in data, f"Missing key: {key}"
        # result may be None while running
        assert "result" in data


# ===================================================================
#  4.  Database state transitions
# ===================================================================

class TestDatabaseStateChanges:
    def test_workflow_row_created_on_save(self, client: TestClient):
        db = SessionLocal()
        try:
            before = db.query(Workflow).count()
        finally:
            db.close()

        save_workflow(client, name="row-test")

        db = SessionLocal()
        try:
            after = db.query(Workflow).count()
            assert after == before + 1
        finally:
            db.close()

    def test_task_row_created_on_run(self, client: TestClient):
        db = SessionLocal()
        try:
            before = db.query(Task).count()
        finally:
            db.close()

        wf = save_workflow(client)
        client.post("/workflow/run", json={"workflow_id": wf["id"]})

        db = SessionLocal()
        try:
            after = db.query(Task).count()
            assert after == before + 1
        finally:
            db.close()

    def test_task_status_transitions_to_success(self, client: TestClient):
        """Run a known-good workflow and poll until the task reaches success."""
        wf = save_workflow(client)
        run_resp = client.post("/workflow/run", json={"workflow_id": wf["id"]})
        task_id = run_resp.json()["task_id"]

        # Poll up to 15 seconds (BackgroundTasks run in-process with TestClient,
        # so they should complete quickly after the response is sent)
        deadline = time.time() + 15
        final_status = None
        while time.time() < deadline:
            resp = client.get(f"/task/{task_id}")
            status = resp.json()["status"]
            if status in ("success", "failed"):
                final_status = status
                break
            time.sleep(0.5)

        assert final_status == "success", f"Expected success, got {final_status}"
        result_str = resp.json().get("result")
        assert result_str is not None
        result = json.loads(result_str)
        assert result.get("video_url") == "demo.mp4"


# ===================================================================
#  5.  Error node causes task failure
# ===================================================================

class TestErrorNodeTaskFailure:
    def test_unknown_node_type_sets_task_failed(self, client: TestClient):
        wf = save_workflow(client, name="bad-node-wf", wf_json=BAD_WORKFLOW_JSON)
        run_resp = client.post("/workflow/run", json={"workflow_id": wf["id"]})
        task_id = run_resp.json()["task_id"]

        # Poll for terminal state
        deadline = time.time() + 15
        while time.time() < deadline:
            resp = client.get(f"/task/{task_id}")
            status = resp.json()["status"]
            if status in ("success", "failed"):
                break
            time.sleep(0.5)

        data = resp.json()
        assert data["status"] == "failed"
        assert data["result"] is not None
        result = json.loads(data["result"])
        assert "error" in result

    def test_nonexistent_workflow_on_run_returns_404_not_pollable(self, client: TestClient):
        """If the workflow doesn't exist, /workflow/run returns 404 immediately
        so no task is ever created."""
        resp = client.post("/workflow/run", json={"workflow_id": 99999})
        assert resp.status_code == 404


# ===================================================================
#  6.  Full workflow execution end-to-end
# ===================================================================

class TestFullWorkflowExecution:
    def test_complete_save_run_poll_cycle(self, client: TestClient):
        """Simulate the entire frontend flow:
        Save a workflow → Run it → Poll the task → Verify result."""
        # Step 1: Save
        wf_data = save_workflow(client, name="e2e-wf")
        wf_id = wf_data["id"]
        assert wf_data["name"] == "e2e-wf"

        # Step 2: Verify save persisted
        get_resp = client.get(f"/workflow/{wf_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["workflow_json"] == VALID_WORKFLOW_JSON

        # Step 3: Run
        run_resp = client.post("/workflow/run", json={"workflow_id": wf_id})
        assert run_resp.status_code == 201
        task_id = run_resp.json()["task_id"]

        # Step 4: Active polling loop
        max_attempts = 20
        for _ in range(max_attempts):
            task_resp = client.get(f"/task/{task_id}")
            task_data = task_resp.json()
            if task_data["status"] in ("success", "failed"):
                break
            time.sleep(0.5)
        else:
            pytest.fail("Task did not reach terminal state within timeout")

        # Step 5: Verify terminal state
        assert task_data["status"] == "success"
        assert task_data["result"] is not None
        result = json.loads(task_data["result"])
        assert result["video_url"] == "demo.mp4"

    def test_two_workflows_in_parallel(self, client: TestClient):
        """Run two workflows concurrently and verify both succeed."""
        wf1 = save_workflow(client, name="parallel-1")
        wf2 = save_workflow(client, name="parallel-2")

        r1 = client.post("/workflow/run", json={"workflow_id": wf1["id"]})
        r2 = client.post("/workflow/run", json={"workflow_id": wf2["id"]})
        tid1 = r1.json()["task_id"]
        tid2 = r2.json()["task_id"]

        # Poll both
        deadline = time.time() + 20
        s1 = s2 = None
        while time.time() < deadline:
            if s1 is None:
                d1 = client.get(f"/task/{tid1}").json()
                if d1["status"] in ("success", "failed"):
                    s1 = d1["status"]
            if s2 is None:
                d2 = client.get(f"/task/{tid2}").json()
                if d2["status"] in ("success", "failed"):
                    s2 = d2["status"]
            if s1 is not None and s2 is not None:
                break
            time.sleep(0.5)

        assert s1 == "success"
        assert s2 == "success"


# ===================================================================
#  7.  GET /workflow/{id}  (bonus  tested above)
# ===================================================================

class TestGetWorkflow:
    def test_get_workflow_returns_200(self, client: TestClient):
        data = save_workflow(client, name="get-me")
        resp = client.get(f"/workflow/{data['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "get-me"

    def test_get_nonexistent_workflow_returns_404(self, client: TestClient):
        resp = client.get("/workflow/99999")
        assert resp.status_code == 404

