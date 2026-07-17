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


def test_signup_seeds_defaults(client: TestClient):
    _signup(client)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    token = login.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # 기본 집 1개
    homes = client.get("/api/v1/homes", headers=headers).json()["data"]
    assert len(homes) == 1
    assert homes[0]["name"] == "우리 집"

    # 기본 장소(방) 5개
    rooms = client.get(f"/api/v1/homes/{homes[0]['id']}/rooms", headers=headers).json()["data"]
    room_names = [r["name"] for r in rooms]
    assert room_names == [
        "거실",
        "주방",
        "화장실1",
        "안방",
        "안방화장실",
        "작은방1",
        "작은방2",
        "작은방3",
        "베란다1",
        "베란다2",
    ]

    # 장소별 기본 수납공간 (예: 주방 → 냉장고/싱크대)
    kitchen = next(r for r in rooms if r["name"] == "주방")
    tree = client.get(f"/api/v1/rooms/{kitchen['id']}/storage-locations", headers=headers).json()[
        "data"
    ]
    storage_names = {node["name"] for node in tree}
    assert {"냉장고", "싱크대"} <= storage_names

    # 기본 카테고리/태그
    categories = client.get("/api/v1/categories", headers=headers).json()["data"]
    tags = client.get("/api/v1/tags", headers=headers).json()["data"]
    category_names = {c["name"] for c in categories}
    tag_names = {t["name"] for t in tags}
    assert {"전자제품", "의류", "서류", "주방용품", "공구", "생활용품"} <= category_names
    assert {"중요", "자주사용", "겨울용", "비상용"} <= tag_names
