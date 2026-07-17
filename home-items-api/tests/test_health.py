from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["message"] is None


def test_health_db():
    res = client.get("/health/db")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["database"] == "ok"
