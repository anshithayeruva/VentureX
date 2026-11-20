"""GitHub repository intake for project analysis.

Reads a public repository through the GitHub REST API (never by fetching an
arbitrary user-supplied URL): metadata, language mix, README, and the file
tree, which is enough to judge technical depth and engineering hygiene
(tests, CI, docs, recent activity). Set GITHUB_TOKEN to raise the
unauthenticated rate limit of 60 requests/hour.
"""
import logging
import re
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

API = "https://api.github.com"
README_LIMIT = 60_000  # characters of README passed to analysis
TREE_SAMPLE = 400      # file paths passed to analysis

_REPO_RE = re.compile(
    r"^(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100}?)(?:\.git)?/?(?:[#?].*)?$"
)


def parse_repo(url: str) -> Optional[Tuple[str, str]]:
    """'https://github.com/owner/repo' -> ('owner', 'repo'); None if not a repo URL."""
    match = _REPO_RE.match((url or "").strip())
    return (match.group(1), match.group(2)) if match else None


def _headers() -> Dict[str, str]:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "venturex-project-analysis"}
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    return headers


async def fetch_repository(url: str) -> Dict[str, Any]:
    """Summarize a repository. Returns {"ok": False, "error": ...} instead of raising."""
    parsed = parse_repo(url)
    if not parsed:
        return {"ok": False, "url": url, "error": "Not a github.com/<owner>/<repo> URL."}
    owner, repo = parsed
    base = f"{API}/repos/{owner}/{repo}"

    async with httpx.AsyncClient(headers=_headers(), timeout=20.0, follow_redirects=True) as client:
        try:
            meta = await client.get(base)
        except httpx.HTTPError as e:
            return {"ok": False, "url": url, "error": f"Could not reach GitHub: {e}"}
        if meta.status_code == 404:
            return {"ok": False, "url": url, "error": "Repository not found or private."}
        if meta.status_code == 403 and meta.headers.get("x-ratelimit-remaining") == "0":
            return {"ok": False, "url": url, "error": "GitHub rate limit reached; set GITHUB_TOKEN or retry later."}
        if meta.status_code != 200:
            return {"ok": False, "url": url, "error": f"GitHub returned HTTP {meta.status_code}."}
        info = meta.json()

        summary: Dict[str, Any] = {
            "ok": True,
            "url": info.get("html_url") or url,
            "full_name": info.get("full_name"),
            "description": info.get("description") or "",
            "homepage": info.get("homepage") or "",
            "topics": info.get("topics") or [],
            "primary_language": info.get("language"),
            "stars": info.get("stargazers_count", 0),
            "forks": info.get("forks_count", 0),
            "open_issues": info.get("open_issues_count", 0),
            "license": (info.get("license") or {}).get("spdx_id"),
            "archived": bool(info.get("archived")),
            "created_at": info.get("created_at"),
            "last_push": info.get("pushed_at"),
            "default_branch": info.get("default_branch") or "main",
        }

        try:
            langs = await client.get(f"{base}/languages")
            if langs.status_code == 200:
                total = sum(langs.json().values()) or 1
                summary["languages"] = {k: round(100 * v / total, 1) for k, v in langs.json().items()}
        except httpx.HTTPError:
            pass

        summary["readme"] = ""
        summary["readme_truncated"] = False
        try:
            readme = await client.get(f"{base}/readme", headers={"Accept": "application/vnd.github.raw"})
            if readme.status_code == 200:
                text = readme.text
                summary["readme_chars"] = len(text)
                summary["readme_truncated"] = len(text) > README_LIMIT
                summary["readme"] = text[:README_LIMIT]
        except httpx.HTTPError:
            pass

        try:
            tree = await client.get(f"{base}/git/trees/{summary['default_branch']}", params={"recursive": "1"})
            if tree.status_code == 200:
                paths = [item["path"] for item in tree.json().get("tree", []) if item.get("type") == "blob"]
                lower = [p.lower() for p in paths]
                summary["file_count"] = len(paths)
                summary["files_sample"] = paths[:TREE_SAMPLE]
                summary["signals"] = {
                    "has_tests": any(re.search(r"(^|/)(tests?|__tests__|spec)(/|$)|(_test|\.test|\.spec)\.", p) for p in lower),
                    "has_ci": any(p.startswith(".github/workflows/") or p in (".gitlab-ci.yml", ".circleci/config.yml") for p in lower),
                    "has_docker": any(p.endswith("dockerfile") or p.endswith("docker-compose.yml") for p in lower),
                    "has_docs": any(p.startswith("docs/") for p in lower),
                    "has_license_file": any(p.startswith("license") for p in lower),
                }
        except httpx.HTTPError:
            pass

    return summary


def describe_for_prompt(summary: Dict[str, Any]) -> str:
    """Render a repository summary as plain text for the analysis prompt."""
    if not summary.get("ok"):
        return f"GitHub repository ({summary.get('url')}): could not be read - {summary.get('error')}"
    lines = [
        f"Repository: {summary['full_name']} ({summary['url']})",
        f"Description: {summary['description'] or '(none)'}",
        f"Topics: {', '.join(summary['topics']) or '(none)'}",
        f"Languages: {summary.get('languages') or summary.get('primary_language') or 'unknown'}",
        f"Stars/forks/open issues: {summary['stars']}/{summary['forks']}/{summary['open_issues']}",
        f"License: {summary['license'] or 'none'}; archived: {summary['archived']}",
        f"Created: {summary['created_at']}; last push: {summary['last_push']}",
    ]
    if "signals" in summary:
        lines.append(f"Engineering signals: {summary['signals']} ({summary.get('file_count', 0)} files)")
        lines.append("File paths (sample):\n" + "\n".join(summary.get("files_sample", [])))
    if summary.get("readme"):
        note = (
            f" [README is {summary['readme_chars']} characters; only the first {README_LIMIT} are included]"
            if summary.get("readme_truncated") else ""
        )
        lines.append(f"README{note}:\n{summary['readme']}")
    else:
        lines.append("README: (none found)")
    return "\n".join(lines)
