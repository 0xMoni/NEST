import unittest

from certifications import Student, submit
from certifications.drive import MemoryStore
from certifications.validator import validate_text

try:
    import pypdf  # noqa: F401
    HAVE_PYPDF = True
except ImportError:
    HAVE_PYPDF = False

ME = "Aarav Sharma"
NPTEL = """NPTEL Online Certification (Funded by the Ministry of Education, Govt. of India)
This certificate is awarded to SHARMA AARAV for successfully completing the course "Programming in Java"
Jul-Oct 2025, 18 June 2026. Roll No: NPTEL26CS43S5523014
To verify the certificate: https://nptel.ac.in/noc/verify/NPTEL26CS43S5523014"""
COURSERA = """Coursera  Aarav Sharma has successfully completed the online course Google Data Analytics
Completed on March 2, 2026. Verify at https://coursera.org/verify/ABCD1234EFGH"""


def pdf_with(text: str) -> bytes:
    """A one-page PDF holding `text`, built by hand so the tests need no PDF-writing library."""
    lines = text.split("\n")
    esc = lambda s: s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    content = "BT /F1 9 Tf 40 780 Td 12 TL " + " T* ".join(f"({esc(l)}) Tj" for l in lines) + " ET"
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


class ValidateText(unittest.TestCase):
    def test_nptel_verified(self):
        r = validate_text(NPTEL, ME)
        self.assertEqual((r.status, r.provider, r.topic), ("verified", "NPTEL", "Programming"))
        self.assertEqual(r.course, "Programming in Java")
        self.assertEqual(r.issued, "2026-06-18")
        self.assertEqual(r.credential_id, "NPTEL26CS43S5523014")

    def test_coursera_verified_and_classified(self):
        r = validate_text(COURSERA, ME)
        self.assertEqual((r.status, r.provider, r.topic), ("verified", "Coursera", "Data & AI"))
        self.assertEqual(r.issued, "2026-03-02")

    def test_someone_elses_certificate_rejected(self):
        r = validate_text(COURSERA, "Priya Nair")
        self.assertEqual(r.status, "rejected")

    def test_not_a_certificate_rejected(self):
        r = validate_text("Lecture notes on binary trees and their traversal orders, week three of the course.", ME)
        self.assertEqual(r.status, "rejected")

    def test_unreadable_goes_to_review(self):
        self.assertEqual(validate_text("  ", ME).status, "review")

    def test_unknown_provider_goes_to_review(self):
        r = validate_text("Certificate of completion awarded to Aarav Sharma by Acme Learning Hub.", ME)
        self.assertEqual((r.status, r.provider), ("review", None))

    def test_no_credential_goes_to_review(self):
        r = validate_text("Udemy Certificate of completion. Aarav Sharma completed the course Python Bootcamp.", ME)
        self.assertEqual((r.status, r.provider), ("review", "Udemy"))

    def test_link_on_wrong_domain_rejected(self):
        r = validate_text(COURSERA.replace("coursera.org/verify", "coursera-verify.xyz/verify"), ME)
        self.assertEqual(r.status, "rejected")

    def test_online_check(self):
        self.assertEqual(validate_text(COURSERA, ME, check_online=True, fetch=lambda u: 200).status, "verified")
        self.assertEqual(validate_text(COURSERA, ME, check_online=True, fetch=lambda u: 404).status, "rejected")
        self.assertEqual(validate_text(COURSERA, ME, check_online=True, fetch=lambda u: None).status, "review")


@unittest.skipUnless(HAVE_PYPDF, "pypdf not installed")
class Submit(unittest.TestCase):
    def setUp(self):
        self.store, self.me, self.seen = MemoryStore(), Student("23AD014", ME), set()

    def test_verified_pdf_is_filed_under_its_provider(self):
        out = submit(self.me, pdf_with(NPTEL), "cert.pdf", self.store, self.seen)
        self.assertEqual((out["status"], out["folder"]), ("verified", "NPTEL"))
        self.assertEqual(list(self.store.files), [("NPTEL", "23AD014_Aarav-Sharma_Programming-in-Java.pdf")])

    def test_same_file_twice_rejected(self):
        submit(self.me, pdf_with(NPTEL), "cert.pdf", self.store, self.seen)
        again = submit(self.me, pdf_with(NPTEL), "cert.pdf", self.store, self.seen)
        self.assertEqual(again["status"], "rejected")
        self.assertEqual(len(self.store.files), 1)

    def test_review_goes_to_needs_review_folder(self):
        out = submit(self.me, pdf_with("Certificate of completion awarded to Aarav Sharma by Acme Learning Hub."), "c.pdf", self.store)
        self.assertEqual((out["status"], out["folder"]), ("review", "Needs review"))

    def test_rejected_is_not_stored(self):
        out = submit(Student("23AD099", "Priya Nair"), pdf_with(COURSERA), "c.pdf", self.store)
        self.assertEqual(out["status"], "rejected")
        self.assertEqual(self.store.files, {})

    def test_fake_extension_rejected(self):
        out = submit(self.me, b"not a pdf at all", "cert.pdf", self.store)
        self.assertEqual(out["status"], "rejected")


if __name__ == "__main__":
    unittest.main()
