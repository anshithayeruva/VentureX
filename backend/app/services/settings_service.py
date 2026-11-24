"""Account settings for founders and investors: notification preferences, privacy and display
preferences. Stored in founder_profiles.settings / investor_profiles.settings (JSONB) and enforced:
  * notification preferences by NotificationService (in-app) and the email call sites (email_allowed);
  * privacy by the views that show profiles, contact details, traction and alerts;
  * display preferences by the web app's date and money formatting.
Older flat keys (email_alerts, default_private, auto_notify_high_conviction, ...) are read as defaults.
"""
from typing import Any, Dict, Optional

from app.database import postgres as pg

# Category -> label; every category has an in-app and an email switch.
FOUNDER_CATEGORIES = {
    "investor_interest": "Investor interest: intro requests, investors' replies and investment proposals",
    "connections": "Connections: deal room messages, replies to your updates and your team",
    "project_status": "Project status: verification results, strong investor matches and funding",
    "ai_analysis": "AI analysis: when a readiness analysis finishes",
}
INVESTOR_CATEGORIES = {
    "startup_matches": "New startup matches: startups that strongly fit your criteria",
    "founder_responses": "Founder responses: founders accepting, declining or asking to connect",
    "deal_flow": "Deal Flow: deal room messages and stage changes",
    "company_updates": "Company updates: monthly and quarterly updates from founders",
    "portfolio": "Portfolio: investment terms, commitments and capital received",
}
# Always delivered (security and account changes) whatever the preferences say.
ALWAYS = "account"

DATE_FORMATS = ("DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD")
NUMBER_FORMATS = ("indian", "international")
PROFILE_VISIBILITY = ("investors", "connected", "hidden")


def _categories(role: str) -> Dict[str, str]:
    return FOUNDER_CATEGORIES if role == "FOUNDER" else INVESTOR_CATEGORIES


def defaults(role: str, legacy: Optional[Dict[str, Any]] = None, row: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    legacy = legacy or {}
    row = row or {}
    email_on = bool(legacy.get("email_alerts", True))
    cats = {k: {"in_app": True, "email": True} for k in _categories(role)}
    if role == "INVESTOR" and legacy.get("auto_notify_high_conviction") is False:
        cats["startup_matches"] = {"in_app": False, "email": False}
    base: Dict[str, Any] = {
        "notifications": {"email_enabled": email_on, "categories": cats},
        "preferences": {"time_zone": "Asia/Kolkata", "date_format": "DD MMM YYYY", "show_unread_badge": True},
    }
    if role == "FOUNDER":
        base["privacy"] = {
            "profile_visibility": "connected",       # who sees your founder profile on your startups
            "show_email": True,                       # to investors you're connected with
            "show_phone": False,
            "show_linkedin": True,
            "default_private": bool(legacy.get("default_private", True)),  # new projects start private
            "allow_investor_alerts": True,            # strong-fit alerts about your projects to investors
            "share_traction": True,                   # revenue and customers on published projects
        }
    else:
        base["preferences"]["number_format"] = "indian"
        base["privacy"] = {
            "listed_for_founders": bool(row.get("listed_for_founders", True)),
            "show_organization": True,
            "show_email": True,                       # to founders you're connected with
            "show_phone": False,
            "direct_founder_messaging": bool(legacy.get("direct_founder_messaging", True)),
        }
    return base


def merge(role: str, stored: Optional[Dict[str, Any]], row: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """The full settings: stored values over defaults (unknown keys dropped)."""
    stored = stored or {}
    out = defaults(role, stored, row)
    for section in ("notifications", "privacy", "preferences"):
        got = stored.get(section) or {}
        if section == "notifications":
            if "email_enabled" in got:
                out["notifications"]["email_enabled"] = bool(got["email_enabled"])
            for k, v in (got.get("categories") or {}).items():
                if k in out["notifications"]["categories"] and isinstance(v, dict):
                    out["notifications"]["categories"][k] = {
                        "in_app": bool(v.get("in_app", True)), "email": bool(v.get("email", True))}
        else:
            for k, v in got.items():
                if k in out[section]:
                    out[section][k] = v
    if role == "INVESTOR" and row is not None and "listed_for_founders" in row:
        out["privacy"]["listed_for_founders"] = bool(row["listed_for_founders"])
    return out


def validate(role: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Check an incoming full settings object and return the cleaned version (raises ValueError)."""
    clean = merge(role, data)
    p = clean["preferences"]
    if p["date_format"] not in DATE_FORMATS:
        raise ValueError("Unknown date format.")
    tz = str(p.get("time_zone") or "")
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(tz)
    except Exception:
        raise ValueError("Unknown time zone.")
    p["show_unread_badge"] = bool(p.get("show_unread_badge", True))
    if role == "INVESTOR" and p.get("number_format") not in NUMBER_FORMATS:
        raise ValueError("Unknown number format.")
    for k, v in clean["privacy"].items():
        if k == "profile_visibility":
            if v not in PROFILE_VISIBILITY:
                raise ValueError("Unknown profile visibility.")
        elif not isinstance(v, bool):
            raise ValueError(f"{k} must be on or off.")
    return clean


async def stored_settings(user_id: str, role: str) -> Dict[str, Any]:
    table = "founder_profiles" if role == "FOUNDER" else "investor_profiles"
    cols = "settings" + (", listed_for_founders" if role == "INVESTOR" else "")
    row = await pg.fetch_one(f"SELECT {cols} FROM {table} WHERE user_id = %s", [user_id]) or {}
    return merge(role, row.get("settings") or {}, row if role == "INVESTOR" else None)


async def _role_of(user_id: str) -> Optional[str]:
    return await pg.fetch_val("SELECT role FROM app_users WHERE id = %s", [user_id])


async def allowed(user_id: Optional[str], role: Optional[str], category: Optional[str], channel: str) -> bool:
    """Whether to deliver a notification of this category on this channel ("in_app" or "email")."""
    if not user_id or not category or category == ALWAYS:
        return True
    role = (role or await _role_of(user_id) or "").upper()
    if role not in ("FOUNDER", "INVESTOR"):
        return True
    s = await stored_settings(user_id, role)
    if channel == "email" and not s["notifications"]["email_enabled"]:
        return False
    cat = s["notifications"]["categories"].get(category)
    return True if cat is None else bool(cat.get(channel, True))


async def email_allowed(user_id: Optional[str], category: str) -> bool:
    return await allowed(user_id, None, category, "email")


async def privacy(user_id: str, role: str) -> Dict[str, Any]:
    return (await stored_settings(user_id, role))["privacy"]
