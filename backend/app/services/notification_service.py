import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple, Union
from app.database import postgres as pg

logger = logging.getLogger(__name__)


def format_relative_time(dt: Optional[datetime]) -> str:
    """Format a datetime object into a concise relative time string."""
    if not dt:
        return "Recently"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = datetime.now(timezone.utc) - dt
    seconds = max(0, int(diff.total_seconds()))
    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        return f"{seconds // 60}m ago"
    elif seconds < 86400:
        return f"{seconds // 3600}h ago"
    elif seconds < 604800:
        return f"{seconds // 86400}d ago"
    return dt.strftime("%b %d")


def _serialize(row: Dict[str, Any]) -> Dict[str, Any]:
    return {**row, "id": str(row["id"]), "time": format_relative_time(row.get("created_at"))}


def _filters(
    target_role: Optional[str],
    user_id: Optional[str],
    unread_only: bool,
) -> Tuple[str, List[Any]]:
    where: List[str] = []
    params: List[Any] = []
    if target_role:
        where.append("target_role = %s")
        params.append(target_role.upper())
    if user_id:
        # A user sees their own alerts plus role-wide broadcasts (user_id IS NULL).
        where.append("(user_id = %s OR user_id IS NULL)")
        params.append(str(user_id))
    if unread_only:
        where.append("NOT read")
    return (" WHERE " + " AND ".join(where)) if where else "", params


class NotificationService:
    @classmethod
    async def create_notification(
        cls,
        target_role: str,
        title: str,
        desc: str,
        user_id: Optional[Union[str, int]] = None,
        badge: str = "Alert",
        badge_variant: str = "primary",
        link: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Insert a new notification and return it."""
        if not pg.is_configured():
            logger.warning("Database unavailable, skipping notification creation")
            return {}
        row = await pg.insert(
            "notifications",
            {
                "target_role": target_role.upper(),
                "user_id": str(user_id) if user_id is not None else None,
                "title": title,
                "desc": desc,
                "badge": badge,
                "badge_variant": badge_variant,
                "link": link,
                "read": False,
            },
        )
        logger.info("Notification created [%s] for %s (%s): %s", row["id"], target_role, user_id, title)
        return _serialize(row)

    @classmethod
    async def list_notifications(
        cls,
        target_role: Optional[str] = None,
        user_id: Optional[str] = None,
        unread_only: bool = False,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """List notifications, computing relative timestamps on the fly."""
        where, params = _filters(target_role, user_id, unread_only)
        rows = await pg.fetch_all(
            f"SELECT * FROM notifications{where} ORDER BY created_at DESC, id DESC LIMIT %s",
            [*params, limit],
        )
        return [_serialize(r) for r in rows]

    @classmethod
    async def mark_as_read(
        cls,
        notification_id: str,
        user_id: Optional[str] = None,
        target_role: Optional[str] = None,
    ) -> bool:
        """Mark a single notification as read (only one addressed to this user or their role)."""
        try:
            nid = int(notification_id)
        except (TypeError, ValueError):
            return False
        return await pg.execute(
            "UPDATE notifications SET read = TRUE WHERE id = %s AND NOT read "
            "AND (user_id = %s OR (user_id IS NULL AND target_role = %s))",
            [nid, user_id, (target_role or "").upper()],
        ) > 0

    @classmethod
    async def mark_all_read(
        cls,
        target_role: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> int:
        """Mark all matching notifications as read."""
        where, params = _filters(target_role, user_id, unread_only=True)
        return await pg.execute(f"UPDATE notifications SET read = TRUE{where}", params)

    @classmethod
    async def get_unread_count(
        cls,
        target_role: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> int:
        """Return the count of unread notifications for a role/user."""
        where, params = _filters(target_role, user_id, unread_only=True)
        return await pg.fetch_val(f"SELECT count(*) AS n FROM notifications{where}", params) or 0
