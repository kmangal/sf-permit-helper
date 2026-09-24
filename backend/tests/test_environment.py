import pytest
from pydantic import ValidationError

from app.environment import Environment, PermitHelperEnv


def make(monkeypatch, **env: str) -> Environment:
    monkeypatch.delenv("PERMIT_HELPER_ENV", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return Environment(_env_file=None)


def test_permit_helper_env_defaults_to_local(monkeypatch):
    assert make(monkeypatch).permit_helper_env is PermitHelperEnv.LOCAL


@pytest.mark.parametrize("value", ["local", "test", "production"])
def test_permit_helper_env_reads_each_value(monkeypatch, value):
    assert make(monkeypatch, PERMIT_HELPER_ENV=value).permit_helper_env == PermitHelperEnv(value)


def test_permit_helper_env_rejects_unknown_value(monkeypatch):
    with pytest.raises(ValidationError):
        make(monkeypatch, PERMIT_HELPER_ENV="staging")
