from fastapi.testclient import TestClient

# 신규 사용자는 기본 카테고리 6개 / 기본 태그 4개를 자동으로 갖는다.
DEFAULT_CATEGORY_COUNT = 6
DEFAULT_TAG_COUNT = 4


def test_category_crud_and_duplicate(client: TestClient, auth_headers: dict):
    # 기본 카테고리가 시딩되어 있음
    base = client.get("/api/v1/categories", headers=auth_headers).json()["data"]
    assert len(base) == DEFAULT_CATEGORY_COUNT

    # 생성 (기본값과 겹치지 않는 이름)
    res = client.post("/api/v1/categories", json={"name": "취미용품"}, headers=auth_headers)
    assert res.status_code == 201
    cat_id = res.json()["data"]["id"]

    # 목록 = 기본 + 1
    res = client.get("/api/v1/categories", headers=auth_headers)
    assert len(res.json()["data"]) == DEFAULT_CATEGORY_COUNT + 1

    # 중복 이름 → 409
    res = client.post("/api/v1/categories", json={"name": "취미용품"}, headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["errorCode"] == "CATEGORY_DUPLICATE"

    # 기본값과 같은 이름도 중복 → 409
    res = client.post("/api/v1/categories", json={"name": "전자제품"}, headers=auth_headers)
    assert res.status_code == 409

    # 수정
    res = client.put(f"/api/v1/categories/{cat_id}", json={"name": "취미"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "취미"

    # 삭제
    assert client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers).status_code == 200


def test_tag_crud_and_duplicate(client: TestClient, auth_headers: dict):
    base = client.get("/api/v1/tags", headers=auth_headers).json()["data"]
    assert len(base) == DEFAULT_TAG_COUNT

    res = client.post("/api/v1/tags", json={"name": "즐겨찾기"}, headers=auth_headers)
    assert res.status_code == 201

    res = client.post("/api/v1/tags", json={"name": "즐겨찾기"}, headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["errorCode"] == "TAG_DUPLICATE"


def test_category_user_isolation(client: TestClient, auth_headers: dict, other_headers: dict):
    # 같은 이름이라도 사용자별로 분리되어 각자 생성 가능
    assert (
        client.post(
            "/api/v1/categories", json={"name": "취미용품"}, headers=auth_headers
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/categories", json={"name": "취미용품"}, headers=other_headers
        ).status_code
        == 201
    )

    # bob 목록에는 기본값 + 자기가 만든 1개만
    res = client.get("/api/v1/categories", headers=other_headers)
    names = [c["name"] for c in res.json()["data"]]
    assert names.count("취미용품") == 1
    assert len(res.json()["data"]) == DEFAULT_CATEGORY_COUNT + 1


def test_category_ownership(client: TestClient, auth_headers: dict, other_headers: dict):
    cat_id = client.post(
        "/api/v1/categories", json={"name": "취미용품"}, headers=auth_headers
    ).json()["data"]["id"]
    # bob 은 alice 카테고리 수정/삭제 불가
    assert (
        client.put(
            f"/api/v1/categories/{cat_id}", json={"name": "x"}, headers=other_headers
        ).status_code
        == 404
    )
    assert client.delete(f"/api/v1/categories/{cat_id}", headers=other_headers).status_code == 404
