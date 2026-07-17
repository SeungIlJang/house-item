from fastapi.testclient import TestClient


def _setup_room(client: TestClient, headers: dict) -> int:
    home_id = client.post("/api/v1/homes", json={"name": "우리 집"}, headers=headers).json()[
        "data"
    ]["id"]
    room_id = client.post(
        f"/api/v1/homes/{home_id}/rooms", json={"name": "안방"}, headers=headers
    ).json()["data"]["id"]
    return room_id


def _create_storage(client, headers, room_id, name, parent_id=None):
    body: dict = {"name": name}
    if parent_id is not None:
        body["parentId"] = parent_id
    return client.post(f"/api/v1/rooms/{room_id}/storage-locations", json=body, headers=headers)


def test_hierarchy_and_full_path(client: TestClient, auth_headers: dict):
    room_id = _setup_room(client, auth_headers)

    closet = _create_storage(client, auth_headers, room_id, "붙박이장").json()["data"]["id"]
    shelf = _create_storage(client, auth_headers, room_id, "오른쪽 칸", closet).json()["data"]["id"]
    drawer = _create_storage(client, auth_headers, room_id, "두 번째 서랍", shelf).json()["data"]

    # 전체 경로: 방 이름부터
    assert drawer["fullPath"] == "안방 > 붙박이장 > 오른쪽 칸 > 두 번째 서랍"
    assert drawer["parentId"] == shelf


def test_tree_structure(client: TestClient, auth_headers: dict):
    room_id = _setup_room(client, auth_headers)
    closet = _create_storage(client, auth_headers, room_id, "붙박이장").json()["data"]["id"]
    _create_storage(client, auth_headers, room_id, "왼쪽 칸", closet)
    _create_storage(client, auth_headers, room_id, "오른쪽 칸", closet)

    res = client.get(f"/api/v1/rooms/{room_id}/storage-locations", headers=auth_headers)
    assert res.status_code == 200
    tree = res.json()["data"]
    assert len(tree) == 1  # 루트는 붙박이장 하나
    assert tree[0]["name"] == "붙박이장"
    assert len(tree[0]["children"]) == 2


def test_cycle_prevention_self(client: TestClient, auth_headers: dict):
    room_id = _setup_room(client, auth_headers)
    a = _create_storage(client, auth_headers, room_id, "A").json()["data"]["id"]
    # 자기 자신을 부모로
    res = client.put(
        f"/api/v1/storage-locations/{a}",
        json={"name": "A", "parentId": a},
        headers=auth_headers,
    )
    assert res.status_code == 409
    assert res.json()["errorCode"] == "STORAGE_CYCLE"


def test_cycle_prevention_descendant(client: TestClient, auth_headers: dict):
    room_id = _setup_room(client, auth_headers)
    a = _create_storage(client, auth_headers, room_id, "A").json()["data"]["id"]
    b = _create_storage(client, auth_headers, room_id, "B", a).json()["data"]["id"]
    # A 의 부모를 자손 B 로 지정 → 순환
    res = client.put(
        f"/api/v1/storage-locations/{a}",
        json={"name": "A", "parentId": b},
        headers=auth_headers,
    )
    assert res.status_code == 409
    assert res.json()["errorCode"] == "STORAGE_CYCLE"


def test_delete_cascades_children(client: TestClient, auth_headers: dict):
    room_id = _setup_room(client, auth_headers)
    a = _create_storage(client, auth_headers, room_id, "A").json()["data"]["id"]
    b = _create_storage(client, auth_headers, room_id, "B", a).json()["data"]["id"]

    assert client.delete(f"/api/v1/storage-locations/{a}", headers=auth_headers).status_code == 200
    # 자식도 함께 삭제됨
    assert client.get(f"/api/v1/storage-locations/{b}", headers=auth_headers).status_code == 404


def test_storage_ownership(client: TestClient, auth_headers: dict, other_headers: dict):
    room_id = _setup_room(client, auth_headers)
    a = _create_storage(client, auth_headers, room_id, "A").json()["data"]["id"]

    assert client.get(f"/api/v1/storage-locations/{a}", headers=other_headers).status_code == 404
    # bob 은 alice 방에 수납공간 생성 불가
    assert _create_storage(client, other_headers, room_id, "침입").status_code == 404
