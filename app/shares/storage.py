import hashlib
import os
import re
import time
from pathlib import Path

SHARE_ID_RE = re.compile(r"^[a-f0-9]{16}$")
TAUR_EXPORT_WIDTH = 1200
TAUR_EXPORT_HEIGHT = 900
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SHARES_ROOT = _PROJECT_ROOT / "data" / "shares"


def shares_root() -> Path:
    root = Path(os.getenv("SHARES_DIR", str(_DEFAULT_SHARES_ROOT))).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def taur_share_dir() -> Path:
    path = shares_root() / "taur"
    path.mkdir(parents=True, exist_ok=True)
    return path


def canonicalize_query(items: list[tuple[str, str]]) -> str:
    """Convert query string into a format thats safe for a url"""
    filtered = [(k, v) for k, v in items if v]
    filtered.sort(key=lambda pair: pair[0])
    return "&".join(f"{k}={v}" for k, v in filtered)


def share_id_for_query(query_string: str) -> str:
    digest = hashlib.sha256(query_string.encode("utf-8")).hexdigest()
    return digest[:16]


def taur_png_path(share_id: str) -> Path:
    if not SHARE_ID_RE.match(share_id):
        raise ValueError("invalid share id")
    return (taur_share_dir() / f"{share_id}.png").resolve()


def taur_preview_exists(share_id: str) -> bool:
    """Check if a share preview exists"""
    try:
        return taur_png_path(share_id).is_file()
    except ValueError:
        return False


def save_taur_preview(share_id: str, png_bytes: bytes) -> Path:
    """Save a share preview"""
    path = taur_png_path(share_id)
    path.write_bytes(png_bytes)
    return path


def share_id_from_request_args(args, *, species_names: set[str] | None = None) -> str | None:
    """Return share id for valid taur params"""
    from werkzeug.datastructures import MultiDict

    from app.shares.taur_params import validate_taur_params

    pairs = [(key, args.get(key, "")) for key in args.keys()]
    validated, err = validate_taur_params(MultiDict(pairs), species_names or set())
    if err or not validated:
        return None
    return share_id_for_query(canonicalize_query(validated))


def check_rate_limit(client_ip: str, *, max_per_hour: int = 30) -> bool:
    """Return True if upload is allowed."""
    log_dir = shares_root() / ".ratelimit"
    log_dir.mkdir(parents=True, exist_ok=True)
    safe_ip = re.sub(r"[^0-9a-f:.]", "_", client_ip or "unknown")
    log_file = log_dir / f"{safe_ip}.log"
    now = time.time()
    cutoff = now - 3600

    recent: list[float] = []
    if log_file.is_file():
        for line in log_file.read_text().splitlines():
            try:
                ts = float(line.strip())
            except ValueError:
                continue
            if ts >= cutoff:
                recent.append(ts)

    if len(recent) >= max_per_hour:
        return False

    recent.append(now)
    log_file.write_text("\n".join(str(ts) for ts in recent) + "\n")
    return True
