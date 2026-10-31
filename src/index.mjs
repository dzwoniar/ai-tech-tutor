// LIB-01 — indeks wygenerowanych przewodników (JSON + tabela MD).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { guidesDir, sessionsDir } from './paths.mjs';

const baseName = (p) => p.split(/[\\/]/).pop();

export function rebuildIndex() {
  const entries = existsSync(sessionsDir())
    ? readdirSync(sessionsDir())
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(sessionsDir(), f), 'utf8')))
      .filter((s) => s.guide)
      .map((s) => ({
        sessionId: s.id,
        data: s.startedAt.slice(0, 10),
        tytul: s.opis,
        status: s.guide.status,
        mdPath: s.guide.mdPath,
        htmlPath: s.guide.htmlPath,
      }))
      .sort((a, b) => (a.sessionId < b.sessionId ? 1 : -1))
    : [];
  mkdirSync(guidesDir(), { recursive: true });
  writeFileSync(join(guidesDir(), 'index.json'), JSON.stringify(entries, null, 2), 'utf8');
  const md = [
    '# Indeks przewodników',
    '',
    '| Data | Tytuł | Status | MD | HTML |',
    '|---|---|---|---|---|',
    ...entries.map((e) => `| ${e.data} | ${e.tytul} | ${e.status} | [md](${baseName(e.mdPath)}) | [html](${baseName(e.htmlPath)}) |`),
    '',
  ].join('\n');
  writeFileSync(join(guidesDir(), 'index.md'), md, 'utf8');
  return { json: entries, md, entries };
}
