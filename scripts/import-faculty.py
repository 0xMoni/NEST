#!/usr/bin/env python3
"""Import the department's faculty list into NEST.

Takes a .csv or .xlsx with a name, a designation and an email per row,
and creates one account each. Whoever is marked HOD becomes the admin;
everyone else is faculty.

The department keeps this as a legacy .xls, which the standard library
cannot open. Save it as .xlsx or .csv first — Excel does it in two
clicks — rather than adding a dependency for a file that is read a
handful of times a year.

Like the roster, this holds real names and addresses, so keep the file
out of the repo (private-data/ is ignored) and note that nothing here
prints a name to the terminal.

    python3 scripts/import-faculty.py --file private-data/faculty.csv
    python3 scripts/import-faculty.py --file private-data/faculty.csv --commit

Without --commit it reads, checks and reports, and writes nothing.
"""

import argparse, csv, json, os, re, sys, time, unicodedata, urllib.error, urllib.request, zipfile
from xml.etree import ElementTree as ET

NS  = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$")


# ---------------------------------------------------------------- reading

def rows_from_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = ["".join(t.text or "" for t in si.iter(NS + "t"))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si")] \
             if "xl/sharedStrings.xml" in z.namelist() else []
    rels = {r.get("Id"): r.get("Target") for r in
            ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).iter(PKG + "Relationship")}
    for s in ET.fromstring(z.read("xl/workbook.xml")).iter(NS + "sheet"):
        target = rels[s.get(RNS + "id")].lstrip("/")
        f = target if target.startswith("xl/") else "xl/" + target
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
                yield [cells.get(chr(ord("A") + i), "") for i in range(8)]


def rows_from_csv(path):
    with open(path, newline="", encoding="utf8-sig" if False else "utf8") as f:
        for row in csv.reader(f):
            if any(c.strip() for c in row):
                yield [c.strip() for c in row]


def parse(path):
    """-> (people, problems). The header is found rather than assumed, so the
    department can move a column without this quietly reading the wrong one."""
    rows = list(rows_from_csv(path) if path.lower().endswith(".csv") else rows_from_xlsx(path))

    cols, start = None, 0
    for i, r in enumerate(rows):
        low = [c.lower() for c in r]
        name  = next((j for j, c in enumerate(low) if "name" in c), None)
        email = next((j for j, c in enumerate(low) if "mail" in c), None)
        desig = next((j for j, c in enumerate(low) if "desig" in c), None)
        if name is not None and email is not None:
            cols, start = {"name": name, "email": email, "designation": desig}, i + 1
            break
    if not cols:
        return [], [("file", "no header row with a name and a mail column")]

    people, problems = [], []
    for r in rows[start:]:
        def at(key):
            j = cols[key]
            return r[j].strip() if j is not None and j < len(r) else ""

        name, email = at("name"), at("email").lower()
        if not name:
            continue
        if not EMAIL_RE.match(email):
            problems.append((name[:2] + "…", "no usable email"))
            continue
        designation = at("designation")
        # "Professor &  HOD" — the spacing in the sheet is not to be trusted
        is_hod = "hod" in designation.lower().replace(".", " ").split("&")[-1] \
                 or re.search(r"\bhod\b", designation, re.I) is not None
        people.append({
            "full_name": " ".join(name.split()),
            "designation": " ".join(designation.split()),
            "email": email,
            "role": "admin" if is_hod else "faculty",
        })
    return people, problems


# ---------------------------------------------------------------- supabase

class Supabase:
    def __init__(self, url, key):
        self.url, self.key = url.rstrip("/"), key

    def _call(self, method, path, body=None, headers=None, tries=4):
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
                if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"{e.code} {e.read().decode()[:300]}") from None
            except (urllib.error.URLError, OSError, TimeoutError) as e:
                if attempt < tries - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"connection failed after {tries} tries: {e}") from None

    def create_user(self, email, password, meta):
        return self._call("POST", "/auth/v1/admin/users", {
            "email": email, "password": password,
            "email_confirm": True,          # nothing is ever mailed to a real address
            "user_metadata": meta,
        })["id"]


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
    ap.add_argument("--file", required=True, help="the faculty list, .csv or .xlsx")
    ap.add_argument("--commit", action="store_true", help="actually write; otherwise report only")
    args = ap.parse_args()

    env_from_local()
    url, key = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        sys.exit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local")
    password = os.environ.get("SEED_PASSWORD", "123456")

    people, problems = parse(args.file)

    seen, unique, dupes = set(), [], []
    for p in people:
        if p["email"] in seen:
            dupes.append(p["email"])
        else:
            seen.add(p["email"])
            unique.append(p)

    by_role = {}
    for p in unique:
        by_role[p["role"]] = by_role.get(p["role"], 0) + 1
    by_desig = {}
    for p in unique:
        by_desig[p["designation"] or "(none given)"] = by_desig.get(p["designation"] or "(none given)", 0) + 1

    print(f"\n  {args.file}\n")
    for d, n in sorted(by_desig.items(), key=lambda kv: -kv[1]):
        print(f"    {n:>3}  {d}")
    print(f"\n    {len(unique)} people — {by_role.get('faculty', 0)} as faculty, "
          f"{by_role.get('admin', 0)} as admin (HOD)")
    if dupes:
        print(f"    {len(dupes)} rows share an address with someone above, skipped")
    if problems:
        print(f"\n    {len(problems)} rows could not be read:")
        for who, why in problems[:10]:
            print(f"      {who:<6} {why}")

    if by_role.get("admin", 0) != 1:
        print(f"\n    Note: {by_role.get('admin', 0)} rows look like the HOD. Exactly one is expected.")

    if not args.commit:
        print("\n  Nothing written. Re-run with --commit to create these accounts.\n")
        return

    sb = Supabase(url, key)
    made = skipped = failed = 0
    print()
    for p in sorted(unique, key=lambda x: x["role"]):
        try:
            sb.create_user(p["email"], password, {
                "full_name": p["full_name"], "role": p["role"],
                "usn": None, "designation": p["designation"],
            })
            made += 1
        except RuntimeError as e:
            if "already" in str(e) or "email_exists" in str(e):
                skipped += 1
            else:
                failed += 1
                print(f"      {p['email'].split('@')[0][:3]}…  {e}")

    print(f"    {made} created, {skipped} already existed, {failed} failed")
    print(f"    Everyone starts on the password in SEED_PASSWORD and is sent to "
          f"/change-password on first sign in.\n")


if __name__ == "__main__":
    main()
