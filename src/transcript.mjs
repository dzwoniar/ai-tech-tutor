// Lokalizacja i parsowanie transkryptów Claude Code (SES-04/EC-01/EC-03/EC-05).
// Format transkryptu jest niepubliczny. Allowlist, nie denylist: nieznane typy
// linii/bloków są pomijane i zliczane w meta, nie wywalają parsera.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function projectSlug(cwd) {
  return cwd.replace(/[:\\/]/g, '-');
}

export function candidateTranscriptDirs(cwd = process.cwd()) {
  if (process.env.TUTOR_TRANSCRIPTS_DIR) return [process.env.TUTOR_TRANSCRIPTS_DIR];
  const slug = projectSlug(cwd);
  return [
    join(homedir(), '.claude-vscode-private', 'projects', slug),
    join(homedir(), '.claude', 'projects', slug),
  ];
}

export function findCandidateTranscripts({ cwd = process.cwd(), sinceMs, graceMs = 5000 } = {}) {
  const out = [];
  for (const dir of candidateTranscriptDirs(cwd)) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      const path = join(dir, f);
      const mtimeMs = statSync(path).mtimeMs;
      if (sinceMs !== undefined && mtimeMs < sinceMs - graceMs) continue;
      out.push({ path, mtimeMs });
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

export function resolveTranscript(session, { override = null } = {}) {
  if (override) {
    if (!existsSync(override)) throw new Error(`resolveTranscript: transkrypt nie istnieje: ${override}`);
    return { path: override, ambiguous: [] };
  }
  const candidates = findCandidateTranscripts({ cwd: session.cwdAtStart, sinceMs: Date.parse(session.startedAt) });
  if (candidates.length === 0) {
    throw new Error(
      `resolveTranscript: brak transkryptu dla sesji ${session.id} (EC-05) — sprawdzone katalogi: ${candidateTranscriptDirs(session.cwdAtStart).join(', ')}`,
    );
  }
  return { path: candidates[0].path, ambiguous: candidates.length > 1 ? candidates : [] };
}

export function extractSteps(path, { fromMs, toMs }) {
  const raw = readFileSync(path, 'utf8');
  const steps = [];
  const meta = { totalLines: 0, usedLines: 0, skippedSidechain: 0, skippedBlockTypes: Object.create(null), malformedLines: 0 };
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    meta.totalLines += 1;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      meta.malformedLines += 1;
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      meta.malformedLines += 1;
      continue;
    }
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    if (entry.isSidechain === true) {
      meta.skippedSidechain += 1;
      continue;
    }
    const ts = Date.parse(entry.timestamp);
    if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) continue;
    const rawContent = entry.message?.content;
    const blocks = typeof rawContent === 'string'
      ? [{ type: 'text', text: rawContent }]
      : Array.isArray(rawContent) ? rawContent : [];
    const step = { role: entry.type, timestamp: entry.timestamp, text: '', images: [] };
    for (const block of blocks) {
      const type = block && typeof block.type === 'string' ? block.type : 'invalid';
      if (type === 'text' && typeof block.text === 'string') {
        step.text += (step.text ? '\n' : '') + block.text;
      } else if (type === 'image' && block.source?.type === 'base64' && typeof block.source.data === 'string') {
        step.images.push(block.source.data);
      } else {
        meta.skippedBlockTypes[type] = (meta.skippedBlockTypes[type] || 0) + 1;
      }
    }
    if (!step.text && step.images.length === 0) continue;
    steps.push(step);
    meta.usedLines += 1;
  }
  return { steps, meta };
}
