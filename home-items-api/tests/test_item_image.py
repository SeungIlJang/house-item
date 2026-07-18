import base64

import pytest
from fastapi.testclient import TestClient

from app.core import config

# 1x1 투명 PNG
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


@pytest.fixture()
def upload_tmp(monkeypatch, tmp_path):
    """업로드 경로를 임시 디렉터리로 바꿔 실제 uploads 폴더를 건드리지 않는다."""
    monkeypatch.setattr(config.settings, "upload_dir", str(tmp_path))
    return tmp_path


def _create_item(client: TestClient, headers: dict) -> int:
    home_id = client.post("/api/v1/homes", json={"name": "우리 집"}, headers=headers).json()[
        "data"
    ]["id"]
    return client.post(
        "/api/v1/items", json={"name": "여권", "homeId": home_id}, headers=headers
    ).json()["data"]["id"]


def _upload(client, headers, item_id, *, filename="photo.png", content_type="image/png"):
    return client.post(
        f"/api/v1/items/{item_id}/images",
        files={"file": (filename, _PNG_BYTES, content_type)},
        headers=headers,
    )


def test_upload_and_thumbnail(client: TestClient, auth_headers: dict, upload_tmp):
    item_id = _create_item(client, auth_headers)
    res = _upload(client, auth_headers, item_id)
    assert res.status_code == 201
    assert res.json()["data"]["imageUrl"].startswith("/uploads/items/")

    # 물건 상세에 이미지/대표 이미지 반영
    detail = client.get(f"/api/v1/items/{item_id}", headers=auth_headers).json()["data"]
    assert len(detail["images"]) == 1
    assert detail["thumbnailUrl"] == detail["images"][0]["imageUrl"]


def test_upload_non_image_rejected(client: TestClient, auth_headers: dict, upload_tmp):
    # 이미지가 아닌 파일은 거부 (형식이 아니라 디코딩 가능 여부로 판단)
    item_id = _create_item(client, auth_headers)
    res = client.post(
        f"/api/v1/items/{item_id}/images",
        files={"file": ("doc.txt", b"this is not an image", "text/plain")},
        headers=auth_headers,
    )
    assert res.status_code == 400
    assert res.json()["errorCode"] == "INVALID_IMAGE"


def test_upload_heic_is_converted(client: TestClient, auth_headers: dict, upload_tmp):
    # 삼성/아이폰 카메라의 HEIC 도 받아서 JPEG 로 변환 저장되어야 한다
    import io

    import pillow_heif  # noqa: F401  (등록 트리거)
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1200, 900), (10, 120, 200)).save(buf, format="HEIF")
    heic_bytes = buf.getvalue()

    item_id = _create_item(client, auth_headers)
    res = client.post(
        f"/api/v1/items/{item_id}/images",
        files={"file": ("photo.heic", heic_bytes, "image/heic")},
        headers=auth_headers,
    )
    assert res.status_code == 201
    # 저장은 jpg 로 변환됨
    assert res.json()["data"]["imageUrl"].endswith(".jpg")


def test_delete_image(client: TestClient, auth_headers: dict, upload_tmp):
    item_id = _create_item(client, auth_headers)
    image_id = _upload(client, auth_headers, item_id).json()["data"]["id"]

    res = client.delete(f"/api/v1/items/{item_id}/images/{image_id}", headers=auth_headers)
    assert res.status_code == 200

    detail = client.get(f"/api/v1/items/{item_id}", headers=auth_headers).json()["data"]
    assert detail["images"] == []
    assert detail["thumbnailUrl"] is None


def test_upload_ownership(client: TestClient, auth_headers: dict, other_headers: dict, upload_tmp):
    item_id = _create_item(client, auth_headers)
    res = _upload(client, other_headers, item_id)
    assert res.status_code == 404


def test_large_image_is_downscaled(client: TestClient, auth_headers: dict, upload_tmp):
    import io

    from PIL import Image

    # 3000x2000 큰 이미지를 업로드하면 긴 변이 1600 이하로 축소되어야 한다
    buf = io.BytesIO()
    Image.new("RGB", (3000, 2000), (120, 30, 30)).save(buf, format="JPEG", quality=95)
    big_bytes = buf.getvalue()

    item_id = _create_item(client, auth_headers)
    res = client.post(
        f"/api/v1/items/{item_id}/images",
        files={"file": ("big.jpg", big_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 201
    saved_path = res.json()["data"]["imageUrl"]

    # 저장된 파일을 열어 크기(치수/용량) 확인
    key = saved_path.replace("/uploads/", "")
    saved_file = upload_tmp / key
    with Image.open(saved_file) as saved_img:
        assert max(saved_img.size) <= 1600
    assert saved_file.stat().st_size < len(big_bytes)
