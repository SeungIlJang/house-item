"""파일 저장소(로컬 / S3·R2) 단위 테스트."""

from app.services.file_storage import LocalFileStorage, S3FileStorage


def test_local_storage_save_and_delete(tmp_path):
    storage = LocalFileStorage(str(tmp_path))
    url = storage.save(content=b"hello", key="items/1/2/a.jpg")
    assert url == "/uploads/items/1/2/a.jpg"
    assert (tmp_path / "items/1/2/a.jpg").read_bytes() == b"hello"

    storage.delete(url)
    assert not (tmp_path / "items/1/2/a.jpg").exists()


class _FakeS3Client:
    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def put_object(self, *, Bucket, Key, Body, ContentType):  # noqa: N803
        self.objects[Key] = Body
        self.last_content_type = ContentType

    def delete_object(self, *, Bucket, Key):  # noqa: N803
        self.objects.pop(Key, None)


def _make_s3(monkeypatch) -> S3FileStorage:
    import boto3

    fake = _FakeS3Client()
    monkeypatch.setattr(boto3, "client", lambda *a, **k: fake)
    storage = S3FileStorage(
        endpoint_url="https://acc.r2.cloudflarestorage.com",
        access_key_id="k",
        secret_access_key="s",
        bucket="home-items",
        public_base_url="https://pub-abc.r2.dev/",
        region="auto",
    )
    return storage


def test_s3_storage_save_returns_public_url(monkeypatch):
    storage = _make_s3(monkeypatch)
    url = storage.save(content=b"img", key="items/1/2/a.jpg")
    # 공개 URL(base + key) 반환, content-type 추론
    assert url == "https://pub-abc.r2.dev/items/1/2/a.jpg"
    assert storage.client.objects["items/1/2/a.jpg"] == b"img"
    assert storage.client.last_content_type == "image/jpeg"


def test_s3_storage_delete_uses_key(monkeypatch):
    storage = _make_s3(monkeypatch)
    storage.save(content=b"img", key="items/1/2/a.jpg")
    storage.delete("https://pub-abc.r2.dev/items/1/2/a.jpg")
    assert "items/1/2/a.jpg" not in storage.client.objects
