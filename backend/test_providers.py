import sys
import os

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.providers.base import BaseProvider
from app.providers.mock_provider import MockProvider
from app.providers.provider_factory import (
    get_provider,
    register_provider,
    clear_providers,
)
from app.executors.nodes.video_node import VideoNodeExecutor
from app.executors.workflow_executor import WorkflowExecutor


# ===================================================================
#  BaseProvider  abstractness
# ===================================================================

class TestBaseProvider:
    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError):
            BaseProvider()

    def test_subclass_must_implement_create_task(self):
        class IncompleteProvider(BaseProvider):
            def query_task(self, provider_task_id: str):
                pass

        with pytest.raises(TypeError):
            IncompleteProvider()  # missing create_task

    def test_subclass_must_implement_query_task(self):
        class IncompleteProvider(BaseProvider):
            def create_task(self, params, task_type=None):
                pass

        with pytest.raises(TypeError):
            IncompleteProvider()  # missing query_task


# ===================================================================
#  MockProvider
# ===================================================================

class TestMockProvider:
    def test_create_task_returns_canned_result(self):
        provider = MockProvider()
        result = provider.create_task({"prompt": "a cat"})
        assert result["video_url"] == "demo.mp4"
        assert result["provider_task_id"] == "mock-001"
        assert result["status"] == "success"

    def test_create_task_preserves_extra_keys(self):
        """The provider should return provider_task_id, status, and video_url
        regardless of the input params."""
        provider = MockProvider()
        result = provider.create_task({})
        assert "video_url" in result
        assert "provider_task_id" in result
        assert "status" in result

    def test_query_task_returns_canned_result(self):
        provider = MockProvider()
        result = provider.query_task("anything")
        assert result["video_url"] == "demo.mp4"
        assert result["status"] == "success"


# ===================================================================
#  ProviderFactory
# ===================================================================

class TestProviderFactory:
    def test_get_provider_returns_mock_by_name(self):
        provider = get_provider("mock")
        assert isinstance(provider, MockProvider)

    def test_get_provider_returns_none_for_unknown_name(self):
        provider = get_provider("nonexistent")
        assert provider is None

    def test_register_provider_adds_new_entry(self):
        clear_providers()

        class CustomProvider(MockProvider):
            pass

        custom = CustomProvider()
        register_provider("custom", custom)
        provider = get_provider("custom")
        assert provider is custom
        assert isinstance(provider, CustomProvider)

        # Still can get mock
        assert isinstance(get_provider("mock"), MockProvider)

        clear_providers()

    def test_clear_providers_resets_to_defaults(self):
        register_provider("extra", MockProvider())
        clear_providers()
        assert get_provider("extra") is None
        assert isinstance(get_provider("mock"), MockProvider)


# ===================================================================
#  VideoNodeExecutor  uses provider
# ===================================================================

class TestVideoNodeExecutorWithProvider:
    def test_uses_mock_provider_by_default(self):
        executor = VideoNodeExecutor()
        result = executor.execute({"id": "v1", "type": "videoNode", "data": {}}, {})
        d = result.to_dict()
        assert d["provider_task_id"] == "mock-001"
        assert d["video_url"] == "demo.mp4"

    def test_uses_provider_name_from_data(self):
        clear_providers()

        class AnotherMock(MockProvider):
            def create_task(self, params, task_type=None):
                return {"video_url": "custom.mp4", "provider_task_id": "x-99",
                        "status": "success"}

        register_provider("another", AnotherMock())

        executor = VideoNodeExecutor()
        result = executor.execute(
            {"id": "v1", "type": "videoNode",
             "data": {"provider_name": "another"}},
            {},
        )
        d = result.to_dict()
        assert d["video_url"] == "custom.mp4"
        assert d["provider_task_id"] == "x-99"

        clear_providers()

    def test_raises_on_unknown_provider(self):
        executor = VideoNodeExecutor()
        with pytest.raises(ValueError, match=r"Unknown provider"):
            executor.execute(
                {"id": "v1", "type": "videoNode",
                 "data": {"provider_name": "nonexistent"}},
                {},
            )

    def test_forwards_node_data_to_provider(self):
        """Node data fields (prompt, duration, model) are passed through."""
        clear_providers()

        captured_params: dict = {}

        class CapturingProvider(MockProvider):
            def create_task(self, params, task_type=None):
                nonlocal captured_params
                captured_params = dict(params)
                return super().create_task(params)

        register_provider("capture", CapturingProvider())
        executor = VideoNodeExecutor()
        executor.execute(
            {"id": "v1", "type": "videoNode",
             "data": {"prompt": "dancing cat", "duration": 10,
                      "model": "gen3", "provider_name": "capture"}},
            {},
        )
        assert captured_params["prompt"] == "dancing cat"
        assert captured_params["duration"] == 10
        assert captured_params["model"] == "gen3"

        clear_providers()

    def test_merges_upstream_image_url_into_params(self):
        """When an ImageNode runs upstream, its image_url should appear
        in the provider params."""
        clear_providers()

        captured_params: dict = {}

        class CapturingProvider(MockProvider):
            def create_task(self, params, task_type=None):
                nonlocal captured_params
                captured_params = dict(params)
                return super().create_task(params)

        register_provider("capture2", CapturingProvider())
        executor = VideoNodeExecutor()
        context = {
            "_parent_outputs": {
                "img": {"image_url": "upstream.png"},
            }
        }
        executor.execute(
            {"id": "v1", "type": "videoNode",
             "data": {"provider_name": "capture2"}},
            context,
        )
        assert captured_params["image_url"] == "upstream.png"

        clear_providers()


# ===================================================================
#  WorkflowExecutor end-to-end with provider
# ===================================================================

def test_workflow_executor_with_provider():
    """Full executor run with VideoNode using MockProvider via registry."""
    import json

    wf_json = json.dumps({
        "nodes": [
            {"id": "img", "type": "imageNode", "data": {}},
            {"id": "vid", "type": "videoNode",
             "data": {"provider_name": "mock", "prompt": "test"}},
            {"id": "res", "type": "resultNode", "data": {}},
        ],
        "edges": [
            {"source": "img", "target": "vid"},
            {"source": "vid", "target": "res"},
        ],
    })

    executor = WorkflowExecutor()
    context = executor.execute(wf_json)

    assert context["img"]["image_url"] == "demo.png"
    assert context["vid"]["video_url"] == "demo.mp4"
    assert context["vid"]["provider_task_id"] == "mock-001"
    assert context["res"]["status"] == "success"
    assert context["res"]["video_url"] == "demo.mp4"
