# Saving Excel registers to Google Drive

The class report and attendance pages have **Download Excel** (works with no setup) and
**Save to Google Drive**. The Drive button needs a Google OAuth client id, created once for the whole app.

## One-time setup (whoever owns the Google account for the project)

1. Go to <https://console.cloud.google.com>, create a project (e.g. "NEST").
2. **APIs & Services → Library**: enable **Google Drive API**.
3. **OAuth consent screen**: choose External (or Internal if the college uses Google Workspace).
   Add the scope `.../auth/drive.file`. While in "Testing", add each teacher's email as a test user.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   Under *Authorized JavaScript origins* add `http://localhost:3000` (what `npm run dev` serves) and the real site address.
5. Copy the client id (ends in `.apps.googleusercontent.com`) into `web/config.js`:

   ```js
   GOOGLE_CLIENT_ID: "1234-abc.apps.googleusercontent.com"
   ```

A client id is not a secret (it is visible in the browser by design). Never put a client *secret* in `web/`.

## What it does

- Asks the teacher to sign in with Google (pre-filled with their NEST email) the first time.
- Creates the sheet in a **NEST reports** folder in *their own* Drive, as an `.xlsx` they can open in Excel or Sheets.
- Uses the `drive.file` scope: NEST can only see files it created, nothing else in their Drive.
- NEST stores no Google token; it lives in the page until it is closed.
