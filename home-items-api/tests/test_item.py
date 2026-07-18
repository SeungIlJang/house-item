from fastapi.testclient import TestClient


def _setup(client: TestClient, headers: dict) -> dict:
    """집/방/수납공간/카테고리/태그를 만들고 id 들을 반환."""
    home_id = client.post("/api/v1/homes", json={"name": "우리 집"}, headers=headers).json()[
        "data"
    ]["id"]
    room_id = client.post(
        f"/api/v1/homes/{home_id}/rooms", json={"name": "안방"}, headers=headers
    ).json()["data"]["id"]
    storage_id = client.post(
        f"/api/v1/rooms/{room_id}/storage-locations",
        json={"name": "붙박이장"},
        headers=headers,
    ).json()["data"]["id"]
    category_id = client.post(
        "/api/v1/categories", json={"name": "취미용품"}, headers=headers
    ).json()["data"]["id"]
    tag_id = client.post("/api/v1/tags", json={"name": "즐겨찾기"}, headers=headers).json()["data"][
        "id"
    ]
    return {
        "home_id": home_id,
        "room_id": room_id,
        "storage_id": storage_id,
        "category_id": category_id,
        "tag_id": tag_id,
    }


def test_item_create_full(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    res = client.post(
        "/api/v1/items",
        json={
            "name": "휴대전화 충전기",
            "quantity": 2,
            "memo": "고속충전",
            "homeId": ids["home_id"],
            "roomId": ids["room_id"],
            "storageLocationId": ids["storage_id"],
            "categoryId": ids["category_id"],
            "tagIds": [ids["tag_id"]],
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["name"] == "휴대전화 충전기"
    assert data["categoryName"] == "취미용품"
    assert data["roomName"] == "안방"
    assert data["storageFullPath"] == "안방 > 붙박이장"
    assert [t["name"] for t in data["tags"]] == ["즐겨찾기"]


def test_item_create_without_name(client: TestClient, auth_headers: dict):
    # 이름은 선택 항목 — 이름 없이도 등록 가능
    ids = _setup(client, auth_headers)
    res = client.post(
        "/api/v1/items",
        json={"homeId": ids["home_id"], "roomId": ids["room_id"]},
        headers=auth_headers,
    )
    assert res.status_code == 201
    assert res.json()["data"]["name"] == ""


def test_item_list_pagination(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    for i in range(3):
        client.post(
            "/api/v1/items",
            json={"name": f"물건{i}", "homeId": ids["home_id"]},
            headers=auth_headers,
        )
    res = client.get("/api/v1/items?page=1&size=2", headers=auth_headers)
    assert res.status_code == 200
    page = res.json()["data"]
    assert page["totalElements"] == 3
    assert page["totalPages"] == 2
    assert len(page["content"]) == 2


def test_item_update_and_delete(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    item_id = client.post(
        "/api/v1/items",
        json={"name": "여권", "homeId": ids["home_id"]},
        headers=auth_headers,
    ).json()["data"]["id"]

    res = client.put(
        f"/api/v1/items/{item_id}",
        json={"name": "여권(수정)", "quantity": 1, "homeId": ids["home_id"]},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "여권(수정)"

    assert client.delete(f"/api/v1/items/{item_id}", headers=auth_headers).status_code == 200
    assert client.get(f"/api/v1/items/{item_id}", headers=auth_headers).status_code == 404


def test_item_room_home_mismatch(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    # 다른 집을 하나 더 만들고, 그 집 id 로 기존 방을 참조하면 불일치
    other_home = client.post(
        "/api/v1/homes", json={"name": "부모님 집"}, headers=auth_headers
    ).json()["data"]["id"]
    res = client.post(
        "/api/v1/items",
        json={"name": "x", "homeId": other_home, "roomId": ids["room_id"]},
        headers=auth_headers,
    )
    assert res.status_code == 409
    assert res.json()["errorCode"] == "ROOM_HOME_MISMATCH"


def test_item_storage_without_room(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    res = client.post(
        "/api/v1/items",
        json={
            "name": "x",
            "homeId": ids["home_id"],
            "storageLocationId": ids["storage_id"],
        },
        headers=auth_headers,
    )
    assert res.status_code == 409
    assert res.json()["errorCode"] == "STORAGE_WITHOUT_ROOM"


def test_item_date_validation(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    res = client.post(
        "/api/v1/items",
        json={
            "name": "우유",
            "homeId": ids["home_id"],
            "purchaseDate": "2026-07-10",
            "expirationDate": "2026-07-01",
        },
        headers=auth_headers,
    )
    assert res.status_code == 422


def test_item_ownership(client: TestClient, auth_headers: dict, other_headers: dict):
    ids = _setup(client, auth_headers)
    item_id = client.post(
        "/api/v1/items",
        json={"name": "여권", "homeId": ids["home_id"]},
        headers=auth_headers,
    ).json()["data"]["id"]
    # bob 은 alice 물건 접근 불가
    assert client.get(f"/api/v1/items/{item_id}", headers=other_headers).status_code == 404
    # bob 은 alice 집으로 물건 생성 불가
    assert (
        client.post(
            "/api/v1/items",
            json={"name": "침입", "homeId": ids["home_id"]},
            headers=other_headers,
        ).status_code
        == 404
    )
