"""Filing certificates into the teacher's Google Drive.

Setup (once, by the teacher):
1. Create a folder in Google Drive for the class's certificates.
2. Share it with the service account's email address as Editor.
3. Give the backend the folder's ID (the last part of its URL) as CERT_DRIVE_ROOT_FOLDER_ID,
   and the service account's key file as GOOGLE_SERVICE_ACCOUNT_FILE.

Layout inside that folder:  <Provider>/<roll>_<student>_<course>.pdf   (plus "Needs review" and "Other providers")
"""
from __future__ import annotations

import io
from typing import Protocol

SCOPES = ["https://www.googleapis.com/auth/drive"]
FOLDER_MIME = "application/vnd.google-apps.folder"
MIME = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


class Store(Protocol):
    def file(self, folder: str, name: str, data: bytes, mime: str) -> str:
        """Save `data` as `name` inside the folder called `folder`; return a link to it."""


class GoogleDriveStore:
    def __init__(self, root_folder_id: str, service_account_file: str):
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        creds = service_account.Credentials.from_service_account_file(service_account_file, scopes=SCOPES)
        self._drive = build("drive", "v3", credentials=creds, cache_discovery=False)
        self._root = root_folder_id
        self._folders: dict[str, str] = {}

    def _folder_id(self, name: str) -> str:
        if name in self._folders:
            return self._folders[name]
        safe = name.replace("\\", "\\\\").replace("'", "\\'")
        q = f"name = '{safe}' and '{self._root}' in parents and mimeType = '{FOLDER_MIME}' and trashed = false"
        found = self._drive.files().list(q=q, fields="files(id)", pageSize=1).execute().get("files", [])
        if found:
            fid = found[0]["id"]
        else:
            fid = self._drive.files().create(
                body={"name": name, "mimeType": FOLDER_MIME, "parents": [self._root]}, fields="id").execute()["id"]
        self._folders[name] = fid
        return fid

    def file(self, folder: str, name: str, data: bytes, mime: str) -> str:
        from googleapiclient.http import MediaIoBaseUpload
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime, resumable=False)
        made = self._drive.files().create(
            body={"name": name, "parents": [self._folder_id(folder)]}, media_body=media, fields="id, webViewLink").execute()
        return made["webViewLink"]


class MemoryStore:
    """Stands in for Drive in tests and dry runs."""
    def __init__(self):
        self.files: dict[tuple[str, str], bytes] = {}

    def file(self, folder: str, name: str, data: bytes, mime: str) -> str:
        self.files[(folder, name)] = data
        return f"memory://{folder}/{name}"
