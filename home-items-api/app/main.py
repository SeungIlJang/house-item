"""집안의모든것 백엔드 진입점.

2단계에서는 프로젝트가 정상 동작하는지 확인하기 위한 최소 앱만 둡니다.
설정 관리, CORS, 공통 응답/예외 처리는 4단계에서 추가합니다.
"""

from fastapi import FastAPI

app = FastAPI(title="home-items API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
