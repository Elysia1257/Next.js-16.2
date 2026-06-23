"""Generation task type enumeration.

Defines the canonical set of task types that executors can request
from a provider.  The provider uses the task type to select the
correct API endpoint without any inferential logic.

Video types (Vidu, Kling, Runway, etc.):
  - TEXT_TO_VIDEO      -> /ent/v2/text2video
  - IMAGE_TO_VIDEO     -> /ent/v2/img2video
  - REFERENCE_TO_VIDEO -> /ent/v2/reference2video
  - START_END_TO_VIDEO -> /ent/v2/start_end2video

Image types (Vidu):
  - TEXT_TO_IMAGE      -> /ent/v2/text2image      (viduq2 only)
  - IMAGE_TO_IMAGE     -> /ent/v2/reference2image  (viduq1/viduq2)
"""

from enum import Enum


class TaskType(str, Enum):
    """Generation task type.

    Each value maps to a concrete API endpoint path suffix.
    Video providers map video types; image providers map image types.
    The provider must route by task_type without inference.
    """

    # Video generation
    TEXT_TO_VIDEO = "text2video"
    IMAGE_TO_VIDEO = "img2video"
    REFERENCE_TO_VIDEO = "reference2video"
    START_END_TO_VIDEO = "start_end2video"

    # Image generation
    TEXT_TO_IMAGE = "text2image"
    IMAGE_TO_IMAGE = "reference2image"
