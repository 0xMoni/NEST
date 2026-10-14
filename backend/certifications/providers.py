"""Which online-course providers we recognise, and how to tell a certificate is theirs.

To support a new provider, add one `Provider` to PROVIDERS. Nothing else needs to change.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    name: str                      # also the name of the provider's folder in Drive
    keywords: tuple[str, ...]      # lower-case phrases that appear on its certificates
    domains: tuple[str, ...]       # domains its verification links may point to
    id_pattern: re.Pattern | None = None  # credential / roll number printed on the certificate


PROVIDERS: tuple[Provider, ...] = (
    Provider("NPTEL", ("nptel", "swayam", "national programme on technology enhanced learning"),
             ("nptel.ac.in", "swayam.gov.in", "archive.nptel.ac.in"),
             re.compile(r"\b(NPTEL\d{2}[A-Z]{2,4}\d{1,3}[A-Z]?\d{5,8})\b")),
    Provider("Coursera", ("coursera",), ("coursera.org",),
             re.compile(r"coursera\.org/verify/([A-Z0-9]{8,16})", re.I)),
    Provider("Udemy", ("udemy",), ("udemy.com", "ude.my"),
             re.compile(r"\b(UC-[0-9a-f\-]{20,40})\b", re.I)),
    Provider("edX", ("edx", "harvardx", "mitx"), ("edx.org", "credentials.edx.org"),
             re.compile(r"credentials\.edx\.org/credentials/([0-9a-f]{32})", re.I)),
    Provider("Microsoft", ("microsoft learn", "microsoft certified", "microsoft corporation"),
             ("learn.microsoft.com", "credly.com", "aka.ms"),
             re.compile(r"\b(?:Certification Number|Credential ID)[:\s]+([A-Z0-9\-]{8,24})", re.I)),
    Provider("AWS", ("amazon web services", "aws certified", "aws training"),
             ("aws.amazon.com", "credly.com", "cp.certmetrics.com"),
             re.compile(r"\b(?:Validation Number|Credential ID)[:\s]+([A-Z0-9\-]{8,24})", re.I)),
    Provider("Google", ("google cloud", "google career certificates", "grow with google"),
             ("credential.net", "cloudskillsboost.google", "coursera.org", "credly.com"),
             re.compile(r"\b(?:Credential ID)[:\s]+([A-Z0-9\-]{8,24})", re.I)),
    Provider("Oracle", ("oracle university", "oracle certified"), ("catalog-education.oracle.com", "credly.com"),
             re.compile(r"\b(?:Candidate ID|Credential ID)[:\s]+([A-Z0-9\-]{6,24})", re.I)),
    Provider("Infosys Springboard", ("infosys springboard", "springboard.infosys"), ("infytq.onwingspan.com", "infosys.com"),
             None),
)

# What a certificate is about, so the teacher can also sort by topic. First match wins.
TOPICS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Cloud", ("cloud", "aws", "azure", "devops", "kubernetes", "docker", "serverless")),
    ("Data & AI", ("machine learning", "deep learning", "data science", "data analytics", "artificial intelligence", "nlp", "statistics", "big data")),
    ("Programming", ("python", "java", "c++", "javascript", "programming", "algorithms", "data structures", "web development")),
    ("Security", ("security", "cryptography", "ethical hacking", "cyber")),
    ("Networks & Systems", ("network", "operating system", "embedded", "iot", "database", "sql")),
)

OTHER_FOLDER = "Other providers"
REVIEW_FOLDER = "Needs review"


def detect_provider(text: str) -> Provider | None:
    """The provider whose keywords appear most often in the text, or None."""
    low = text.lower()
    best, best_hits = None, 0
    for p in PROVIDERS:
        hits = sum(low.count(k) for k in p.keywords)
        if hits > best_hits:
            best, best_hits = p, hits
    return best


def classify_topic(text: str) -> str:
    low = text.lower()
    for topic, words in TOPICS:
        if any(w in low for w in words):
            return topic
    return "General"
