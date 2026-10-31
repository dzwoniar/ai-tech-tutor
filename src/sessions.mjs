// SES-01/03/04, GEN-04 — cykl życia sesji (start/stop/generuj/lista).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { sessionsDir } from './paths.mjs';
import { resolveTranscript, extractSteps } from './transcript.mjs';
import { guideBaseName, guideMd, guideHtml, writeGuideImages } from './guide.mjs';
import { guidesDir } from './paths.mjs';
import { logEvent } from './log.mjs';
import { rebuildIndex } from './index.mjs';

function compactIso(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function newSessionId(startedAt) {
  return `${compactIso(startedAt)}-${randomBytes(3).toString('hex')}`;
}

function sessionPath(sessionId) {
  return join(sessionsDir(), `${sessionId}.json`);
}

function loadSession(sessionId) {
  const p = sessionPath(sessionId);
  if (!existsSync(p)) throw new Error(`Sesja nie istnieje: ${sessionId}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveSession(session) {
  mkdirSync(sessionsDir(), { recursive: true });
  writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf8');
  return session;
}

export function listSessions() {
  if (!existsSync(sessionsDir())) return [];
  return readdirSync(sessionsDir())
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(sessionsDir(), f), 'utf8')))
    .sort((a, b) => (a.id < b.id ? 1 : -1));
}

export function latestSession({ onlyOpen = false } = {}) {
  const all = listSessions();
  const filtered = onlyOpen ? all.filter((s) => s.status === 'otwarta') : all;
  return filtered[0] || null;
}

export function startSession(opis, { cwd = process.cwd() } = {}) {
  const open = latestSession({ onlyOpen: true });
  if (open) {
    process.stderr.write(`Uwaga: poprzednia sesja ${open.id} jest wciąż otwarta (EC-03) — kontynuuję mimo to.\n`);
  }
  const startedAt = new Date().toISOString();
  const session = {
    id: newSessionId(startedAt),
    opis: String(opis),
    cwdAtStart: cwd,
    startedAt,
    stoppedAt: null,
    status: 'otwarta',
    guide: null,
  };
  saveSession(session);
  logEvent(session.id, 'start', { opis: session.opis });
  return session;
}

function buildGuide(session, { transkrypt = null, logSteps = false } = {}) {
  const { path: transcriptPath, ambiguous } = resolveTranscript(session, { override: transkrypt });
  const fromMs = Date.parse(session.startedAt) - 5000;
  const toMs = session.stoppedAt ? Date.parse(session.stoppedAt) + 5000 : Date.now();
  const extraction = extractSteps(transcriptPath, { fromMs, toMs });
  extraction.transcriptPath = transcriptPath;

  const baseName = guideBaseName(session);
  writeGuideImages(baseName, extraction.steps);

  mkdirSync(guidesDir(), { recursive: true });
  const mdPath = join(guidesDir(), `${baseName}.md`);
  const htmlPath = join(guidesDir(), `${baseName}.html`);
  writeFileSync(mdPath, guideMd(session, extraction), 'utf8');
  writeFileSync(htmlPath, guideHtml(session, extraction), 'utf8');

  if (logSteps) {
    for (const [i, step] of extraction.steps.entries()) {
      logEvent(session.id, 'krok', { opis: `Krok ${i + 1} (${step.role})`, meta: { timestamp: step.timestamp } });
    }
  }

  if (ambiguous.length > 1) {
    process.stderr.write(
      `Uwaga: ${ambiguous.length} kandydatów na transkrypt, wybrano najnowszy: ${transcriptPath}\n` +
      ambiguous.map((c) => `  - ${c.path} (mtime ${new Date(c.mtimeMs).toISOString()})`).join('\n') + '\n',
    );
  }

  return {
    status: session.status === 'zakonczona' ? 'zakonczona' : 'niedokonczona',
    mdPath,
    htmlPath,
    krokow: extraction.steps.length,
    zrzutow: extraction.steps.reduce((a, s) => a + s.imageFiles.length, 0),
  };
}

export function stopSession({ sessionId, transkrypt = null } = {}) {
  const session = sessionId ? loadSession(sessionId) : latestSession({ onlyOpen: true });
  if (!session) throw new Error('Brak otwartej sesji do zatrzymania.');
  if (session.status === 'zakonczona') throw new Error(`Sesja ${session.id} jest już zakończona.`);

  session.stoppedAt = new Date().toISOString();
  session.status = 'zakonczona';
  const guide = buildGuide(session, { transkrypt, logSteps: true });
  session.guide = guide;
  saveSession(session);
  logEvent(session.id, 'stop', { meta: { krokow: guide.krokow, zrzutow: guide.zrzutow } });
  rebuildIndex();
  return { session, guide };
}

export function generateGuide({ sessionId, ostatnia = false, transkrypt = null, refresh = false } = {}) {
  const session = sessionId ? loadSession(sessionId) : ostatnia ? latestSession({}) : null;
  if (!session) throw new Error('Podaj --sesja <id> albo --ostatnia.');
  if (session.guide && !refresh && session.status === 'zakonczona') {
    return { session, guide: session.guide };
  }
  const guide = buildGuide(session, { transkrypt, logSteps: false });
  session.guide = guide;
  saveSession(session);
  rebuildIndex();
  return { session, guide };
}
