from fastapi.testclient import TestClient


def _setup(client: TestClient, headers: dict) -> dict:
    home_id = client.post("/api/v1/homes", json={"name": "우리 집"}, headers=headers).json()[
        "data"
    ]["id"]
    room_id = client.post(
        f"/api/v1/homes/{home_id}/rooms", json={"name": "안방"}, headers=headers
    ).json()["data"]["id"]
    other_room = client.post(
        f"/api/v1/homes/{home_id}/rooms", json={"name": "거실"}, headers=headers
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
        "other_room": other_room,
        "category_id": category_id,
        "tag_id": tag_id,
    }


def _create(client, headers, **kwargs):
    return client.post("/api/v1/items", json=kwargs, headers=headers).json()["data"]


def test_search_by_keyword(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    _create(client, auth_headers, name="휴대전화 충전기", homeId=ids["home_id"])
    _create(client, auth_headers, name="여권", homeId=ids["home_id"], memo="충전 관련 메모")
    _create(client, auth_headers, name="드라이버", homeId=ids["home_id"])

    # 이름/메모에서 '충전' 검색 → 2건
    res = client.get("/api/v1/items/search?keyword=충전", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["data"]["totalElements"] == 2


def test_search_by_room_and_category(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    _create(
        client,
        auth_headers,
        name="A",
        homeId=ids["home_id"],
        roomId=ids["room_id"],
        categoryId=ids["category_id"],
    )
    _create(client, auth_headers, name="B", homeId=ids["home_id"], roomId=ids["other_room"])

    res = client.get(
        f"/api/v1/items/search?room_id={ids['room_id']}&category_id={ids['category_id']}",
        headers=auth_headers,
    )
    assert res.json()["data"]["totalElements"] == 1
    assert res.json()["data"]["content"][0]["name"] == "A"


def test_search_by_tag(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    _create(client, auth_headers, name="태그있음", homeId=ids["home_id"], tagIds=[ids["tag_id"]])
    _create(client, auth_headers, name="태그없음", homeId=ids["home_id"])

    res = client.get(f"/api/v1/items/search?tag_id={ids['tag_id']}", headers=auth_headers)
    assert res.json()["data"]["totalElements"] == 1
    assert res.json()["data"]["content"][0]["name"] == "태그있음"


def test_search_sort_name(client: TestClient, auth_headers: dict):
    ids = _setup(client, auth_headers)
    _create(client, auth_headers, name="다", homeId=ids["home_id"])
    _create(client, auth_headers, name="가", homeId=ids["home_id"])
    _create(client, auth_headers, name="나", homeId=ids["home_id"])

    res = client.get("/api/v1/items/search?sort=name", headers=auth_headers)
    names = [c["name"] for c in res.json()["data"]["content"]]
    assert names == ["가", "나", "다"]


def test_search_only_own_items(client: TestClient, auth_headers: dict, other_headers: dict):
    ids = _setup(client, auth_headers)
    _create(client, auth_headers, name="alice물건", homeId=ids["home_id"])

    res = client.get("/api/v1/items/search", headers=other_headers)
    assert res.json()["data"]["totalElements"] == 0
