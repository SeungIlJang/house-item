from fastapi.testclient import TestClient


def test_category_crud_and_duplicate(client: TestClient, auth_headers: dict):
    # 생성
    res = client.post("/api/v1/categories", json={"name": "전자제품"}, headers=auth_headers)
    assert res.status_code == 201
    cat_id = res.json()["data"]["id"]

    # 목록
    res = client.get("/api/v1/categories", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()["data"]) == 1

    # 중복 이름 → 409
    res = client.post("/api/v1/categories", json={"name": "전자제품"}, headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["errorCode"] == "CATEGORY_DUPLICATE"

    # 수정
    res = client.put(f"/api/v1/categories/{cat_id}", json={"name": "가전"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "가전"

    # 삭제
    assert client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers).status_code == 200


def test_tag_crud_and_duplicate(client: TestClient, auth_headers: dict):
    res = client.post("/api/v1/tags", json={"name": "중요"}, headers=auth_headers)
    assert res.status_code == 201

    res = client.post("/api/v1/tags", json={"name": "중요"}, headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["errorCode"] == "TAG_DUPLICATE"


def test_category_user_isolation(client: TestClient, auth_headers: dict, other_headers: dict):
    # 같은 이름이라도 사용자별로 분리되어 각자 생성 가능
    assert (
        client.post("/api/v1/categories", json={"name": "공구"}, headers=auth_headers).status_code
        == 201
    )
    assert (
        client.post("/api/v1/categories", json={"name": "공구"}, headers=other_headers).status_code
        == 201
    )

    # bob 목록에는 자기 것만
    res = client.get("/api/v1/categories", headers=other_headers)
    assert len(res.json()["data"]) == 1


def test_category_ownership(client: TestClient, auth_headers: dict, other_headers: dict):
    cat_id = client.post("/api/v1/categories", json={"name": "서류"}, headers=auth_headers).json()[
        "data"
    ]["id"]
    # bob 은 alice 카테고리 수정/삭제 불가
    assert (
        client.put(
            f"/api/v1/categories/{cat_id}", json={"name": "x"}, headers=other_headers
        ).status_code
        == 404
    )
    assert client.delete(f"/api/v1/categories/{cat_id}", headers=other_headers).status_code == 404
