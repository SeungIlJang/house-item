"""파일 저장 인터페이스.

나중에 S3 등으로 교체하기 쉽도록 추상화합니다.
개발 환경에서는 로컬 파일 시스템(LocalFileStorage)을 사용합니다.

(주의) 여기서 말하는 'Storage'는 파일 저장소이며,
수납공간(StorageLocation)과는 다른 개념입니다.
"""

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
    """운영 배포 시 구현 예정(AWS S3 또는 호환 스토리지)."""

    def save(self, *, content: bytes, key: str) -> str:  # pragma: no cover
        raise NotImplementedError("S3FileStorage 는 아직 구현되지 않았습니다.")

    def delete(self, url: str) -> None:  # pragma: no cover
        raise NotImplementedError("S3FileStorage 는 아직 구현되지 않았습니다.")


def get_file_storage() -> FileStorage:
    """현재 환경에 맞는 파일 저장소를 반환."""
    return LocalFileStorage(settings.upload_dir)
