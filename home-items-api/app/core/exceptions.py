"""공통 예외와 예외 처리기.

업무 로직에서는 AppError(및 하위 예외)를 발생시키고,
여기서 일관된 오류 응답(JSON)으로 변환합니다.
운영 환경에서는 상세 오류를 숨깁니다.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """애플리케이션 공통 예외."""

    status_code: int = 400
    error_code: str = "ERROR"

    def __init__(
        self,
        message: str,
        *,
        error_code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        self.message = message
        if error_code is not None:
            self.error_code = error_code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    error_code = "NOT_FOUND"


class UnauthorizedError(AppError):
    status_code = 401
    error_code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = 403
    error_code = "FORBIDDEN"


class ConflictError(AppError):
    status_code = 409
    error_code = "CONFLICT"


def _error_body(message: str, error_code: str) -> dict:
    return {"success": False, "data": None, "message": message, "errorCode": error_code}


def register_exception_handlers(app: FastAPI, *, is_production: bool) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.message, exc.error_code),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_body("입력값이 올바르지 않습니다.", "VALIDATION_ERROR"),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(str(exc.detail), "HTTP_ERROR"),
        )

    @app.exception_handler(Exception)
    async def _handle_unhandled(request: Request, exc: Exception) -> JSONResponse:
        # 운영에서는 내부 정보를 숨기고, 개발에서는 원인을 노출해 디버깅을 돕는다.
        message = "서버 오류가 발생했습니다." if is_production else f"{type(exc).__name__}: {exc}"
        return JSONResponse(
            status_code=500,
            content=_error_body(message, "INTERNAL_ERROR"),
        )
