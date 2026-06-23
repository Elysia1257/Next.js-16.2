import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.providers.vidu_provider import ViduProvider
from app.providers.base import BaseProvider
from app.providers.provider_factory import register_provider, clear_providers, get_provider


# ===================================================================
#  Fixtures
# ===================================================================

@pytest.fixture(autouse=True)
def _purge_env_key(monkeypatch):
    """Remove VIDU_API_KEY from the environment so no test accidentally
    hits the real network."""
    monkeypatch.delenv("VIDU_API_KEY", raising=False)
    monkeypatch.delenv("VIDU_API_BASE_URL", raising=False)


# ===================================================================
#  Construction  & inheritance
# ===================================================================

class TestViduProviderConstruction:
    def test_inherits_base_provider(self):
        assert isinstance(ViduProvider(), BaseProvider)

    def test_is_abstract_concrete(self):
        """ViduProvider implements both abstract methods so it can be
        instantiated."""
        p = ViduProvider(request_fn=lambda *a, **kw: {})
        assert p is not None


# ===================================================================
#  API key handling
# ===================================================================

class TestApiKey:
    def test_raises_when_key_is_not_set(self):
        provider = ViduProvider(request_fn=lambda *a, **kw: {})
        with pytest.raises(ValueError, match="VIDU_API_KEY"):
            provider.create_task({"prompt": "test"})

    def test_raises_when_key_is_not_set_on_query(self):
        provider = ViduProvider(request_fn=lambda *a, **kw: {})
        with pytest.raises(ValueError, match="VIDU_API_KEY"):
            provider.query_task("job-123")

    def test_uses_key_from_env(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test-123")

        captured: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured
            captured["headers"] = dict(headers)
            captured["url"] = url
            captured["json"] = json
            return {"task_id": "vidu-job-abc"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "cat"})

        assert captured["headers"]["Authorization"] == "Token sk-test-123"


# ===================================================================
#  Base URL
# ===================================================================

class TestBaseUrl:
    def test_default_base_url(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_urls: list[str] = []

        def fake_request(method, url, *, headers, json):
            captured_urls.append(url)
            return {"task_id": "j1", "status": "pending"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "test"})
        captured_urls.clear()
        provider.query_task("j1")

        # Both calls should go to the default base
        assert captured_urls[0].startswith("https://api.vidu.cn")

    def test_custom_base_url(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")
        monkeypatch.setenv("VIDU_API_BASE_URL", "https://vidu-staging.example.com")

        captured_urls: list[str] = []

        def fake_request(method, url, *, headers, json):
            captured_urls.append(url)
            return {"task_id": "j1", "status": "pending"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "test"})
        captured_urls.clear()
        provider.query_task("j1")

        assert captured_urls[0].startswith("https://vidu-staging.example.com")


# ===================================================================
#  create_task
# ===================================================================

class TestCreateTask:
    def test_returns_provider_task_id_and_pending_status(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        def fake_request(method, url, *, headers, json):
            return {"task_id": "vidu-job-xyz"}

        provider = ViduProvider(request_fn=fake_request)
        result = provider.create_task({"prompt": "sunset"})

        assert result["provider_task_id"] == "vidu-job-xyz"
        assert result["status"] == "pending"  # create_task always returns pending

    def test_sends_correct_payload(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_payload: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured_payload
            captured_payload = dict(json)
            return {"task_id": "j1"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "dancing cat", "duration": 10,
                              "model": "vidu-3.0"})

        assert captured_payload["prompt"] == "dancing cat"
        assert captured_payload["duration"] == 10
        assert captured_payload["model"] == "vidu-3.0"

    def test_forwards_image_url_when_present(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_payload: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured_payload
            captured_payload = dict(json)
            return {"task_id": "j1"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "animate", "image_url": "demo.png"})

        assert "images" in captured_payload
        assert captured_payload["images"] == ["http://localhost:8000/uploads/demo.png"]

    def test_omits_image_url_when_absent(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_payload: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured_payload
            captured_payload = dict(json)
            return {"task_id": "j1"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "no image"})

        assert "images" not in captured_payload

    def test_forwards_aspect_ratio_when_present(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_payload: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured_payload
            captured_payload = dict(json)
            return {"task_id": "j1"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "wide", "aspect_ratio": "16:9"})

        assert captured_payload["aspect_ratio"] == "16:9"

    def test_default_model_when_not_specified(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_payload: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured_payload
            captured_payload = dict(json)
            return {"task_id": "j1"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "test"})

        assert captured_payload["model"] == "viduq3-turbo"


# ===================================================================
#  query_task
# ===================================================================

class TestQueryTask:
    def test_returns_status_and_video_url_on_success(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        def fake_request(method, url, *, headers, json):
            return {"state": "success", "creations": [{"url": "https://cdn.vidu.com/output.mp4"}]}

        provider = ViduProvider(request_fn=fake_request)
        result = provider.query_task("job-123")

        assert result["status"] == "success"
        assert result["video_url"] == "https://cdn.vidu.com/output.mp4"

    def test_returns_pending_when_not_ready(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        def fake_request(method, url, *, headers, json):
            return {"state": "queueing"}

        provider = ViduProvider(request_fn=fake_request)
        result = provider.query_task("job-123")

        assert result["status"] == "queueing"  # Vidu raw state, normalized by poller STATUS_MAP

    def test_returns_failed_with_error(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        def fake_request(method, url, *, headers, json):
            return {"state": "failed", "err_code": "Content policy violation", "err_msg": "policy"}

        provider = ViduProvider(request_fn=fake_request)
        result = provider.query_task("job-123")

        assert result["status"] == "failed"
        assert result["error"] == "Content policy violation"

    def test_uses_correct_url_with_task_id(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_url: str = ""

        def fake_request(method, url, *, headers, json):
            nonlocal captured_url
            captured_url = url
            return {"status": "success", "video_url": "out.mp4"}

        provider = ViduProvider(request_fn=fake_request)
        provider.query_task("job-abc-456")

        assert "job-abc-456" in captured_url
        assert "/ent/v2/tasks/" in captured_url and "/creations" in captured_url


# ===================================================================
#  Integration: ViduProvider in the provider factory
# ===================================================================

class TestViduProviderInFactory:
    def teardown_method(self):
        """Reset the factory to its default state after each test."""
        clear_providers()

    def test_register_and_retrieve_from_factory(self):
        p = ViduProvider(request_fn=lambda *a, **kw: {})
        register_provider("vidu", p)

        retrieved = get_provider("vidu")
        assert retrieved is p
        assert isinstance(retrieved, ViduProvider)

    def test_vidu_does_not_replace_mock(self):
        """Registering vidu should leave mock untouched."""
        p = ViduProvider(request_fn=lambda *a, **kw: {})
        register_provider("vidu", p)

        from app.providers.mock_provider import MockProvider
        assert isinstance(get_provider("mock"), MockProvider)
        assert isinstance(get_provider("vidu"), ViduProvider)

    def test_clear_providers_removes_vidu(self):
        p = ViduProvider(request_fn=lambda *a, **kw: {})
        register_provider("vidu", p)
        assert get_provider("vidu") is not None

        clear_providers()
        assert get_provider("vidu") is None
        # mock should be restored
        from app.providers.mock_provider import MockProvider
        assert isinstance(get_provider("mock"), MockProvider)








# ===================================================================
#  TaskType dispatching
# ===================================================================

class TestTaskTypeRouting:
    """Verify that ViduProvider routes to the correct endpoint based on
    the task_type parameter — the provider must NOT infer the type."""

    def test_text_to_video_hits_correct_endpoint(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_url: str = ""

        def fake_request(method, url, *, headers, json):
            nonlocal captured_url
            captured_url = url
            return {"task_id": "j1"}

        from app.executors.task_type import TaskType

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "test"}, task_type=TaskType.TEXT_TO_VIDEO)

        assert "/ent/v2/text2video" in captured_url

    def test_image_to_video_hits_correct_endpoint(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_url: str = ""

        def fake_request(method, url, *, headers, json):
            nonlocal captured_url
            captured_url = url
            return {"task_id": "j1"}

        from app.executors.task_type import TaskType

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task(
            {"prompt": "test", "image_url": "upstream.png"},
            task_type=TaskType.IMAGE_TO_VIDEO,
        )

        assert "/ent/v2/img2video" in captured_url

    def test_reference_to_video_hits_correct_endpoint(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_url: str = ""

        def fake_request(method, url, *, headers, json):
            nonlocal captured_url
            captured_url = url
            return {"task_id": "j1"}

        from app.executors.task_type import TaskType

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task(
            {"prompt": "test", "reference_images": ["a.png", "b.png"]},
            task_type=TaskType.REFERENCE_TO_VIDEO,
        )

        assert "/ent/v2/reference2video" in captured_url

    def test_start_end_to_video_hits_correct_endpoint(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_url: str = ""

        def fake_request(method, url, *, headers, json):
            nonlocal captured_url
            captured_url = url
            return {"task_id": "j1"}

        from app.executors.task_type import TaskType

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task(
            {"prompt": "test", "start_frame_url": "start.png", "end_frame_url": "end.png"},
            task_type=TaskType.START_END_TO_VIDEO,
        )

        assert "/ent/v2/start-end2video" in captured_url

    def test_defaults_to_text_to_video_when_no_task_type(self, monkeypatch):
        """Backward compat: calling create_task without task_type
        must default to TEXT_TO_VIDEO."""
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_url: str = ""

        def fake_request(method, url, *, headers, json):
            nonlocal captured_url
            captured_url = url
            return {"task_id": "j1"}

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task({"prompt": "test"})

        assert "/ent/v2/text2video" in captured_url

    def test_raises_on_unsupported_task_type(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        provider = ViduProvider(request_fn=lambda *a, **kw: {"task_id": "x"})
        with pytest.raises(ValueError, match="Unsupported task type"):
            provider.create_task({"prompt": "test"}, task_type="unknown_type")  # type: ignore[arg-type]

    def test_payload_includes_images_for_image_to_video(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_payload: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured_payload
            captured_payload = dict(json)
            return {"task_id": "j1"}

        from app.executors.task_type import TaskType

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task(
            {"prompt": "test", "image_url": "ref.png"},
            task_type=TaskType.IMAGE_TO_VIDEO,
        )

        assert "images" in captured_payload
        assert len(captured_payload["images"]) == 1

    def test_payload_includes_multiple_images_for_reference_to_video(self, monkeypatch):
        monkeypatch.setenv("VIDU_API_KEY", "sk-test")

        captured_payload: dict = {}

        def fake_request(method, url, *, headers, json):
            nonlocal captured_payload
            captured_payload = dict(json)
            return {"task_id": "j1"}

        from app.executors.task_type import TaskType

        provider = ViduProvider(request_fn=fake_request)
        provider.create_task(
            {"prompt": "test", "reference_images": ["a.png", "b.png", "c.png"]},
            task_type=TaskType.REFERENCE_TO_VIDEO,
        )

        assert "images" in captured_payload
        assert len(captured_payload["images"]) == 3


# ===================================================================
#  VideoNodeExecutor task-type resolution
# ===================================================================

class TestVideoNodeExecutorTaskType:
    """Verify that VideoNodeExecutor correctly determines the task type."""

    def test_resolves_text_to_video_when_no_images(self):
        from app.executors.nodes.video_node import _determine_task_type
        from app.executors.task_type import TaskType

        result = _determine_task_type({"prompt": "a cat"})
        assert result == TaskType.TEXT_TO_VIDEO

    def test_resolves_image_to_video_when_image_url_present(self):
        from app.executors.nodes.video_node import _determine_task_type
        from app.executors.task_type import TaskType

        result = _determine_task_type({"prompt": "a cat", "image_url": "up.png"})
        assert result == TaskType.IMAGE_TO_VIDEO

    def test_resolves_reference_to_video_when_reference_images_present(self):
        from app.executors.nodes.video_node import _determine_task_type
        from app.executors.task_type import TaskType

        result = _determine_task_type({
            "prompt": "a cat",
            "reference_images": ["a.png", "b.png"],
        })
        assert result == TaskType.REFERENCE_TO_VIDEO

    def test_resolves_start_end_to_video_when_both_frames_present(self):
        from app.executors.nodes.video_node import _determine_task_type
        from app.executors.task_type import TaskType

        result = _determine_task_type({
            "prompt": "a cat",
            "start_frame_url": "start.png",
            "end_frame_url": "end.png",
        })
        assert result == TaskType.START_END_TO_VIDEO

    def test_reference_images_take_priority_over_image_url(self):
        from app.executors.nodes.video_node import _determine_task_type
        from app.executors.task_type import TaskType

        result = _determine_task_type({
            "prompt": "a cat",
            "image_url": "single.png",
            "reference_images": ["a.png", "b.png"],
        })
        assert result == TaskType.REFERENCE_TO_VIDEO

    def test_start_end_takes_priority_over_images(self):
        from app.executors.nodes.video_node import _determine_task_type
        from app.executors.task_type import TaskType

        result = _determine_task_type({
            "prompt": "a cat",
            "image_url": "single.png",
            "reference_images": ["a.png", "b.png"],
            "start_frame_url": "start.png",
            "end_frame_url": "end.png",
        })
        assert result == TaskType.START_END_TO_VIDEO

    def test_executor_passes_task_type_to_provider(self):
        """End-to-end: VideoNodeExecutor passes the correct task_type
        to the provider."""
        from app.providers.provider_factory import register_provider, clear_providers
        from app.providers.mock_provider import MockProvider
        from app.executors.task_type import TaskType

        clear_providers()

        captured_task_type = []

        class CapturingProvider(MockProvider):
            def create_task(self, params, task_type=None):
                captured_task_type.append(task_type)
                return super().create_task(params, task_type=task_type or TaskType.TEXT_TO_VIDEO)

        register_provider("capture", CapturingProvider())

        executor = VideoNodeExecutor()

        # Case 1: No images → TEXT_TO_VIDEO
        executor.execute(
            {"id": "v1", "type": "videoNode",
             "data": {"provider_name": "capture", "prompt": "test"}},
            {},
        )
        assert captured_task_type[-1] == TaskType.TEXT_TO_VIDEO

        # Case 2: Has image_url → IMAGE_TO_VIDEO
        executor.execute(
            {"id": "v2", "type": "videoNode",
             "data": {"provider_name": "capture", "prompt": "test"}},
            {"_parent_outputs": {"img": {"image_url": "up.png"}}},
        )
        assert captured_task_type[-1] == TaskType.IMAGE_TO_VIDEO

        # Case 3: Has reference_images → REFERENCE_TO_VIDEO
        executor.execute(
            {"id": "v3", "type": "videoNode",
             "data": {"provider_name": "capture", "prompt": "test"}},
            {"_parent_outputs": {"img": {"reference_images": ["a.png", "b.png"]}}},
        )
        assert captured_task_type[-1] == TaskType.REFERENCE_TO_VIDEO

        clear_providers()
