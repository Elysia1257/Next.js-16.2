"""
Quick end-to-end test for all 4 endpoints.
Run:  python test_api.py
"""
import json, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient

# Use a separate test DB
import app.database as db_mod
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_mod.SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'test_app.db')}"

from app.database import Base, engine
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

from app.main import app
client = TestClient(app)

passed = 0


def ok(label, http_status, data, **checks):
    global passed
    good = all(data.get(k) == v for k, v in checks.items()) if data else True
    s = f"[{http_status}] {label}"
    if good:
        passed += 1
        s += f"  {json.dumps(data, ensure_ascii=False)}" if data else ""
    else:
        s += f"  FAIL  {json.dumps(data, ensure_ascii=False)}"
    print(s)
    return good


# 1. Health
r = client.get("/")
ok("GET /", r.status_code, r.json())

# 2. Save
r = client.post("/workflow/save", json={"name": "Test", "workflow_json": "{}"})
d = r.json()
ok("POST /workflow/save", r.status_code, d, name="Test")
wf_id = d["id"]

# 3. Get workflow
r = client.get(f"/workflow/{wf_id}")
ok("GET /workflow/{id}", r.status_code, r.json(), name="Test", id=wf_id)

# 4. Run
r = client.post("/workflow/run", json={"workflow_id": wf_id})
d = r.json()
ok("POST /workflow/run", r.status_code, d, status="pending")
tid = d["task_id"]

# 5. Task (pending)
r = client.get(f"/task/{tid}")
ok("GET /task/{id} (pending)", r.status_code, r.json(), status="pending")

# 6. Wait for background task
print("\nWaiting 11 s for background task ...")
time.sleep(11)
r = client.get(f"/task/{tid}")
d = r.json()
ok("GET /task/{id} (completed)", r.status_code, d, status="success",
   result=json.dumps({"video_url": "demo.mp4"}))

print(f"\n{'='*36}\n  {passed} / 6 passed\n{'='*36}")

# Cleanup
Base.metadata.drop_all(bind=engine)
os.remove(os.path.join(BASE_DIR, "test_app.db"))
if __name__ == "__main__":
    sys.exit(0 if passed == 6 else 1)

