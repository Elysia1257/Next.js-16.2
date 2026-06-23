from typing import Any

from app.providers.base import BaseProvider
from app.executors.task_type import TaskType


class MockProvider(BaseProvider):
    """A mock provider that returns canned results.

    Returns a video URL for video task types and an image URL for
    image task types, allowing end-to-end testing of both pipelines.
    """

    _IMAGE_TASKS = {TaskType.TEXT_TO_IMAGE, TaskType.IMAGE_TO_IMAGE}

    def create_task(
        self,
        params: dict[str, Any],
        task_type: TaskType = TaskType.TEXT_TO_VIDEO,
    ) -> dict[str, Any]:
        if task_type in self._IMAGE_TASKS:
            return {
                "provider_task_id": "mock-001",
                "status": "success",
                "image_url": "demo.png",
            }
        return {
            "provider_task_id": "mock-001",
            "status": "success",
            "video_url": "demo.mp4",
        }

    def query_task(self, provider_task_id: str) -> dict[str, Any]:
        return {
            "status": "success",
            "video_url": "demo.mp4",
        }
