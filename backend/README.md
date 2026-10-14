# Certificate checker

Takes a certificate a student uploaded, checks it, works out which provider issued it, and files it in the
teacher's Google Drive. This is only the checking-and-filing part; it isn't connected to the web app yet.

## What it does

For each upload, `submit(student, file_bytes, filename, store)`:

1. Checks the file is a real PDF, PNG or JPG under 5 MB.
2. Reads the text (PDFs with `pypdf`; images need Tesseract, otherwise they go to review).
3. Decides the outcome:
   - **verified**: looks like a certificate, has the student's name, provider recognised, credential found.
   - **review**: probably fine but a person should look (unreadable, unknown provider, no credential ID or link).
   - **rejected**: not a certificate, someone else's name, verification link on the wrong domain, or a link that 404s.
4. Works out the **provider** (NPTEL, Coursera, Udemy, edX, Microsoft, AWS, Google, Oracle, Infosys Springboard) and a
   **topic** (Cloud, Data & AI, Programming, ...).
5. Unless rejected, uploads it to Drive: `<Provider>/<roll>_<name>_<course>.pdf`. Review cases go to `Needs review`,
   unrecognised providers to `Other providers`.

Pass `check_online=True` to also open the certificate's verification link and make sure it exists.
The same file can't be filed twice if you pass the student's `seen_hashes` set.

## Teacher's Drive setup (once)

1. In Google Cloud, create a **service account**, enable the **Google Drive API**, and download its JSON key.
2. In Drive, create the folder for the class's certificates and share it with the service account's email as **Editor**.
3. Set two environment variables for the backend:
   - `GOOGLE_SERVICE_ACCOUNT_FILE`: path to the JSON key
   - `CERT_DRIVE_ROOT_FOLDER_ID`: the folder's ID (the last part of its URL)

The backend never sees the teacher's own login, and it can only touch folders shared with it.

## Try it

```
pip install -r requirements.txt
cd backend
python -m certifications.service path/to/cert.pdf --roll 23AD014 --name "Aarav Sharma" --dry-run
python -m unittest discover -s tests
```

`--dry-run` keeps everything in memory instead of calling Drive.

## Adding a provider

Add one entry to `PROVIDERS` in `certifications/providers.py`: its name, phrases that appear on its
certificates, the domains its verification links use, and (optionally) a pattern for its credential ID.
The Drive folder is created automatically the first time a certificate from it arrives.

## Not done yet

- The web endpoint the Online certifications page will call, and storing results per student.
- Reading image certificates is untested without Tesseract installed.
- Provider patterns are written from what these certificates usually say; check each against a real sample before relying on it.
