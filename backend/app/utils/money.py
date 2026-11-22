"""Rupee formatting for text the API writes (match reasons, analysis input, PDF exports)."""


def _group_indian(whole: int) -> str:
    """12345678 -> "1,23,45,678" (last three digits, then pairs)."""
    s = str(whole)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    pairs = []
    while len(head) > 2:
        pairs.insert(0, head[-2:])
        head = head[:-2]
    if head:
        pairs.insert(0, head)
    return ",".join(pairs) + "," + tail


def inr(amount: float, compact: bool = True, ascii_only: bool = False) -> str:
    """₹75,000 · ₹7.5 L · ₹1.2 Cr (compact), or ₹1,20,000 (exact, whole rupees).

    ascii_only uses "Rs." for outputs whose fonts can't draw the rupee sign (built-in PDF fonts).
    """
    symbol = "Rs. " if ascii_only else "₹"
    value = float(amount or 0)
    sign = "-" if value < 0 else ""
    value = abs(value)
    if compact and value >= 10_000_000:
        return f"{sign}{symbol}{value / 10_000_000:.2f}".rstrip("0").rstrip(".") + " Cr"
    if compact and value >= 100_000:
        return f"{sign}{symbol}{value / 100_000:.2f}".rstrip("0").rstrip(".") + " L"
    return f"{sign}{symbol}{_group_indian(round(value))}"
