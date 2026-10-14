"""Read a certificate and decide: is it real, whose is it, and which provider issued it.

Outcomes
- verified: looks like a certificate, has the student's name, provider recognised, credential checks out.
- review:   probably fine but a person should look (unreadable scan, unknown provider, no credential to check).
- rejected: not a certificate, someone else's name, a verification link on the wrong domain, or a link that doesn't exist.
"""
from __future__ import annotations

import hashlib
import io
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date
from typing import Callable
from urllib.parse import urlparse

from .providers import Provider, classify_topic, detect_provider

MAX_BYTES = 5 * 1024 * 1024
ALLOWED = {".pdf": b"%PDF", ".png": b"\x89PNG", ".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff"}

CERT_WORDS = ("certificate", "certify", "certified", "completion", "successfully completed", "has completed", "credential")
URL_RE = re.compile(r"https?://[^\s)>\]]+", re.I)
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
DATE_PATTERNS = (
    (re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
    (re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b"), lambda m: (int(m[3]), MONTHS.get(m[2][:3].lower()), int(m[1]))),
    (re.compile(r"\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b"), lambda m: (int(m[3]), MONTHS.get(m[1][:3].lower()), int(m[2]))),
)
COURSE_RE = re.compile(
    r"(?:complet(?:ed|ing)|completion\s+of)\s+(?:the\s+)?(?:online\s+)?(?:course\s+)?[:\-]?\s*[\"“]?([^\n\"”]{4,90})",
    re.I)


@dataclass
class Result:
    status: str                      # verified | review | rejected
    reason: str | None = None        # shown to the student when not verified
    provider: str | None = None
    folder: str | None = None        # Drive folder name to file it in (None = don't store)
    course: str | None = None
    topic: str | None = None
    issued: str | None = None        # ISO date
    credential_id: str | None = None
    verify_url: str | None = None
    sha256: str = ""
    checks: dict = field(default_factory=dict)   # what passed, for the teacher's audit log


def extract_text(data: bytes, filename: str) -> str:
    """Text inside the file. PDFs use pypdf; images need pytesseract + Tesseract (optional)."""
    if filename.lower().endswith(".pdf"):
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages[:5])
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(io.BytesIO(data)))
    except ImportError:
        return ""   # no OCR installed: the file goes to a person


def _norm(s: str) -> list[str]:
    return re.findall(r"[a-z]+", s.lower())


def name_matches(text: str, student_name: str) -> bool:
    """Every part of the student's name appears in the text, in any order (certificates print 'SHARMA AARAV' too)."""
    words = set(_norm(text))
    parts = [p for p in _norm(student_name) if len(p) > 1]
    return bool(parts) and all(p in words for p in parts)


def find_issued(text: str) -> str | None:
    for rx, pick in DATE_PATTERNS:
        for m in rx.finditer(text):
            y, mo, d = pick(m)
            try:
                dt = date(y, mo, d)
            except (TypeError, ValueError):
                continue
            if date(2000, 1, 1) <= dt <= date.today():
                return dt.isoformat()
    return None


def find_verify_url(text: str, provider: Provider | None) -> str | None:
    urls = [u.rstrip(".,;") for u in URL_RE.findall(text)]
    if provider:
        on_provider = [u for u in urls if _domain_ok(u, provider)]
        if on_provider:
            return on_provider[0]
    return urls[0] if urls else None


def _domain_ok(url: str, provider: Provider) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == d or host.endswith("." + d) for d in provider.domains)


def fetch_status(url: str) -> int | None:
    """HTTP status of the verification page, or None if it couldn't be reached."""
    req = urllib.request.Request(url, headers={"User-Agent": "NEST-certificate-check/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None


def validate_text(text: str, student_name: str, *, check_online: bool = False,
                  fetch: Callable[[str], int | None] = fetch_status) -> Result:
    """Judge a certificate from its text. Split from `validate` so it can be tested without files."""
    checks: dict = {}
    low = text.lower()
    if len(text.strip()) < 40:
        return Result("review", "We couldn’t read any text in this file, so your mentor will check it.", checks=checks)
    checks["looks_like_certificate"] = any(w in low for w in CERT_WORDS)
    if not checks["looks_like_certificate"]:
        return Result("rejected", "This doesn’t look like a certificate. Upload the PDF the provider gave you.", checks=checks)

    checks["name_matches"] = name_matches(text, student_name)
    if not checks["name_matches"]:
        return Result("rejected", "Your name isn’t on this certificate. Upload your own.", checks=checks)

    provider = detect_provider(text)
    out = Result("verified", provider=provider.name if provider else None, topic=classify_topic(text),
                 issued=find_issued(text), checks=checks)
    m = COURSE_RE.search(text)
    out.course = re.sub(r"\s+", " ", m.group(1)).strip(" .,:-") if m else None

    if provider is None:
        out.status, out.reason = "review", "We couldn’t tell which provider this is from, so your mentor will check it."
        return out

    id_match = provider.id_pattern.search(text) if provider.id_pattern else None
    out.credential_id = id_match.group(1) if id_match else None
    out.verify_url = find_verify_url(text, provider)
    checks["credential_found"] = bool(out.credential_id or out.verify_url)

    if out.verify_url and not _domain_ok(out.verify_url, provider):
        checks["verify_domain_ok"] = False
        out.status = "rejected"
        out.reason = f"The verification link on this certificate doesn’t belong to {provider.name}."
        return out
    if out.verify_url:
        checks["verify_domain_ok"] = True
        if check_online:
            code = fetch(out.verify_url)
            checks["verify_http"] = code
            if code is None:
                out.status, out.reason = "review", "We couldn’t reach the verification page, so your mentor will check it."
            elif code in (404, 410):
                out.status, out.reason = "rejected", "The verification link on this certificate doesn’t exist."
            elif code >= 400:
                out.status, out.reason = "review", "The verification page didn’t load, so your mentor will check it."
            return out
    if not checks["credential_found"]:
        out.status, out.reason = "review", "We couldn’t find a credential ID or verification link, so your mentor will check it."
    return out


def validate(data: bytes, filename: str, student_name: str, **kw) -> Result:
    """Validate an uploaded file. Always returns a Result; never raises for bad input."""
    sha = hashlib.sha256(data).hexdigest()
    ext = "." + filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ALLOWED or not data.startswith(ALLOWED[ext]):
        return Result("rejected", "Use a PDF, PNG or JPG file.", sha256=sha)
    if len(data) > MAX_BYTES:
        return Result("rejected", "That file is over 5 MB.", sha256=sha)
    try:
        text = extract_text(data, filename)
    except Exception:   # corrupt or encrypted PDF
        return Result("review", "We couldn’t open this file, so your mentor will check it.", sha256=sha)
    result = validate_text(text, student_name, **kw)
    result.sha256 = sha
    return result
