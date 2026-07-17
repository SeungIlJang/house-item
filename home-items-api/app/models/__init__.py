"""모델 패키지.

여기서 모든 모델을 import 해 두면 Alembic autogenerate 와
SQLAlchemy 관계 설정이 모델을 인식합니다.
"""

from app.models.user import User

__all__ = ["User"]
