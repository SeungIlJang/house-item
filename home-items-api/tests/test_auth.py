from fastapi.testclient import TestClient


def _signup(client: TestClient, email="user@example.com", password="password123", name="홍길동"):
    return client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "name": name},
    )


def test_signup_success(client: TestClient):
    res = _signup(client)
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert body["data"]["email"] == "user@example.com"
    assert body["data"]["name"] == "홍길동"
    # 비밀번호/해시는 응답에 절대 포함되지 않아야 한다
    assert "password" not in body["data"]
    assert "passwordHash" not in body["data"]


def test_signup_duplicate_email(client: TestClient):
    _signup(client)
    res = _signup(client)
    assert res.status_code == 409
    body = res.json()
    assert body["success"] is False
    assert body["errorCode"] == "EMAIL_ALREADY_EXISTS"


def test_signup_invalid_email(client: TestClient):
    res = _signup(client, email="not-an-email")
    assert res.status_code == 422
    assert res.json()["errorCode"] == "VALIDATION_ERROR"


def test_login_success_and_me(client: TestClient):
    _signup(client)
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert res.status_code == 200
    token = res.json()["data"]["accessToken"]
    assert token

    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "user@example.com"


def test_login_wrong_password(client: TestClient):
    _signup(client)
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "wrongpassword"},
    )
    assert res.status_code == 401
    assert res.json()["errorCode"] == "INVALID_CREDENTIALS"


def test_me_requires_auth(client: TestClient):
    res = client.get("/api/v1/users/me")
    assert res.status_code == 401
    assert res.json()["errorCode"] == "NOT_AUTHENTICATED"


def test_me_invalid_token(client: TestClient):
    res = client.get("/api/v1/users/me", headers={"Authorization": "Bearer invalid.token"})
    assert res.status_code == 401
    assert res.json()["errorCode"] == "INVALID_TOKEN"
