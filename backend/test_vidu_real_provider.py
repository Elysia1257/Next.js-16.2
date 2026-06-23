"""
Real Vidu API integration test.

This test requires a valid `VIDU_API_KEY` environment variable.
Without it, the test is skipped automatically.

Run with::

    pytest -m vidu_real test_vidu_real_provider.py -s

It is excluded from CI by default because the marker `vidu_real`
is not selected in normal test runs.
"""

import os
import sys
import time
from collections.abc import Generator

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.providers.vidu_provider import ViduProvider

pytestmark = pytest.mark.vidu_real

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

POLL_INTERVAL_S = 5          # seconds between query_task polls
MAX_POLL_TIME_S = 300        # 5-minute timeout (typical Vidu task: 30-90 s)
MAX_POLL_ATTEMPTS = MAX_POLL_TIME_S // POLL_INTERVAL_S


# ---------------------------------------------------------------------------
# Skip gate
# ---------------------------------------------------------------------------

def _require_api_key() -> str:
    key = os.environ.get("VIDU_API_KEY", "").strip()
    if not key:
        pytest.skip("VIDU_API_KEY is not set — skipping real Vidu integration test")
    return key


# ---------------------------------------------------------------------------
# Fixture — real provider
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def vidu() -> ViduProvider:
    """Create a real ViduProvider that uses the live HTTP endpoint."""
    _require_api_key()
    return ViduProvider()  # no request_fn override → uses _default_request


# ---------------------------------------------------------------------------
# Test: create + poll real Vidu task
# ---------------------------------------------------------------------------

def test_vidu_create_and_poll_to_success(vidu: ViduProvider):
    """Submit a minimal Vidu generation task and wait for it to complete.

    This test exercises the full async lifecycle:
      1. `create_task()` → get `provider_task_id`
      2. `query_task()` loop → wait for `success`
      3. Verify `video_url` is present in the final response

    A timeout of {timeout}s protects against infinite waits.
    """.format(timeout=MAX_POLL_TIME_S)

    t_start = time.monotonic()

    # -- Step 1: create -------------------------------------------------
    create_resp = vidu.create_task({
        "prompt": "A beautiful sunset over calm ocean water, cinematic quality",
        "duration": 5,
        "aspect_ratio": "16:9",
        "resolution": "1080p",
        "model": "viduq3-turbo",
    })

    provider_task_id = create_resp.get("provider_task_id")
    assert provider_task_id, f"create_task must return provider_task_id, got: {create_resp}"
    assert create_resp.get("status") == "pending"

    print(f"\n[VIDU] Created task: {provider_task_id}")

    # -- Step 2: poll ---------------------------------------------------
    final_status = None
    final_video_url = None
    last_resp = {}

    for attempt in range(1, MAX_POLL_ATTEMPTS + 1):
        time.sleep(POLL_INTERVAL_S)
        query_resp = vidu.query_task(provider_task_id)
        last_resp = query_resp

        status = query_resp.get("status", "pending")
        elapsed = time.monotonic() - t_start

        print(
            f"[VIDU] Poll {attempt:3d}  "
            f"status={status:<12s}  "
            f"elapsed={elapsed:5.0f}s"
        )

        if status in ("success", "failed", "error", "cancelled"):
            final_status = status
            if status == "success":
                final_video_url = query_resp.get("video_url")
            break

    # -- Step 3: verify outcomes ----------------------------------------
    total_elapsed = time.monotonic() - t_start

    print(f"\n[VIDU] ── Summary ──")
    print(f"[VIDU]   provider_task_id: {provider_task_id}")
    print(f"[VIDU]   final_status:     {final_status}")
    print(f"[VIDU]   video_url:        {final_video_url}")
    print(f"[VIDU]   total_time:       {total_elapsed:.0f}s")

    assert final_status is not None, (
        f"Task did not reach terminal state after {MAX_POLL_TIME_S}s. "
        f"Last response: {last_resp}"
    )

    assert final_status == "success", (
        f"Expected 'success' but got '{final_status}'. "
        f"Full response: {last_resp}"
    )

    assert final_video_url, (
        f"Task succeeded but video_url is missing. Response: {last_resp}"
    )

    print(f"[VIDU] PASS — video_url={final_video_url}  ({total_elapsed:.0f}s)")
