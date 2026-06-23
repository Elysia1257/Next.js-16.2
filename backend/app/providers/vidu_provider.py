import os
from typing import Any

from app.providers.base import BaseProvider
from app.executors.task_type import TaskType
from app.utils.file_url import get_public_file_url


# ---------------------------------------------------------------------------
# Task-type -> API endpoint routing (pure lookup - no inference)
# ---------------------------------------------------------------------------

TASK_ENDPOINTS: dict[TaskType, str] = {
    TaskType.TEXT_TO_VIDEO:       "/ent/v2/text2video",
    TaskType.IMAGE_TO_VIDEO:      "/ent/v2/img2video",
    TaskType.REFERENCE_TO_VIDEO:  "/ent/v2/reference2video",
    TaskType.START_END_TO_VIDEO:  "/ent/v2/start-end2video",
    TaskType.TEXT_TO_IMAGE:       "/ent/v2/text2image",
    TaskType.IMAGE_TO_IMAGE:      "/ent/v2/reference2image",
}

# Image task types (for payload differentiation)
_IMAGE_TASKS = {TaskType.TEXT_TO_IMAGE, TaskType.IMAGE_TO_IMAGE}


class ViduProvider(BaseProvider):
    """Video and image generation provider for the Vidu API.

    The Vidu API is asynchronous - create_task submits a generation
    request and returns a provider_task_id that can be polled via
    query_task until the result is ready.

    **Task type routing**: The `task_type` parameter selects which
    Vidu API endpoint is called.  The provider performs no inference -
    the executor is responsible for determining the correct
    `TaskType`.

    **Supported task types**:
      - TEXT_TO_VIDEO, IMAGE_TO_VIDEO, REFERENCE_TO_VIDEO, START_END_TO_VIDEO
      - TEXT_TO_IMAGE (viduq2), IMAGE_TO_IMAGE / reference2image (viduq1/viduq2)

    Configuration is read from environment variables:

    * VIDU_API_KEY - required; the API authentication key.
    * VIDU_API_BASE_URL - optional; defaults to
      https://api.vidu.cn.

    If VIDU_API_KEY is not set, create_task raises
    ValueError at call time.
    """

    DEFAULT_BASE_URL = "https://api.vidu.cn"

    def __init__(self, request_fn: Any = None) -> None:
        """Inject a custom HTTP caller for testing.

        *request_fn* is a callable (method, url, *, headers, json) -> dict.
        When omitted, _default_request is used.
        """
        self._request = request_fn if request_fn is not None else self._default_request

    # -- BaseProvider interface ------------------------------------------------

    def create_task(
        self,
        params: dict[str, Any],
        task_type: TaskType = TaskType.TEXT_TO_VIDEO,
    ) -> dict[str, Any]:
        """Submit a generation task to the Vidu API.

        The *task_type* selects the endpoint; *params* carries the
        generation parameters.

        Returns `{"provider_task_id": "<vidu-task-id>", "status": "pending"}`
        so the caller (or a polling loop) can later call query_task.
        """
        api_key = self._require_api_key()

        endpoint = TASK_ENDPOINTS.get(task_type)
        if endpoint is None:
            raise ValueError(f"Unsupported task type: {task_type!r}")

        payload = self._build_payload(params, task_type)

        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        }

        resp = self._request(
            "POST",
            f"{self._base_url()}{endpoint}",
            headers=headers,
            json=payload,
        )

        return {
            "provider_task_id": resp["task_id"],
            "status": "pending",
        }

    def query_task(self, provider_task_id: str) -> dict[str, Any]:
        """Poll the Vidu API for the task's current status.

        GET /ent/v2/tasks/{task_id}/creations

        The raw Vidu response uses `state` (not `status`) and the
        result lives at `creations[0].url`.  This method normalises
        the response into the standard provider contract:

        {"status": "success", "video_url": "...", "thumbnail_url": "..."}
        or for image tasks:
        {"status": "success", "image_url": "..."}
        """
        api_key = self._require_api_key()

        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        }

        raw = self._request(
            "GET",
            f"{self._base_url()}/ent/v2/tasks/{provider_task_id}/creations",
            headers=headers,
            json=None,
        )

        return self._normalize_query_response(raw)

    # -- Payload construction --------------------------------------------------

    @staticmethod
    def _build_payload(
        params: dict[str, Any],
        task_type: TaskType = TaskType.TEXT_TO_VIDEO,
    ) -> dict[str, Any]:
        """Build the Vidu API request payload from *params* and *task_type*.

        Image tasks use a lightweight payload (model, prompt,
        resolution, aspect_ratio, images).  Video tasks include
        animation-specific fields (duration, movement_amplitude,
        audio, bgm, subtitle, start/end frames).
        """
        if task_type in _IMAGE_TASKS:
            return ViduProvider._build_image_payload(params, task_type)
        return ViduProvider._build_video_payload(params)

    @staticmethod
    def _build_image_payload(
        params: dict[str, Any],
        task_type: TaskType,
    ) -> dict[str, Any]:
        """Build payload for /ent/v2/text2image or /ent/v2/reference2image."""
        # Normalize resolution: frontend sends "1K" but Vidu API expects "1080p"
        resolution = params.get("resolution", "2K")
        if resolution == "1K":
            resolution = "1080p"

        payload: dict[str, Any] = {
            "model": params.get("model", "viduq2"),
            "prompt": params.get("prompt", ""),
            "resolution": resolution,
            "aspect_ratio": params.get("aspect_ratio", "16:9"),
        }

        if params.get("seed"):
            payload["seed"] = int(params["seed"])
        if params.get("negative_prompt"):
            payload["negative_prompt"] = str(params["negative_prompt"])
        if params.get("callback_url"):
            payload["callback_url"] = str(params["callback_url"])

        # reference2image: include images array
        if task_type == TaskType.IMAGE_TO_IMAGE:
            refs: list[str] = list(params.get("reference_images", []) or [])
            if not refs and params.get("image_url"):
                refs = [params["image_url"]]
            if refs:
                payload["images"] = [get_public_file_url(r) for r in refs]

        return payload

    @staticmethod
    def _build_video_payload(params: dict[str, Any]) -> dict[str, Any]:
        """Build payload for video endpoints (text2video, img2video, etc.)."""
        payload: dict[str, Any] = {
            "model": params.get("model", "viduq3-turbo"),
            "prompt": params.get("prompt", ""),
            "duration": int(params.get("duration", 5)),
            "style": params.get("style", "general"),
            "aspect_ratio": params.get("aspect_ratio", "16:9"),
            "resolution": params.get("resolution", "1080p"),
            "movement_amplitude": params.get("movement_amplitude", "auto"),
            "audio": bool(params.get("audio_enabled", params.get("audio", True))),
            "bgm": bool(params.get("bgm", False)),
            "subtitle": bool(params.get("subtitle_enabled", False)),
            "off_peak": bool(params.get("off_peak", False)),
        }

        # Optional fields - only included when present
        if params.get("seed"):
            payload["seed"] = int(params["seed"])
        if params.get("negative_prompt"):
            payload["negative_prompt"] = str(params["negative_prompt"])
        if params.get("callback_url"):
            payload["callback_url"] = str(params["callback_url"])

        # Forward upstream reference_images / image_url as images array
        refs: list[str] = list(params.get("reference_images", []) or [])
        if not refs and params.get("image_url"):
            refs = [params["image_url"]]
        if refs:
            payload["images"] = [get_public_file_url(r) for r in refs]

        # start-end2video specific fields
        start_frame_url = params.get("start_frame_url")
        end_frame_url = params.get("end_frame_url")
        if start_frame_url or end_frame_url:
            # start-end2video: images[0]=start frame, images[1]=end frame
            img_arr = [get_public_file_url(u) for u in (start_frame_url, end_frame_url) if u]
            if img_arr:
                payload["images"] = img_arr

        return payload

    # -- Internal helpers ------------------------------------------------------

    @staticmethod
    def _normalize_query_response(raw: dict[str, Any]) -> dict[str, Any]:
        """Convert a raw Vidu /ent/v2/tasks/{id}/creations response into
        the standard provider return format used by ProviderPoller and
        WorkflowExecutor."""

        # Vidu uses "state" - map to "status"
        state = raw.get("state", "pending")

        result: dict[str, Any] = {
            "status": state,
        }

        # On success, the result is in creations[0]
        creations = raw.get("creations", [])
        if creations and isinstance(creations, list) and len(creations) > 0:
            c0 = creations[0]
            if c0.get("url"):
                result["video_url"] = c0["url"]
                result["image_url"] = c0["url"]  # also set for image tasks
            if c0.get("cover_url"):
                result["thumbnail_url"] = c0["cover_url"]
            if c0.get("duration"):
                result["duration"] = c0["duration"]

        # Passthrough error info
        if raw.get("err_code"):
            result["error"] = raw["err_code"]
        if raw.get("err_msg"):
            result["error_message"] = raw["err_msg"]

        # Passthrough progress (for logging/UI)
        if "progress" in raw:
            result["progress"] = raw["progress"]
        if "credits" in raw:
            result["credits"] = raw["credits"]

        return result

    def _base_url(self) -> str:
        return os.environ.get("VIDU_API_BASE_URL", self.DEFAULT_BASE_URL).rstrip("/")

    def _require_api_key(self) -> str:
        key = os.environ.get("VIDU_API_KEY")
        if not key:
            raise ValueError(
                "VIDU_API_KEY environment variable is not set. "
                "Set it to your Vidu API key."
            )
        return key

    @staticmethod
    def _default_request(
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Real HTTP call using `urllib.request` with 30-second timeout.

        Catches all known transport errors and re-raises them as
        `RuntimeError` with a consistent `"Vidu API error: ..."` prefix
        so callers can distinguish provider failures from application errors.
        """
        import urllib.request
        import urllib.error
        import json as _json

        data_bytes: bytes | None = None
        if json is not None:
            data_bytes = _json.dumps(json).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8")
                return _json.loads(body)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(
                f"Vidu API error: HTTP {exc.code} {exc.reason} for {method} {url}"
            ) from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(
                f"Vidu API error: network unreachable ({exc.reason}) for {method} {url}"
            ) from exc
        except TimeoutError as exc:
            raise RuntimeError(
                f"Vidu API error: request timed out for {method} {url}"
            ) from exc
