"""The one call the web app makes when a student uploads a certificate."""
from __future__ import annotations

import os
import re
from dataclasses import asdict, dataclass

from .drive import MIME, GoogleDriveStore, MemoryStore, Store
from .providers import OTHER_FOLDER, REVIEW_FOLDER
from .validator import Result, validate


@dataclass
class Student:
    roll: str
    name: str


def store_from_env() -> Store:
    root, key = os.environ.get("CERT_DRIVE_ROOT_FOLDER_ID"), os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
    if not root or not key:
        raise RuntimeError("Set CERT_DRIVE_ROOT_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_FILE (see drive.py).")
    return GoogleDriveStore(root, key)


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")[:60]


def _folder_for(result: Result) -> str:
    if result.status == "review":
        return REVIEW_FOLDER
    return result.provider or OTHER_FOLDER


def submit(student: Student, data: bytes, filename: str, store: Store, seen_hashes: set[str] | None = None,
           *, check_online: bool = False) -> dict:
    """Check the file, and if it isn't rejected, file it in the teacher's Drive.

    `seen_hashes` holds hashes of files already filed for this student; pass the set you keep in your database
    so the same file can't be filed twice. Returns a dict the frontend can show as it is.
    """
    result = validate(data, filename, student.name, check_online=check_online)
    out = asdict(result)
    out["file"] = filename

    if result.status != "rejected" and seen_hashes is not None and result.sha256 in seen_hashes:
        out.update(status="rejected", reason="You have already uploaded this certificate.")
        return out

    if out["status"] != "rejected":
        folder = _folder_for(result)
        ext = "." + filename.lower().rsplit(".", 1)[-1]
        name = "_".join(filter(None, [student.roll, _slug(student.name), _slug(result.course or "certificate")])) + ext
        out["folder"] = folder
        out["drive_link"] = store.file(folder, name, data, MIME[ext])
        if seen_hashes is not None:
            seen_hashes.add(result.sha256)
    return out


if __name__ == "__main__":   # python -m certifications.service FILE --roll 23AD014 --name "Aarav Sharma" [--dry-run]
    import argparse, json
    ap = argparse.ArgumentParser(description="Check a certificate and file it in Drive.")
    ap.add_argument("file")
    ap.add_argument("--roll", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--online", action="store_true", help="also open the verification link")
    ap.add_argument("--dry-run", action="store_true", help="don't touch Drive")
    a = ap.parse_args()
    with open(a.file, "rb") as fh:
        payload = fh.read()
    print(json.dumps(submit(Student(a.roll, a.name), payload, os.path.basename(a.file),
                            MemoryStore() if a.dry_run else store_from_env(), check_online=a.online), indent=2))
