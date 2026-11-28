// node --test supabase/functions/check-certificate/
// The same cases as backend/tests/test_certifications.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkText, fileKindOk, findIssued, nameMatches } from './checker.mjs';

const ME = 'Aarav Sharma';
const TODAY = new Date('2026-11-27T00:00:00Z');
const NPTEL = `NPTEL Online Certification (Funded by the Ministry of Education, Govt. of India)
This certificate is awarded to SHARMA AARAV for successfully completing the course "Programming in Java"
Jul-Oct 2025, 18 June 2026. Roll No: NPTEL26CS43S5523014
To verify the certificate: https://nptel.ac.in/noc/verify/NPTEL26CS43S5523014`;
const COURSERA = `Coursera  Aarav Sharma has successfully completed the online course Google Data Analytics
Completed on March 2, 2026. Verify at https://coursera.org/verify/ABCD1234EFGH`;
const check = (text, name = ME, opts = {}) => checkText(text, name, { today: TODAY, ...opts });

test('NPTEL looks genuine', async () => {
  const r = await check(NPTEL);
  assert.deepEqual([r.status, r.provider, r.topic], ['verified', 'NPTEL', 'Programming']);
  assert.equal(r.course, 'Programming in Java');
  assert.equal(r.issued, '2026-06-18');
  assert.equal(r.credential_id, 'NPTEL26CS43S5523014');
});

test('Coursera looks genuine, and is sorted by topic', async () => {
  const r = await check(COURSERA);
  assert.deepEqual([r.status, r.provider, r.topic], ['verified', 'Coursera', 'Data & AI']);
  assert.equal(r.issued, '2026-03-02');
});

test("someone else's certificate", async () => {
  assert.equal((await check(COURSERA, 'Priya Nair')).status, 'rejected');
});

test('not a certificate', async () => {
  assert.equal((await check('Lecture notes on binary trees and their traversal orders, week three of the course.')).status, 'rejected');
});

test('nothing readable goes to a person', async () => {
  assert.equal((await check('  ')).status, 'review');
});

test('unknown provider goes to a person', async () => {
  const r = await check('Certificate of completion awarded to Aarav Sharma by Acme Learning Hub.');
  assert.deepEqual([r.status, r.provider], ['review', null]);
});

test('no credential goes to a person', async () => {
  const r = await check('Udemy Certificate of completion. Aarav Sharma completed the course Python Bootcamp.');
  assert.deepEqual([r.status, r.provider], ['review', 'Udemy']);
});

test('verification link on another site', async () => {
  const r = await check(COURSERA.replace('coursera.org/verify', 'coursera-verify.xyz/verify'));
  assert.equal(r.status, 'rejected');
  assert.equal(r.checks.verify_domain_ok, false);
});

test('a look-alike domain is not the provider', async () => {
  const r = await check(COURSERA.replace('https://coursera.org/verify', 'https://coursera.org.evil.io/verify'));
  assert.equal(r.status, 'rejected');
});

test('the verification link, opened', async () => {
  assert.equal((await check(COURSERA, ME, { fetchStatus: async () => 200 })).status, 'verified');
  assert.equal((await check(COURSERA, ME, { fetchStatus: async () => 404 })).status, 'rejected');
  assert.equal((await check(COURSERA, ME, { fetchStatus: async () => null })).status, 'review');
  assert.equal((await check(COURSERA, ME, { fetchStatus: async () => 503 })).status, 'review');
});

test('only a link on the provider site is ever opened', async () => {
  const opened = [];
  await check(COURSERA.replace('coursera.org/verify', 'evil.example/verify'), ME, { fetchStatus: async (u) => { opened.push(u); return 200; } });
  assert.deepEqual(opened, []);
});

test('names: any order, initials skipped, every part needed', () => {
  assert.ok(nameMatches('awarded to SHARMA AARAV', 'Aarav Sharma'));
  assert.ok(nameMatches('awarded to Bindiya Sharma', 'Bindiya C S'));
  assert.ok(!nameMatches('awarded to Aarav Kumar', 'Aarav Sharma'));
  assert.ok(!nameMatches('anything', ''));
});

test('dates: impossible and future ones are skipped', () => {
  assert.equal(findIssued('issued 31 February 2026, completed 3 March 2026', TODAY), '2026-03-03');
  assert.equal(findIssued('valid until 2030-01-01', TODAY), null);
});

test('file is what its name says', () => {
  assert.ok(fileKindOk(new TextEncoder().encode('%PDF-1.4 ...'), 'cert.pdf'));
  assert.ok(fileKindOk(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'cert.JPG'));
  assert.ok(!fileKindOk(new TextEncoder().encode('not a pdf at all'), 'cert.pdf'));
  assert.ok(!fileKindOk(new TextEncoder().encode('%PDF'), 'cert.exe'));
});
