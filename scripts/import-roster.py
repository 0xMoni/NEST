#!/usr/bin/env python3
"""Import the college's student roster into NEST.

The roster is an .xlsx the department maintains by hand: one sheet per
section, a title row, a header row, then the students. This reads it,
creates an account per student and enrols them in their section.

Python, where the rest of scripts/ is Node, for one reason: the standard
library opens .xlsx on its own. The Node alternative is a spreadsheet
dependency, and this is a tool the department runs a handful of times.

The file holds real names, addresses and phone numbers. It must stay out
of the repo — .gitignore blocks *.xlsx and private-data/ — and nothing
here prints a student's details to the terminal.

    python3 scripts/import-roster.py --file ~/Downloads/roster.xlsx
    python3 scripts/import-roster.py --file ~/… --sheet "5 CSE" --commit

Without --commit it reads, checks and reports, and writes nothing.
"""

import argparse, json, os, re, sys, time, unicodedata, urllib.error, urllib.request, zipfile
from xml.etree import ElementTree as ET

NS  = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"

USN_RE = re.compile(r"^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}$")
# "5 CSE A", "3 CSE_B ", "7  CSE A " — semester, department, section
SHEET_RE = re.compile(r"^\s*(\d)\s*([A-Za-z]+)[\s_]*([A-Za-z])\s*$")


# ---------------------------------------------------------------- spreadsheet

def read_sheets(path):
    """Yield (sheet name, [row dicts keyed by column letter])."""
    z = zipfile.ZipFile(path)
    shared = ["".join(t.text or "" for t in si.iter(NS + "t"))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si")] \
             if "xl/sharedStrings.xml" in z.namelist() else []
    rels = {r.get("Id"): r.get("Target") for r in
            ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).iter(PKG + "Relationship")}

    for s in ET.fromstring(z.read("xl/workbook.xml")).iter(NS + "sheet"):
        target = rels[s.get(RNS + "id")].lstrip("/")
        f = target if target.startswith("xl/") else "xl/" + target
        rows = []
        for row in ET.fromstring(z.read(f)).iter(NS + "row"):
            cells = {}
            for c in row.iter(NS + "c"):
                ref = re.match(r"[A-Z]+", c.get("r")).group()
                v, isx = c.find(NS + "v"), c.find(NS + "is")
                if c.get("t") == "s" and v is not None:
                    val = shared[int(v.text)]
                elif isx is not None:
                    val = "".join(t.text or "" for t in isx.iter(NS + "t"))
                elif v is not None:
                    val = v.text
                else:
                    continue
                val = unicodedata.normalize("NFKC", val or "").strip()
                if val:
                    cells[ref] = val
            if cells:
                rows.append(cells)
        yield s.get("name"), rows


def find_columns(rows):
    """Locate the header row and map USN/name/email/phone to column letters."""
    for i, r in enumerate(rows):
        lowered = {k: v.lower() for k, v in r.items()}
        usn = next((k for k, v in lowered.items() if v == "usn"), None)
        if not usn:
            continue
        name  = next((k for k, v in lowered.items() if "name" in v), None)
        # the sheet spells it "MAILL ID" in places, so match loosely
        email = next((k for k, v in lowered.items() if "mail" in v), None)
        # some sections carry a second phone column; the first is the student's
        phone = next((k for k, v in sorted(lowered.items()) if "phone" in v or "mobile" in v), None)
        if name and usn:
            return i, {"usn": usn, "name": name, "email": email, "phone": phone}
    return None, None


def parse(path, only):
    """-> (students, no_usn, problems). None of them carry a name to a terminal."""
    students, no_usn, problems = [], [], []

    for sheet, rows in read_sheets(path):
        m = SHEET_RE.match(sheet)
        if not m:
            problems.append(("sheet", sheet, "name does not read as '<sem> <dept> <section>'"))
            continue
        semester, dept, section = int(m.group(1)), m.group(2).upper(), m.group(3).upper()
        label = f"{dept}-{semester}{section}"
        if only and only.lower() not in sheet.lower() and only.lower() not in label.lower():
            continue

        header_at, cols = find_columns(rows)
        if not cols:
            problems.append(("sheet", sheet, "no header row with a USN column"))
            continue

        for r in rows[header_at + 1:]:
            usn = (r.get(cols["usn"]) or "").upper().replace(" ", "")
            if not usn:
                continue
            if not USN_RE.match(usn):
                # Lateral-entry students are on the roll under the word DIPLOMA
                # because the college has not issued their USN yet. They are real
                # students, not bad rows, and the USN is the login — so they are
                # counted and named as waiting, never invented.
                if usn == "DIPLOMA":
                    no_usn.append(label)
                else:
                    problems.append((label, usn, "not a USN"))
                continue
            name = r.get(cols["name"]) or ""
            if not name:
                problems.append((label, usn, "no name"))
                continue
            email = (r.get(cols["email"]) or "").lower().replace(" ", "") if cols["email"] else ""
            phone = re.sub(r"[^\d]", "", r.get(cols["phone"]) or "") if cols["phone"] else ""
            students.append({
                "usn": usn, "full_name": name.title(), "email": email,
                "phone": phone[-10:] if len(phone) >= 10 else "",
                "dept": dept, "semester": semester, "section": section, "label": label,
            })

    return students, no_usn, problems


# ---------------------------------------------------------------- supabase

class Supabase:
    def __init__(self, url, key):
        self.url, self.key = url.rstrip("/"), key

    def _call(self, method, path, body=None, headers=None, tries=4):
        """One call, retried on anything that is the network rather than the data.

        Five hundred sequential HTTPS calls will drop one sooner or later, and
        the first run died on a mid-stream SSL EOF with 163 students left. A
        refusal from the API is final and raises; a connection that broke is
        worth asking again."""
        req = urllib.request.Request(
            f"{self.url}{path}", method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"apikey": self.key, "Authorization": f"Bearer {self.key}",
                     "Content-Type": "application/json", **(headers or {})})
        for attempt in range(tries):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    raw = r.read()
                    return json.loads(raw) if raw else None
            except urllib.error.HTTPError as e:
                # 429 and 5xx are the server asking for a moment, not a verdict
                if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"{e.code} {e.read().decode()[:300]}") from None
            except (urllib.error.URLError, OSError, TimeoutError) as e:
                if attempt < tries - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"connection failed after {tries} tries: {e}") from None

    def section_id(self, dept, semester, name):
        q = f"/rest/v1/sections?dept=eq.{dept}&semester=eq.{semester}&name=eq.{name}&select=id"
        rows = self._call("GET", q)
        if rows:
            return rows[0]["id"]
        made = self._call("POST", "/rest/v1/sections",
                          {"dept": dept, "semester": semester, "name": name},
                          {"Prefer": "return=representation"})
        return made[0]["id"]

    def profile_by_usn(self, usn):
        rows = self._call("GET", f"/rest/v1/profiles?usn=eq.{usn}&select=id")
        return rows[0]["id"] if rows else None

    def create_user(self, email, password, meta):
        made = self._call("POST", "/auth/v1/admin/users", {
            "email": email, "password": password,
            "email_confirm": True,          # no mail is ever sent to a real student
            "user_metadata": meta,
        })
        return made["id"]

    def enrol(self, section_id, student_ids):
        for i in range(0, len(student_ids), 50):
            chunk = student_ids[i:i + 50]
            self._call("POST", "/rest/v1/section_students",
                       [{"section_id": section_id, "student_id": s} for s in chunk],
                       {"Prefer": "resolution=ignore-duplicates"})


# ---------------------------------------------------------------- main

def env_from_local():
    path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf8"):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m and m.group(1) not in os.environ:
            os.environ[m.group(1)] = m.group(2).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="the roster .xlsx")
    ap.add_argument("--sheet", help="only sheets matching this, e.g. '5 CSE'")
    ap.add_argument("--commit", action="store_true", help="actually write; otherwise report only")
    ap.add_argument("--hod", help="email for the HOD account, created as admin")
    ap.add_argument("--domain", default="eastpoint.ac.in",
                    help="used to build an address for a student whose row has none")
    args = ap.parse_args()

    env_from_local()
    url, key = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        sys.exit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local")
    password = os.environ.get("SEED_PASSWORD", "123456")

    students, no_usn, problems = parse(args.file, args.sheet)

    # A USN is one person. The same one twice means two sheets disagree, and
    # the unique index on profiles would reject the second anyway.
    seen, dupes, unique = {}, [], []
    for s in students:
        if s["usn"] in seen:
            dupes.append((s["usn"], seen[s["usn"]], s["label"]))
        else:
            seen[s["usn"]] = s["label"]
            unique.append(s)

    # The college runs two address schemes, and which one a student has depends
    # on their year. For the few rows with no address at all, follow whichever
    # one their own section mostly uses rather than imposing a default.
    domains = {}
    for s in unique:
        if "@" in s["email"]:
            d = domains.setdefault(s["label"], {})
            host = s["email"].split("@", 1)[1]
            d[host] = d.get(host, 0) + 1

    # Everyone signs in by USN, so a missing address only has to be unique.
    no_email, built = 0, {}
    for s in unique:
        if not s["email"]:
            local = domains.get(s["label"]) or {}
            host = max(local, key=local.get) if local else args.domain
            s["email"] = f"{s['usn'].lower()}@{host}"
            built[host] = built.get(host, 0) + 1
            no_email += 1

    by_section = {}
    for s in unique:
        by_section.setdefault((s["dept"], s["semester"], s["section"]), []).append(s)

    print(f"\n  {args.file}\n")
    for (d, sem, sec), group in sorted(by_section.items()):
        print(f"    {d}-{sem}{sec:<3} {len(group):>3} students")
    print(f"\n    {len(unique)} students in {len(by_section)} sections")
    if no_email:
        made_up = ", ".join(f"{v} at @{k}" for k, v in sorted(built.items()))
        print(f"    {no_email} had no address on the sheet — given <usn>@ their section's domain "
              f"({made_up})")
    if no_usn:
        where = {}
        for label in no_usn:
            where[label] = where.get(label, 0) + 1
        print(f"\n    {len(no_usn)} students are on the roll with no USN issued yet "
              f"(the sheet says DIPLOMA):")
        print("      " + ", ".join(f"{k} {v}" for k, v in sorted(where.items())))
        print("      They cannot be imported — the USN is how a student signs in.")

    if dupes:
        print(f"\n    {len(dupes)} USNs appear on more than one sheet, skipped:")
        for usn, first, again in dupes[:10]:
            print(f"      {usn}  {first} and {again}")
    if problems:
        print(f"\n    {len(problems)} rows could not be read:")
        for where, what, why in problems[:10]:
            print(f"      {where:<10} {what:<14} {why}")

    if not args.commit:
        print("\n  Nothing written. Re-run with --commit to create these accounts.\n")
        return

    sb = Supabase(url, key)
    print()

    if args.hod:
        try:
            sb.create_user(args.hod, password, {"full_name": "HOD", "role": "admin", "usn": None})
            print(f"    HOD account created as admin")
        except RuntimeError as e:
            print(f"    HOD account {'already exists' if 'already' in str(e) else e}")

    made = skipped = failed = 0
    for (d, sem, sec), group in sorted(by_section.items()):
        sid = sb.section_id(d, sem, sec)
        ids = []
        for s in group:
            try:
                ids.append(sb.create_user(s["email"], password, {
                    "full_name": s["full_name"], "role": "student",
                    "usn": s["usn"], "phone": s["phone"],
                }))
                made += 1
            except RuntimeError as e:
                try:
                    existing = sb.profile_by_usn(s["usn"])
                except RuntimeError:
                    existing = None
                if existing:
                    ids.append(existing)
                    skipped += 1
                else:
                    failed += 1
                    print(f"      {s['usn']}  {e}")
        sb.enrol(sid, ids)
        print(f"    {d}-{sem}{sec:<3} {len(ids):>3} enrolled")

    print(f"\n    {made} created, {skipped} already existed, {failed} failed")
    print(f"    Everyone starts on the password in SEED_PASSWORD (currently set).\n")


if __name__ == "__main__":
    main()
