"""Utilities for resolving file paths to publicly-accessible URLs.

Used by providers (ViduProvider, future image providers) to convert
locally-stored uploaded files into URLs that external APIs can reach.
"""

import os
import pathlib
from urllib.parse import urljoin


_PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
_UPLOADS_DIR = _PROJECT_ROOT / "uploads"


def _get_server_origin() -> str:
    return os.environ.get("SERVER_ORIGIN", "http://localhost:8000").rstrip("/")


def _is_local_path(value: str) -> bool:
    if not value:
        return False
    if value.startswith("/") or value.startswith("\\"):
        return True
    if "://" in value:
        return False
    if value.startswith("/uploads/") or value.startswith("uploads/"):
        return True
    return False


def get_public_file_url(path_or_url: str) -> str:
    """Convert *path_or_url* into an absolute URL reachable by external services.

    Rules:
    1. Already a full URL (http:// / https://) → returned unchanged.
    2. Absolute local path under uploads/ → resolved to server-relative then joined.
    3. Server-relative path starting with /uploads/ → joined with origin.
    4. Other relative path → treated as relative to /uploads/.
    5. Empty / None → returned as-is.
    """
    if not path_or_url:
        return path_or_url

    origin = _get_server_origin()

    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url

    uploads_str = str(_UPLOADS_DIR).replace("\\", "/")
    rel = path_or_url.replace("\\", "/")

    if rel.startswith(uploads_str):
        rel = rel[len(uploads_str):]
        if not rel.startswith("/"):
            rel = "/" + rel
        return urljoin(origin, rel)

    if rel.startswith("/uploads/"):
        return urljoin(origin, rel)

    if not rel.startswith("/"):
        return urljoin(origin, f"/uploads/{rel}")

    return rel
