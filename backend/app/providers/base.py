from abc import ABC, abstractmethod
from typing import Any


class BaseProvider(ABC):
    """Abstract interface for video generation providers.

    Each concrete provider implements two methods:

    * ``create_task`` — submit a generation request and return
      provider-specific metadata (e.g. provider task id, initial status).
      Receives a ``task_type`` so the provider knows which API endpoint
      to call without any inference logic.

    * ``query_task`` — poll the provider for the current task status
      and result.
    """

    @abstractmethod
    def create_task(
        self,
        params: dict[str, Any],
        task_type: str = "text2video",
    ) -> dict[str, Any]:
        """Submit a generation task to the provider.

        *params* carries node-level configuration (prompt, duration,
        model, etc.) plus upstream outputs.

        *task_type* tells the provider which concrete API endpoint to
        use.  The executor is responsible for determining the correct
        task type before calling this method; the provider must
        **not** infer the task type from ``params``.

        Returns a dict with provider task metadata (at minimum a
        provider task identifier).
        """
        ...

    @abstractmethod
    def query_task(self, provider_task_id: str) -> dict[str, Any]:
        """Poll the provider for the task result.

        Returns a dict with ``status`` and (when complete) the output
        data (e.g. ``{"status": "success", "video_url": "demo.mp4"}``).
        """
        ...
