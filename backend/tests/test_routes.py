"""HTTP routes that need no model client."""

import tomllib
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_version():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    pyproject = tomllib.loads((Path(__file__).parent.parent / "pyproject.toml").read_text())
    assert res.json() == {"status": "ok", "version": pyproject["project"]["version"]}


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
