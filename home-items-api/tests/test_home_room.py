from fastapi.testclient import TestClient


def _create_home(client: TestClient, headers: dict, name="우리 집") -> int:
    res = client.post("/api/v1/homes", json={"name": name}, headers=headers)
    assert res.status_code == 201
    return res.json()["data"]["id"]


def test_home_crud(client: TestClient, auth_headers: dict):
    # 생성
    home_id = _create_home(client, auth_headers)

    # 목록 (기본 집 "우리 집" + 방금 만든 집 = 2)
    res = client.get("/api/v1/homes", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()["data"]) == 2

    # 수정
    res = client.put(
        f"/api/v1/homes/{home_id}",
        json={"name": "새 집", "description": "설명"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "새 집"

    # 삭제
    res = client.delete(f"/api/v1/homes/{home_id}", headers=auth_headers)
    assert res.status_code == 200

    res = client.get(f"/api/v1/homes/{home_id}", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["errorCode"] == "HOME_NOT_FOUND"


def test_home_requires_auth(client: TestClient):
    res = client.get("/api/v1/homes")
    assert res.status_code == 401


def test_home_ownership(client: TestClient, auth_headers: dict, other_headers: dict):
    # alice 가 만든 집을 bob 은 조회/수정/삭제할 수 없다
    home_id = _create_home(client, auth_headers)

    assert client.get(f"/api/v1/homes/{home_id}", headers=other_headers).status_code == 404
    assert (
        client.put(
            f"/api/v1/homes/{home_id}", json={"name": "탈취"}, headers=other_headers
        ).status_code
        == 404
    )
    assert client.delete(f"/api/v1/homes/{home_id}", headers=other_headers).status_code == 404


def test_room_crud_and_sort(client: TestClient, auth_headers: dict):
    home_id = _create_home(client, auth_headers)

    # 방 두 개 생성 (정렬 순서 지정)
    client.post(
        f"/api/v1/homes/{home_id}/rooms",
        json={"name": "안방", "sortOrder": 2},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/homes/{home_id}/rooms",
        json={"name": "거실", "sortOrder": 1},
        headers=auth_headers,
    )

    # 목록은 sort_order 순
    res = client.get(f"/api/v1/homes/{home_id}/rooms", headers=auth_headers)
    assert res.status_code == 200
    names = [r["name"] for r in res.json()["data"]]
    assert names == ["거실", "안방"]

    room_id = res.json()["data"][0]["id"]

    # 방 수정
    res = client.put(
        f"/api/v1/rooms/{room_id}",
        json={"name": "거실2", "sortOrder": 5},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "거실2"

    # 방 삭제
    assert client.delete(f"/api/v1/rooms/{room_id}", headers=auth_headers).status_code == 200


def test_room_ownership(client: TestClient, auth_headers: dict, other_headers: dict):
    home_id = _create_home(client, auth_headers)
    res = client.post(f"/api/v1/homes/{home_id}/rooms", json={"name": "안방"}, headers=auth_headers)
    room_id = res.json()["data"]["id"]

    # bob 은 alice 의 방에 접근 불가
    assert client.get(f"/api/v1/rooms/{room_id}", headers=other_headers).status_code == 404
    # bob 은 alice 의 집에 방을 추가할 수 없음
    assert (
        client.post(
            f"/api/v1/homes/{home_id}/rooms", json={"name": "침입"}, headers=other_headers
        ).status_code
        == 404
    )
