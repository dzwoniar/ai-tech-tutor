// SES-02 — log zdarzeń sesji. Append-only przez konwencję (brak update/delete),
// nie przez triggery SQL jak w Mostku — patrz docs/DECYZJE.md#2.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logDir } from './paths.mjs';

function logPath(sessionId) {
  return join(logDir(), `${sessionId}.jsonl`);
}

export function logEvent(sessionId, typ, { opis = null, uzasadnienie = null, zrzutRef = null, meta = null } = {}) {
  mkdirSync(logDir(), { recursive: true });
  const entry = { sessionId, typ, ts: new Date().toISOString(), opis, uzasadnienie, zrzutRef, meta };
  appendFileSync(logPath(sessionId), JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

export function readLog(sessionId) {
  const p = logPath(sessionId);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
