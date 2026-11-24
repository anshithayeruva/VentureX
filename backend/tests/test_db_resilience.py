"""The database transport rides out brief network blips (no database needed for these tests)."""
import asyncio
import socket

import httpx
import pytest

from app.database import postgres as pg


@pytest.fixture
def fresh_dns(monkeypatch):
    """Install the DNS fallback on top of a fake resolver, and undo it afterwards."""
    calls = {"n": 0, "fail": False}
    good = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("203.0.113.7", 443))]

    def fake(host, port, *args, **kwargs):
        calls["n"] += 1
        if calls["fail"]:
            raise socket.gaierror(11001, "getaddrinfo failed")
        return good

    monkeypatch.setattr(socket, "getaddrinfo", fake)
    monkeypatch.setattr(pg, "_dns_installed", False)
    monkeypatch.setattr(pg, "_dns_hosts", set())
    monkeypatch.setattr(pg, "_dns_cache", {})
    pg._install_dns_fallback("api.example.neon.tech")
    return calls, good


def test_failed_lookup_reuses_last_known_address(fresh_dns):
    calls, good = fresh_dns
    assert socket.getaddrinfo("api.example.neon.tech", 443) == good
    calls["fail"] = True
    assert socket.getaddrinfo("API.example.neon.tech", 443) == good  # served from the last good lookup
    assert socket.getaddrinfo(b"api.example.neon.tech", 443) == good  # httpx passes bytes
    assert calls["n"] == 3  # a fresh lookup is always tried first


def test_other_hosts_and_unseen_lookups_still_fail(fresh_dns):
    calls, _ = fresh_dns
    calls["fail"] = True
    with pytest.raises(socket.gaierror):
        socket.getaddrinfo("api.example.neon.tech", 443)  # never resolved before: nothing to fall back to
    calls["fail"] = False
    socket.getaddrinfo("other.example.com", 443)
    calls["fail"] = True
    with pytest.raises(socket.gaierror):
        socket.getaddrinfo("other.example.com", 443)  # not the database host: untouched


class _FakeClient:
    def __init__(self, errors):
        self.errors = list(errors)
        self.calls = 0

    async def post(self, url, json=None, headers=None):
        self.calls += 1
        if self.errors:
            raise self.errors.pop(0)
        return httpx.Response(200, json={"fields": [], "rows": [], "rowCount": 0})


def _with_client(monkeypatch, client):
    monkeypatch.setattr(pg, "_http", client)
    monkeypatch.setattr(pg, "_sql_endpoint", "https://api.example.neon.tech/sql")
    monkeypatch.setattr(pg, "CONNECT_RETRY_DELAYS", (0, 0, 0, 0))


def test_connect_failures_are_retried(monkeypatch):
    client = _FakeClient([httpx.ConnectError("getaddrinfo failed"), httpx.ConnectTimeout("slow")])
    _with_client(monkeypatch, client)
    assert asyncio.run(pg._http_post({"query": "SELECT 1", "params": []}))["rowCount"] == 0
    assert client.calls == 3


def test_gives_up_after_the_last_retry(monkeypatch):
    client = _FakeClient([httpx.ConnectError("down")] * 10)
    _with_client(monkeypatch, client)
    with pytest.raises(pg.DatabaseUnavailable):
        asyncio.run(pg._http_post({"query": "SELECT 1", "params": []}))
    assert client.calls == len(pg.CONNECT_RETRY_DELAYS) + 1


def test_requests_that_may_have_run_are_not_retried(monkeypatch):
    client = _FakeClient([httpx.ReadTimeout("no reply")])
    _with_client(monkeypatch, client)
    with pytest.raises(pg.DatabaseUnavailable):
        asyncio.run(pg._http_post({"query": "INSERT ...", "params": []}))
    assert client.calls == 1  # the statement may have executed, so it is never sent twice
