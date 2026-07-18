"""파일 저장 인터페이스.

나중에 S3 등으로 교체하기 쉽도록 추상화합니다.
개발 환경에서는 로컬 파일 시스템(LocalFileStorage)을 사용합니다.

(주의) 여기서 말하는 'Storage'는 파일 저장소이며,
수납공간(StorageLocation)과는 다른 개념입니다.
"""

import mimetypes
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import settings


class FileStorage(ABC):
    @abstractmethod
    def save(self, *, content: bytes, key: str) -> str:
        """파일을 저장하고 접근 가능한 URL(또는 경로)을 돌려준다."""

    @abstractmethod
    def delete(self, url: str) -> None:
        """저장된 파일을 삭제한다."""


class LocalFileStorage(FileStorage):
    def __init__(self, base_dir: str, base_url: str = "/uploads") -> None:
        self.base_dir = Path(base_dir)
        self.base_url = base_url.rstrip("/")

    def save(self, *, content: bytes, key: str) -> str:
        path = self.base_dir / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return f"{self.base_url}/{key}"

    def delete(self, url: str) -> None:
        if not url.startswith(self.base_url + "/"):
            return
        key = url[len(self.base_url) + 1 :]
        path = self.base_dir / key
        path.unlink(missing_ok=True)


class S3FileStorage(FileStorage):
    """AWS S3 및 호환 스토리지(Cloudflare R2 등).

    R2 는 S3 API 호환이라 endpoint_url 만 바꿔주면 동작합니다.
    저장 후에는 공개 접근 URL(s3_public_base_url + key)을 반환합니다.
    """

    def __init__(
        self,
        *,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        public_base_url: str,
        region: str = "auto",
    ) -> None:
        import boto3

        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
        )

    def save(self, *, content: bytes, key: str) -> str:
        content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)
        return f"{self.public_base_url}/{key}"

    def delete(self, url: str) -> None:
        prefix = self.public_base_url + "/"
        if not url.startswith(prefix):
            return
        key = url[len(prefix) :]
        self.client.delete_object(Bucket=self.bucket, Key=key)


def get_file_storage() -> FileStorage:
    """현재 설정에 맞는 파일 저장소를 반환."""
    if settings.storage_backend == "s3":
        return S3FileStorage(
            endpoint_url=settings.s3_endpoint_url,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            bucket=settings.s3_bucket,
            public_base_url=settings.s3_public_base_url,
            region=settings.s3_region,
        )
    return LocalFileStorage(settings.upload_dir)
