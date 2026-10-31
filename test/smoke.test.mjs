// Smoke E2E — scenariusz z docs/PLAN-WDROZENIA.md / planu buildu (serialized-yawning-sky.md).
// Fixtures WYŁĄCZNIE syntetyczne. AUTH-01/02/03 i M3 NIE są pokryte automatycznym
// testem — zgodnie z samym PRD to kontrola ręczna (ręczny przegląd wygenerowanego MD
// pod kątem haseł), nie coś weryfikowalne w kodzie przy tej architekturze (DECYZJE.md#3).
// Testy poniżej pokrywają SES/GEN/LIB oraz EC-01/03/05.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.TUTOR_DATA_DIR = mkdtempSync(join(tmpdir(), 'tutor-data-'));

const { extractSteps } = await import('../src/transcript.mjs');
const { startSession, stopSession, generateGuide, listSessions } = await import('../src/sessions.mjs');
const { readLog } = await import('../src/log.mjs');
const { guidesDir, sessionsDir } = await import('../src/paths.mjs');

// 1x1 czerwony piksel PNG, base64 — jedyny "obrazek" użyty w fixture'ach.
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const line = (obj) => JSON.stringify(obj) + '\n';

function patchStartedAt(sessionId) {
  const p = join(sessionsDir(), `${sessionId}.json`);
  const onDisk = JSON.parse(readFileSync(p, 'utf8'));
  const patched = new Date(Date.now() - 3600_000).toISOString();
  onDisk.startedAt = patched;
  writeFileSync(p, JSON.stringify(onDisk, null, 2), 'utf8');
  return patched;
}

test('AI-Tech-Tutor — smoke', async (t) => {
  await t.test('extractSteps: allowlist typów/bloków + okno czasowe (unit, bez pełnego cyklu sesji)', () => {
    const base = Date.parse('2026-07-19T10:00:00.000Z');
    const dir = mkdtempSync(join(tmpdir(), 'tutor-extract-'));
    const path = join(dir, 'fixture.jsonl');
    const t0 = (s) => new Date(base + s * 1000).toISOString();
    const content =
      line({ type: 'queue-operation', foo: 'bar' }) +
      line({ type: 'user', timestamp: t0(1), message: { content: 'Janek nie moze sie zalogowac do LinkDM' } }) +
      line({ type: 'assistant', timestamp: t0(2), message: { content: [{ type: 'thinking', text: 'analiza' }, { type: 'text', text: 'Sprawdz czy caps lock jest wlaczony' }] } }) +
      line({ type: 'user', timestamp: t0(3), message: { content: [{ type: 'text', text: 'Zrobione, oto zrzut' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_1PX } }] } }) +
      line({ type: 'assistant', timestamp: t0(4), message: { content: [{ type: 'tool_use', id: '1', name: 'Read', input: {} }] } }) +
      line({ type: 'user', timestamp: t0(5), isSidechain: false, message: { content: [{ type: 'tool_result', tool_use_id: '1', content: 'ok' }] } }) +
      line({ type: 'assistant', timestamp: t0(6), isSidechain: true, message: { content: [{ type: 'text', text: 'gadanie subagenta - ma zostac pominiete' }] } }) +
      line({ type: 'assistant', timestamp: t0(7), message: { content: 'Problem rozwiazany, LinkDM dziala' } }) +
      'to nie jest json\n' +
      line({ type: 'user', timestamp: t0(999), message: { content: 'poza oknem czasowym - nie powinno sie pojawic' } });
    writeFileSync(path, content, 'utf8');

    const { steps, meta } = extractSteps(path, { fromMs: base, toMs: base + 10 * 1000 });

    assert.equal(steps.length, 4);
    assert.equal(steps[0].role, 'user');
    assert.equal(steps[1].text, 'Sprawdz czy caps lock jest wlaczony');
    assert.equal(steps[2].images.length, 1);
    assert.equal(meta.skippedSidechain, 1);
    assert.equal(meta.skippedBlockTypes.thinking, 1);
    assert.equal(meta.skippedBlockTypes.tool_use, 1);
    assert.equal(meta.skippedBlockTypes.tool_result, 1);
    assert.equal(meta.malformedLines, 1);
  });

  await t.test('SES-01/03 + GEN-01/02/03 + LIB-01: pełny cykl start -> stop -> przewodnik', () => {
    process.env.TUTOR_TRANSCRIPTS_DIR = mkdtempSync(join(tmpdir(), 'tutor-tx-a-'));
    const session = startSession('Janek nie moze sie zalogowac do LinkDM', { cwd: process.cwd() });
    assert.equal(session.status, 'otwarta');

    const patchedStart = patchStartedAt(session.id);
    const startMs = Date.parse(patchedStart);
    const t0 = (s) => new Date(startMs + s * 1000).toISOString();
    const transcriptPath = join(process.env.TUTOR_TRANSCRIPTS_DIR, `${session.id}.jsonl`);
    writeFileSync(
      transcriptPath,
      line({ type: 'user', timestamp: t0(1), message: { content: 'Janek nie moze sie zalogowac' } }) +
      line({ type: 'assistant', timestamp: t0(2), message: { content: 'Sprawdz caps lock' } }) +
      line({ type: 'user', timestamp: t0(3), message: { content: [{ type: 'text', text: 'Dziala, oto zrzut' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_1PX } }] } }),
      'utf8',
    );

    const { session: stopped, guide } = stopSession({ sessionId: session.id });
    assert.equal(stopped.status, 'zakonczona');
    assert.equal(guide.status, 'zakonczona');
    assert.equal(guide.krokow, 3);
    assert.equal(guide.zrzutow, 1);
    assert.match(guide.mdPath, /\d{4}-\d{2}-\d{2}-janek-nie-moze-sie-zalogowac-do-linkdm\.md$/);

    const md = readFileSync(guide.mdPath, 'utf8');
    assert.match(md, /### Krok 1/);
    assert.match(md, /Sprawdz caps lock/);
    const html = readFileSync(guide.htmlPath, 'utf8');
    assert.match(html, /<img src=/);

    const log = readLog(session.id);
    assert.equal(log.filter((e) => e.typ === 'krok').length, 3, 'SES-02: logEvent per krok tylko przy stop');
    assert.equal(log.filter((e) => e.typ === 'start').length, 1);
    assert.equal(log.filter((e) => e.typ === 'stop').length, 1);

    assert.throws(() => stopSession({ sessionId: session.id }), /już zakończona/, 'podwójny stop zablokowany');

    const idx = JSON.parse(readFileSync(join(guidesDir(), 'index.json'), 'utf8'));
    assert.ok(idx.some((e) => e.sessionId === session.id), 'LIB-01: wpis w indeksie');
  });

  await t.test('EC-01/GEN-04: generuj --ostatnia na otwartej sesji -> [NIEDOKOŃCZONE], bez duplikatu logu', () => {
    process.env.TUTOR_TRANSCRIPTS_DIR = mkdtempSync(join(tmpdir(), 'tutor-tx-b-'));
    const session = startSession('Test niedokonczonej sesji', { cwd: process.cwd() });
    const patchedStart = patchStartedAt(session.id);

    const transcriptPath = join(process.env.TUTOR_TRANSCRIPTS_DIR, `${session.id}.jsonl`);
    writeFileSync(
      transcriptPath,
      line({ type: 'user', timestamp: new Date(Date.parse(patchedStart) + 1000).toISOString(), message: { content: 'Krok w toku' } }),
      'utf8',
    );

    const { guide } = generateGuide({ sessionId: session.id, ostatnia: false });
    assert.equal(guide.status, 'niedokonczona');
    const md = readFileSync(guide.mdPath, 'utf8');
    assert.match(md, /\[NIEDOKOŃCZONE\]/);

    const logBefore = readLog(session.id).length;
    generateGuide({ sessionId: session.id, ostatnia: false, refresh: true });
    const logAfter = readLog(session.id).length;
    assert.equal(logBefore, logAfter, 'generuj nie dopisuje do logu (logSteps tylko przy stop)');
  });

  await t.test('EC-05: brak kandydatów na transkrypt -> twardy błąd, brak przewodnika', () => {
    process.env.TUTOR_TRANSCRIPTS_DIR = mkdtempSync(join(tmpdir(), 'tutor-tx-empty-'));
    const session = startSession('Sesja bez transkryptu', { cwd: process.cwd() });
    assert.throws(() => stopSession({ sessionId: session.id }), /brak transkryptu/);
  });

  await t.test('LIB-01: lista sesji akumuluje wszystkie utworzone sesje', () => {
    assert.ok(listSessions().length >= 3);
  });
});
