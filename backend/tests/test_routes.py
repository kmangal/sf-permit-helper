"""HTTP routes that need no model client."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_rule_diagrams():
    res = client.get("/api/v1/rules/diagrams")
    assert res.status_code == 200
    listed = res.json()["diagrams"]
    assert listed[0] == {
        "id": "00_overview",
        "kind": "overview",
        "title": "Overview",
        "source": listed[0]["source"],
    }
    assert {d["kind"] for d in listed} == {"overview", "section", "macro"}
    assert all(d["source"].startswith("flowchart TD") for d in listed)
