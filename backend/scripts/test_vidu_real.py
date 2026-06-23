#!/usr/bin/env python3
"""ViduProvider smoke test.

Reads `VIDU_API_KEY` from the environment, submits a real video creation
task, polls until completion, and prints the result.

Usage::

    cd backend
    set VIDU_API_KEY=sk-...

    python scripts/test_vidu_real.py

This script does **not** import pytest or affect the test suite in any way.
It lives under `scripts/` so it won't be discovered by pytest.
"""

import os
import sys
import time

# Make sure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.providers.vidu_provider import ViduProvider


def main() -> None:
    api_key = os.environ.get("VIDU_API_KEY")
    if not api_key:
        print("ERROR: VIDU_API_KEY environment variable is not set.")
        print("       Set it to your Vidu API key and try again.")
        print("       Example: set VIDU_API_KEY=sk-...")
        sys.exit(1)

    print("ViduProvider Smoke Test")
    print("=" * 60)
    print()

    base_url = os.environ.get("VIDU_API_BASE_URL")
    if base_url:
        print(f"Base URL:  {base_url}")
    print(f"API Key:   {api_key[:8]}...{api_key[-4:]}")

    provider = ViduProvider()

    # ── Step 1: create_task ──────────────────────────────────────────
    params = {
        "model": "vidu-q1",
        "prompt": "A cat walking through a sunny garden",
        "duration": 5,
        "aspect_ratio": "16:9",
        "resolution": "1080p",
        "audio_enabled": True,
        "subtitle_enabled": False,
    }

    print()
    print("1. Creating task...")
    print(f"   Params: {params}")

    t0 = time.time()
    try:
        result = provider.create_task(params)
    except Exception as exc:
        print(f"   ERROR: {exc}")
        sys.exit(1)

    provider_task_id = result.get("provider_task_id", "?")
    print(f"   provider_task_id: {provider_task_id}")
    print(f"   status:           {result.get('status')}")

    # ── Step 2: poll until terminal ──────────────────────────────────
    print()
    print("2. Polling for result...")
    max_attempts = 60  # ~2 min at 2 s intervals
    for attempt in range(1, max_attempts + 1):
        try:
            resp = provider.query_task(provider_task_id)
        except Exception as exc:
            print(f"   [attempt {attempt}] query_task failed: {exc}")
            time.sleep(2)
            continue

        status = resp.get("status", "?")
        elapsed = time.time() - t0
        print(f"   [{elapsed:4.0f}s] attempt {attempt:2d}  status={status}")

        if status in ("success", "failed"):
            print()
            print("3. Final result:")
            for k, v in resp.items():
                print(f"   {k}: {v}")
            break

        time.sleep(2)
    else:
        print()
        print("3. TIMEOUT — task did not complete within polling window")
        sys.exit(1)

    # ── Summary ──────────────────────────────────────────────────────
    total_time = time.time() - t0
    print()
    print("=" * 60)
    print(f"Total elapsed: {total_time:.0f} seconds")
    print(f"provider_task_id: {provider_task_id}")

    video_url = resp.get("video_url", "")
    if video_url:
        print(f"video_url: {video_url}")

    status = resp.get("status", "?")
    if status == "success":
        print("Result: SUCCESS")
    elif status == "failed":
        print("Result: FAILED")
        print(f"Error: {resp.get('error', 'unknown')}")
    else:
        print(f"Result: {status}")


if __name__ == "__main__":
    main()
