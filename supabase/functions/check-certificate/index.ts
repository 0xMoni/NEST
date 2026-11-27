// check-certificate: the automatic check on an uploaded certificate.
//
// The student's Online certifications page calls this straight after an
// upload, with the certificate's id. The mentor's Mentees page calls it
// for one that was never checked (uploaded before this existed, or the
// call failed). It reads the file, runs checker.mjs, and writes the
// findings to certificates.auto_check. It never verifies or rejects: the
// mentor does, with the findings in front of them.
//
// Who can ask: anyone who can read the certificate under the database's
// own rules (the student, their mentor, the HOD). The read is done as the
// caller, so this can't be used to look at anyone else's.
//
// Deploy: supabase functions deploy check-certificate --no-verify-jwt
// (it checks the caller itself; see docs/supabase-setup.md).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'npm:unpdf@1';
import * as checker from './checker.mjs';

// checker.mjs is plain JavaScript (so Node can test it); its shapes, for TypeScript.
type Check = {
  status: 'verified' | 'review' | 'rejected';
  reason: string | null;
  checks: Record<string, unknown>;
  [found: string]: unknown;
};
const checkText = checker.checkText as unknown as (
  text: string, studentName: string, opts?: { fetchStatus?: (url: string) => Promise<number | null> }
) => Promise<Check>;
const fileKindOk = checker.fileKindOk as (bytes: Uint8Array, filename: string) => boolean;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// The new API keys come as JSON ({"default": "sb_…"}); older projects have the JWT keys.
function key(newName: string, oldName: string): string {
  try {
    const k = JSON.parse(Deno.env.get(newName) ?? '{}').default;
    if (k) return k;
  } catch { /* not set */ }
  return Deno.env.get(oldName) ?? '';
}
const URL_ = Deno.env.get('SUPABASE_URL')!;
const PUBLISHABLE = key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const SECRET = key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).slice(0, 5).join('\n');
}

// Only ever called with a link on the provider's own site (checker.mjs decides).
async function fetchStatus(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'NEST-certificate-check/1.0' } });
    await r.body?.cancel();
    return r.status;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
  const { data: who } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!who?.user) return json({ error: 'Sign in first.' }, 401);

  let body: { id?: string; force?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Send {"id": "<certificate id>"}.' }, 400); }
  if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) return json({ error: 'Send {"id": "<certificate id>"}.' }, 400);

  // Read it as the caller: if the rules don't let them see it, stop here.
  const asCaller = createClient(URL_, PUBLISHABLE, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: cert, error } = await asCaller.from('certificates')
    .select('id, student_id, file_path, file_name, auto_check').eq('id', body.id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!cert) return json({ error: 'Certificate not found.' }, 404);

  // A student gets one check per upload; their mentor or the HOD can run it again.
  const isStudent = cert.student_id === who.user.id;
  if (cert.auto_check && (isStudent || !body.force)) return json(cert.auto_check);

  const file = await admin.storage.from('certificates').download(cert.file_path);
  if (file.error) return json({ error: 'Could not read the file: ' + file.error.message }, 500);
  const buf = await file.data.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const hash = await sha256(buf);

  const { data: student } = await admin.from('profiles').select('full_name').eq('id', cert.student_id).single();

  let result: Check;
  if (!fileKindOk(bytes, cert.file_name)) {
    result = { status: 'rejected', reason: 'The file isn’t what its name says (not a real PDF, PNG or JPG).', checks: { file_kind_ok: false } };
  } else {
    let text = '';
    if (/\.pdf$/i.test(cert.file_name)) {
      try { text = await pdfText(bytes); } catch { /* encrypted or broken: goes to review below */ }
    }
    // Images: there is no text reader (OCR) here, so they go to the mentor as "can't tell".
    result = await checkText(text, student?.full_name ?? '', { fetchStatus });
  }

  // The same file uploaded before, by this student or anyone else.
  const { data: same } = await admin.from('certificates')
    .select('id, student_id').eq('file_sha256', hash).neq('id', cert.id).limit(1);
  if (same?.length) {
    const mine = same[0].student_id === cert.student_id;
    result.checks.duplicate = mine ? 'same student' : 'another student';
    result.status = 'rejected';
    result.reason = mine ? 'The same file was uploaded before.' : 'Another student uploaded exactly the same file.';
  }

  const { error: upd } = await admin.from('certificates')
    .update({ auto_check: result, auto_checked_at: new Date().toISOString(), file_sha256: hash }).eq('id', cert.id);
  if (upd) return json({ error: upd.message }, 500);
  return json(result);
});
