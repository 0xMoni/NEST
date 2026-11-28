/* Reads a certificate's text and judges it: is it a certificate, is the
   student's name on it, which provider issued it, and does its
   verification link point at that provider's own site.

   A port of backend/certifications/validator.py and providers.py, so the
   Edge Function can run it. Plain JavaScript with no imports, so it runs
   in Deno (the Edge Function) and in Node (the tests).

   Outcomes, as advice to the mentor (the mentor decides):
   - verified: looks genuine. Certificate, the student's name, a known
     provider, and a credential ID or a link on the provider's site.
   - review:   can't tell. Unreadable, unknown provider, no credential.
   - rejected: looks wrong. Not a certificate, someone else's name, a
     verification link on another site, or a link that doesn't exist. */

// ---------------------------------------------------------------
// Providers. To add one, add an entry; nothing else changes.
// ---------------------------------------------------------------
export const PROVIDERS = [
  { name: 'NPTEL', keywords: ['nptel', 'swayam', 'national programme on technology enhanced learning'],
    domains: ['nptel.ac.in', 'swayam.gov.in', 'archive.nptel.ac.in'],
    id: /\b(NPTEL\d{2}[A-Z]{2,4}\d{1,3}[A-Z]?\d{5,8})\b/ },
  { name: 'Coursera', keywords: ['coursera'], domains: ['coursera.org'],
    id: /coursera\.org\/verify\/([A-Z0-9]{8,16})/i },
  { name: 'Udemy', keywords: ['udemy'], domains: ['udemy.com', 'ude.my'],
    id: /\b(UC-[0-9a-f-]{20,40})\b/i },
  { name: 'edX', keywords: ['edx', 'harvardx', 'mitx'], domains: ['edx.org', 'credentials.edx.org'],
    id: /credentials\.edx\.org\/credentials\/([0-9a-f]{32})/i },
  { name: 'Microsoft', keywords: ['microsoft learn', 'microsoft certified', 'microsoft corporation'],
    domains: ['learn.microsoft.com', 'credly.com', 'aka.ms'],
    id: /\b(?:Certification Number|Credential ID)[:\s]+([A-Z0-9-]{8,24})/i },
  { name: 'AWS', keywords: ['amazon web services', 'aws certified', 'aws training'],
    domains: ['aws.amazon.com', 'credly.com', 'cp.certmetrics.com'],
    id: /\b(?:Validation Number|Credential ID)[:\s]+([A-Z0-9-]{8,24})/i },
  { name: 'Google', keywords: ['google cloud', 'google career certificates', 'grow with google'],
    domains: ['credential.net', 'cloudskillsboost.google', 'coursera.org', 'credly.com'],
    id: /\b(?:Credential ID)[:\s]+([A-Z0-9-]{8,24})/i },
  { name: 'Oracle', keywords: ['oracle university', 'oracle certified'], domains: ['catalog-education.oracle.com', 'credly.com'],
    id: /\b(?:Candidate ID|Credential ID)[:\s]+([A-Z0-9-]{6,24})/i },
  { name: 'Infosys Springboard', keywords: ['infosys springboard', 'springboard.infosys'], domains: ['infytq.onwingspan.com', 'infosys.com'],
    id: null }
];

// What it's about. First match wins.
const TOPICS = [
  ['Cloud', ['cloud', 'aws', 'azure', 'devops', 'kubernetes', 'docker', 'serverless']],
  ['Data & AI', ['machine learning', 'deep learning', 'data science', 'data analytics', 'artificial intelligence', 'nlp', 'statistics', 'big data']],
  ['Programming', ['python', 'java', 'c++', 'javascript', 'programming', 'algorithms', 'data structures', 'web development']],
  ['Security', ['security', 'cryptography', 'ethical hacking', 'cyber']],
  ['Networks & Systems', ['network', 'operating system', 'embedded', 'iot', 'database', 'sql']]
];

const CERT_WORDS = ['certificate', 'certify', 'certified', 'completion', 'successfully completed', 'has completed', 'credential'];
const URL_RE = /https?:\/\/[^\s)>\]]+/gi;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const month = (s) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1 || null;
const DATE_PATTERNS = [
  [/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => [+m[1], +m[2], +m[3]]],
  [/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g, (m) => [+m[3], month(m[2]), +m[1]]],
  [/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g, (m) => [+m[3], month(m[1]), +m[2]]]
];
const COURSE_RE = /(?:complet(?:ed|ing)|completion\s+of)\s+(?:the\s+)?(?:online\s+)?(?:course\s+)?[:-]?\s*["“]?([^\n"”]{4,90})/i;

const count = (hay, needle) => hay.split(needle).length - 1;
const words = (s) => s.toLowerCase().match(/[a-z]+/g) || [];

export function detectProvider(text) {
  const low = text.toLowerCase();
  let best = null, bestHits = 0;
  for (const p of PROVIDERS) {
    const hits = p.keywords.reduce((n, k) => n + count(low, k), 0);
    if (hits > bestHits) { best = p; bestHits = hits; }
  }
  return best;
}

export function classifyTopic(text) {
  const low = text.toLowerCase();
  for (const [topic, ws] of TOPICS) if (ws.some((w) => low.includes(w))) return topic;
  return 'General';
}

/* Every part of the student's name is on it, in any order: certificates
   print "SHARMA AARAV" too. Single letters (initials) are skipped. */
export function nameMatches(text, studentName) {
  const have = new Set(words(text));
  const parts = words(studentName).filter((p) => p.length > 1);
  return parts.length > 0 && parts.every((p) => have.has(p));
}

export function findIssued(text, today = new Date()) {
  const max = today.toISOString().slice(0, 10);
  for (const [rx, pick] of DATE_PATTERNS) {
    for (const m of text.matchAll(rx)) {
      const [y, mo, d] = pick(m);
      if (!mo) continue;
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) continue;   // 31 Feb
      const iso = dt.toISOString().slice(0, 10);
      if (iso >= '2000-01-01' && iso <= max) return iso;
    }
  }
  return null;
}

export function domainOk(url, provider) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  return provider.domains.some((d) => host === d || host.endsWith('.' + d));
}

function findVerifyUrl(text, provider) {
  const urls = (text.match(URL_RE) || []).map((u) => u.replace(/[.,;]+$/, ''));
  return urls.find((u) => domainOk(u, provider)) || urls[0] || null;
}

/* Judge a certificate from its text.
   `fetchStatus(url)` returns the verification page's HTTP status, or null
   if it couldn't be reached; pass it to also check the link exists. It is
   only ever called with a link on the provider's own site.
   @typedef {{ status: 'verified' | 'review' | 'rejected', reason: string | null,
     checks: Record<string, unknown>, [found: string]: unknown }} Check
   @param {string} text
   @param {string} studentName
   @param {{ fetchStatus?: ((url: string) => Promise<number | null>) | null, today?: Date }} [opts]
   @returns {Promise<Check>} */
export async function checkText(text, studentName, { fetchStatus = null, today } = {}) {
  /** @type {Record<string, unknown>} */
  const checks = {};
  const out = (status, reason, extra = {}) => ({ status, reason, checks, ...extra });
  const low = text.toLowerCase();

  if (text.trim().length < 40) {
    return out('review', 'No text could be read from this file (a scan or a photo), so a person has to look at it.');
  }
  checks.looks_like_certificate = CERT_WORDS.some((w) => low.includes(w));
  if (!checks.looks_like_certificate) {
    return out('rejected', 'This doesn’t look like a certificate.');
  }
  checks.name_matches = nameMatches(text, studentName);
  if (!checks.name_matches) {
    return out('rejected', 'The student’s name isn’t on this certificate.');
  }

  const provider = detectProvider(text);
  const m = text.match(COURSE_RE);
  const found = {
    provider: provider ? provider.name : null,
    topic: classifyTopic(text),
    issued: findIssued(text, today),
    course: m ? m[1].replace(/\s+/g, ' ').trim().replace(/^[ .,:-]+|[ .,:-]+$/g, '') : null
  };
  if (!provider) {
    return out('review', 'The provider couldn’t be recognised.', found);
  }

  const idMatch = provider.id ? text.match(provider.id) : null;
  found.credential_id = idMatch ? idMatch[1] : null;
  found.verify_url = findVerifyUrl(text, provider);
  checks.credential_found = Boolean(found.credential_id || found.verify_url);

  if (found.verify_url && !domainOk(found.verify_url, provider)) {
    checks.verify_domain_ok = false;
    return out('rejected', `The verification link isn’t on ${provider.name}’s site.`, found);
  }
  if (found.verify_url) {
    checks.verify_domain_ok = true;
    if (fetchStatus) {
      const code = await fetchStatus(found.verify_url);
      checks.verify_http = code;
      if (code == null) return out('review', 'The verification page couldn’t be reached.', found);
      if (code === 404 || code === 410) return out('rejected', 'The verification link doesn’t exist.', found);
      if (code >= 400) return out('review', 'The verification page didn’t load.', found);
    }
  }
  if (!checks.credential_found) {
    return out('review', 'No credential ID or verification link was found on it.', found);
  }
  return out('verified', null, found);
}

/* The file is what its name says (a PDF starts %PDF, and so on). */
const MAGIC = { pdf: [0x25, 0x50, 0x44, 0x46], png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], jpeg: [0xff, 0xd8, 0xff] };
export function fileKindOk(bytes, filename) {
  const ext = (filename.toLowerCase().match(/\.([a-z]+)$/) || [])[1];
  const magic = MAGIC[ext];
  return Boolean(magic) && magic.every((b, i) => bytes[i] === b);
}
