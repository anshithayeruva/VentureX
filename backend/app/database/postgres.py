"""Lakebase Postgres (Neon) access and query helpers.

Two transports, picked with ``NEON_DB_TRANSPORT``:

* ``https`` (default): Neon's SQL-over-HTTP endpoint on port 443, the same
  protocol as ``@neondatabase/serverless``'s ``neon()`` function. Every
  statement is one HTTPS request, so it works on networks that block the
  Postgres port (5432). There are no interactive transactions; multi-statement
  work runs as an atomic batch (``run_batch``) or as a single statement.
* ``tcp``: psycopg 3 with an async connection pool on the pooled
  ``DATABASE_URL`` (standard Postgres wire protocol on port 5432).

Both return rows as plain dicts with JSON/JSONB columns decoded to Python
lists/dicts, so services return the same shapes regardless of transport.
SQL uses psycopg-style ``%s`` placeholders in both modes.
"""
import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SCHEMA_FILE = Path(__file__).with_name("schema.sql")

__all__ = [
    "DatabaseUnavailable",
    "DatabaseError",
    "Jsonb",
    "open_pool",
    "close_pool",
    "is_configured",
    "fetch_one",
    "fetch_all",
    "fetch_val",
    "execute",
    "run_batch",
    "insert",
    "upsert",
    "update_where",
    "escape_like",
    "apply_schema",
    "ping",
]


class DatabaseUnavailable(RuntimeError):
    """No usable database connection (unconfigured, or unreachable)."""


class DatabaseError(RuntimeError):
    """A statement failed on the server. ``code`` is the Postgres SQLSTATE."""

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Jsonb:
    """Marks a parameter to be sent as JSONB."""
    obj: Any


def is_configured() -> bool:
    return settings.is_database_configured


def _transport() -> str:
    return (settings.NEON_DB_TRANSPORT or "https").strip().lower()


# --------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------

def escape_like(value: str) -> str:
    """Escape LIKE wildcards so user input is matched as a literal substring."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _wrap_json(value: Any) -> Any:
    """Dicts/lists become JSONB parameters; scalars pass through."""
    if isinstance(value, (dict, list)):
        return Jsonb(value)
    return value


def _ident(name: str) -> str:
    # Column names come from code, never from request data; quote them anyway.
    return '"' + name.replace('"', '""') + '"'


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"Not JSON serializable: {type(value).__name__}")


# --------------------------------------------------------------------------
# HTTPS transport (Neon SQL-over-HTTP)
# --------------------------------------------------------------------------

_http: Optional[httpx.AsyncClient] = None
_sql_endpoint: Optional[str] = None

# Postgres type OIDs -> text decoders (results arrive as text: Neon-Raw-Text-Output).
_BOOL = {16}
_INT = {20, 21, 23, 26}
_FLOAT = {700, 701, 1700}
_JSON = {114, 3802}
_TIMESTAMP = {1114, 1184}
_DATE = {1082}


def _parse_timestamp(text: str) -> datetime:
    # Postgres prints e.g. "2026-11-20 08:21:56.622622+00"; normalize the offset.
    if re.search(r"[+-]\d{2}$", text):
        text += ":00"
    return datetime.fromisoformat(text)


def _decode(value: Optional[str], oid: int) -> Any:
    if value is None:
        return None
    if oid in _BOOL:
        return value == "t"
    if oid in _INT:
        return int(value)
    if oid in _FLOAT:
        return float(value)
    if oid in _JSON:
        return json.loads(value)
    if oid in _TIMESTAMP:
        return _parse_timestamp(value)
    if oid in _DATE:
        return date.fromisoformat(value)
    return value


def _encode(value: Any) -> Optional[str]:
    """Render a Python value as a text-format Postgres parameter."""
    if value is None:
        return None
    if isinstance(value, Jsonb):
        return json.dumps(value.obj, default=_json_default)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=_json_default)
    return str(value)


def _to_dollar_params(sql: str) -> str:
    """Convert psycopg-style %s placeholders to $1..$n (and %% to %)."""
    counter = 0

    def repl(match: "re.Match[str]") -> str:
        nonlocal counter
        if match.group(0) == "%%":
            return "%"
        counter += 1
        return f"${counter}"

    return re.sub(r"%%|%s", repl, sql)


def _http_body(sql: str, params: Sequence[Any]) -> Dict[str, Any]:
    return {"query": _to_dollar_params(sql), "params": [_encode(p) for p in params]}


def _rows_from(result: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], int]:
    fields = result.get("fields") or []
    names = [f["name"] for f in fields]
    oids = [f["dataTypeID"] for f in fields]
    rows = [
        {name: _decode(val, oid) for name, oid, val in zip(names, oids, row)}
        for row in (result.get("rows") or [])
    ]
    return rows, int(result.get("rowCount") or 0)


async def _http_post(body: Dict[str, Any], extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    if _http is None or _sql_endpoint is None:
        raise DatabaseUnavailable("Database connection unavailable")
    headers = {
        "Neon-Connection-String": settings.DATABASE_URL,
        "Neon-Raw-Text-Output": "true",
        "Neon-Array-Mode": "true",
        **(extra_headers or {}),
    }
    try:
        resp = await _http.post(_sql_endpoint, json=body, headers=headers)
    except httpx.TransportError as e:
        raise DatabaseUnavailable(f"Could not reach Neon SQL endpoint: {e}") from e
    if resp.status_code != 200:
        try:
            err = resp.json()
        except ValueError:
            err = {"message": resp.text[:200]}
        if resp.status_code in (401, 403, 404, 502, 503, 504) and not err.get("code"):
            raise DatabaseUnavailable(f"Neon SQL endpoint returned HTTP {resp.status_code}: {err.get('message')}")
        raise DatabaseError(err.get("message") or f"HTTP {resp.status_code}", err.get("code"))
    return resp.json()


# --------------------------------------------------------------------------
# TCP transport (psycopg pool)
# --------------------------------------------------------------------------

_pool = None  # psycopg_pool.AsyncConnectionPool when NEON_DB_TRANSPORT=tcp


def _tcp_param(value: Any) -> Any:
    if isinstance(value, Jsonb):
        from psycopg.types.json import Jsonb as PgJsonb
        return PgJsonb(value.obj)
    return value


async def _tcp_run(sql: str, params: Sequence[Any]) -> Tuple[List[Dict[str, Any]], int]:
    if _pool is None:
        raise DatabaseUnavailable("Database connection unavailable")
    import psycopg

    try:
        async with _pool.connection() as conn:
            cur = await conn.execute(sql, [_tcp_param(p) for p in params])
            rows = await cur.fetchall() if cur.description else []
            return rows, cur.rowcount
    except psycopg.OperationalError as e:
        raise DatabaseUnavailable(str(e)) from e
    except psycopg.Error as e:
        raise DatabaseError(str(e), getattr(e, "sqlstate", None)) from e


# --------------------------------------------------------------------------
# Lifecycle
# --------------------------------------------------------------------------

async def open_pool() -> Optional[str]:
    """Prepare the configured transport. Returns its name, or None when unconfigured."""
    global _http, _sql_endpoint, _pool
    if not is_configured():
        logger.warning("DATABASE_URL is not configured; running without a database.")
        return None

    if _transport() == "tcp":
        if _pool is None:
            from psycopg.rows import dict_row
            from psycopg_pool import AsyncConnectionPool

            pool = AsyncConnectionPool(
                conninfo=settings.DATABASE_URL,
                min_size=1,
                max_size=10,
                open=False,
                # Neon's pooler (PgBouncer, transaction mode) does not support
                # server-side prepared statements, so disable them.
                kwargs={"row_factory": dict_row, "prepare_threshold": None, "autocommit": True},
                # Computes can scale to zero; a stale idle connection is checked before use.
                check=AsyncConnectionPool.check_connection,
            )
            try:
                await pool.open(wait=True, timeout=30)
            except Exception:
                # Don't keep a pool that never connected: requests should fail fast, not hang.
                await pool.close()
                raise
            _pool = pool
            logger.info("Opened Postgres TCP connection pool.")
        return "tcp"

    if _http is None:
        host = urlparse(settings.DATABASE_URL).hostname or ""
        # Same rule as @neondatabase/serverless: replace the endpoint id label with "api".
        _sql_endpoint = "https://" + re.sub(r"^[^.]+\.", "api.", host, count=1) + "/sql"
        _http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0), http2=False)
        logger.info("Using Neon SQL-over-HTTPS endpoint at %s", urlparse(_sql_endpoint).hostname)
    return "https"


async def close_pool() -> None:
    global _http, _sql_endpoint, _pool
    if _http is not None:
        await _http.aclose()
        _http = None
        _sql_endpoint = None
    if _pool is not None:
        await _pool.close()
        _pool = None
    logger.info("Closed database transport.")


# --------------------------------------------------------------------------
# Query API (transport-independent)
# --------------------------------------------------------------------------

async def _run(sql: str, params: Sequence[Any] = ()) -> Tuple[List[Dict[str, Any]], int]:
    params = list(params)
    if _transport() == "tcp":
        return await _tcp_run(sql, params)
    return _rows_from(await _http_post(_http_body(sql, params)))


async def fetch_all(sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    rows, _ = await _run(sql, params)
    return rows


async def fetch_one(sql: str, params: Sequence[Any] = ()) -> Optional[Dict[str, Any]]:
    rows, _ = await _run(sql, params)
    return rows[0] if rows else None


async def fetch_val(sql: str, params: Sequence[Any] = ()) -> Any:
    row = await fetch_one(sql, params)
    if not row:
        return None
    return next(iter(row.values()))


async def execute(sql: str, params: Sequence[Any] = ()) -> int:
    """Run a write statement and return the affected row count."""
    _, count = await _run(sql, params)
    return count


async def run_batch(statements: Sequence[Tuple[str, Sequence[Any]]]) -> List[List[Dict[str, Any]]]:
    """Run several statements atomically (one transaction). Returns each statement's rows."""
    if _transport() == "tcp":
        if _pool is None:
            raise DatabaseUnavailable("Database connection unavailable")
        out: List[List[Dict[str, Any]]] = []
        async with _pool.connection() as conn:
            async with conn.transaction():
                for sql, params in statements:
                    cur = await conn.execute(sql, [_tcp_param(p) for p in params])
                    out.append(await cur.fetchall() if cur.description else [])
        return out

    body = {"queries": [_http_body(sql, list(params)) for sql, params in statements]}
    result = await _http_post(body, {"Neon-Batch-Isolation-Level": "ReadCommitted"})
    return [_rows_from(r)[0] for r in result.get("results", [])]


async def insert(table: str, doc: Dict[str, Any], returning: bool = True) -> Optional[Dict[str, Any]]:
    """INSERT one row from a dict of column -> value."""
    cols = list(doc.keys())
    sql = (
        f"INSERT INTO {_ident(table)} ({', '.join(_ident(c) for c in cols)}) "
        f"VALUES ({', '.join(['%s'] * len(cols))})"
        + (" RETURNING *" if returning else "")
    )
    params = [_wrap_json(doc[c]) for c in cols]
    if returning:
        return await fetch_one(sql, params)
    await execute(sql, params)
    return None


async def upsert(
    table: str,
    doc: Dict[str, Any],
    conflict: Sequence[str],
    update: Optional[Sequence[str]] = None,
) -> Optional[Dict[str, Any]]:
    """INSERT ... ON CONFLICT (conflict) DO UPDATE SET the given columns (default: all others).

    With ``update=[]`` this is insert-if-missing (DO NOTHING) and returns None on conflict.
    """
    cols = list(doc.keys())
    update_cols = list(update) if update is not None else [c for c in cols if c not in conflict]
    set_clause = ", ".join(f"{_ident(c)} = EXCLUDED.{_ident(c)}" for c in update_cols)
    sql = (
        f"INSERT INTO {_ident(table)} ({', '.join(_ident(c) for c in cols)}) "
        f"VALUES ({', '.join(['%s'] * len(cols))}) "
        f"ON CONFLICT ({', '.join(_ident(c) for c in conflict)}) "
        + (f"DO UPDATE SET {set_clause}" if set_clause else "DO NOTHING")
        + " RETURNING *"
    )
    return await fetch_one(sql, [_wrap_json(doc[c]) for c in cols])


async def update_where(table: str, fields: Dict[str, Any], where: str, params: Sequence[Any]) -> int:
    """UPDATE table SET fields WHERE <where>. `where` uses %s placeholders bound to params."""
    if not fields:
        return 0
    set_clause = ", ".join(f"{_ident(c)} = %s" for c in fields)
    sql = f"UPDATE {_ident(table)} SET {set_clause} WHERE {where}"
    return await execute(sql, [*(_wrap_json(v) for v in fields.values()), *params])


def _schema_statements() -> List[str]:
    # schema.sql has no functions or quoted semicolons, so splitting on ';' is safe.
    lines = [ln for ln in SCHEMA_FILE.read_text(encoding="utf-8").splitlines() if not ln.strip().startswith("--")]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]


async def apply_schema() -> None:
    """Create tables and indexes idempotently (CREATE ... IF NOT EXISTS), in one transaction."""
    await run_batch([(stmt, []) for stmt in _schema_statements()])
    logger.info("Postgres schema is up to date.")


async def ping() -> bool:
    return (await fetch_val("SELECT 1 AS ok")) == 1
