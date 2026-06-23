import io
import os
import sys
import pathlib

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

UPLOADS_IMAGES = (
    pathlib.Path(__file__).resolve().parent
    / "uploads" / "images"
)

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_upload_image_success(client):
    """POST /upload/image with a valid PNG file returns 200 and
    includes filename + url."""
    fake_image = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64  # minimal valid PNG header

    resp = client.post(
        "/upload/image",
        files={"file": ("test.png", io.BytesIO(fake_image), "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["filename"].endswith(".png")
    assert data["url"].startswith("/uploads/images/")
    assert data["url"].endswith(data["filename"])


def test_uploaded_file_exists_on_disk(client):
    """The uploaded file should actually exist under uploads/images/."""
    fake_image = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

    resp = client.post(
        "/upload/image",
        files={"file": ("photo.jpg", io.BytesIO(fake_image), "image/jpeg")},
    )
    data = resp.json()
    file_path = UPLOADS_IMAGES / data["filename"]
    assert file_path.exists()
    assert file_path.read_bytes() == fake_image


def test_uploaded_file_served_statically(client):
    """The uploaded file should be accessible via GET on the returned URL."""
    fake_image = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

    resp = client.post(
        "/upload/image",
        files={"file": ("icon.png", io.BytesIO(fake_image), "image/png")},
    )
    data = resp.json()
    url = data["url"]

    # Fetch it via the static mount
    get_resp = client.get(url)
    assert get_resp.status_code == 200
    assert get_resp.content == fake_image


def test_upload_missing_file_returns_422(client):
    """Calling /upload/image without a file should return 422."""
    resp = client.post("/upload/image")
    assert resp.status_code == 422
