// GEN-01/02/03 — render przewodnika (MD+HTML) + zapis zrzutów jako realne PNG
// (nie inline base64 — NFR-05, portability do Loom/Notion). Jedyne świadome
// odejście od wzorca dossier.mjs z Mostka: realne <img>, nie <pre> z całym MD.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { guidesDir } from './paths.mjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function guideSlug(opis) {
  const base = String(opis).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, 60).replace(/-+$/g, '') || 'sesja';
}

export function guideBaseName(session) {
  return `${session.startedAt.slice(0, 10)}-${guideSlug(session.opis)}`;
}

export function writeGuideImages(baseName, steps) {
  let n = 0;
  let dirMade = false;
  const dir = join(guidesDir(), baseName);
  for (const step of steps) {
    step.imageFiles = [];
    for (const img of step.images) {
      if (!dirMade) {
        mkdirSync(dir, { recursive: true });
        dirMade = true;
      }
      n += 1;
      const name = `krok-${String(n).padStart(2, '0')}.png`;
      writeFileSync(join(dir, name), Buffer.from(img, 'base64'));
      step.imageFiles.push(`${baseName}/${name}`);
    }
  }
  return steps;
}

function tytul(session) {
  if (session.status === 'zakonczona') return session.opis;
  return `[NIEDOKOŃCZONE] ${session.opis}`;
}

export function guideMd(session, extraction) {
  const { steps, meta } = extraction;
  const zakres = session.stoppedAt ? `${session.startedAt}–${session.stoppedAt}` : `${session.startedAt}–w toku`;
  const L = [];
  L.push(`# ${steps.length === 0 && session.status !== 'zakonczona' ? tytul(session) + ' — brak wykrytych kroków' : tytul(session)}`);
  L.push('');
  L.push(`Wygenerowano: ${new Date().toISOString()} · Sesja: ${session.id} · Status: ${session.status} · Czas: ${zakres}`);
  L.push('');
  L.push('## Kroki');
  steps.forEach((step, i) => {
    const rola = step.role === 'assistant' ? 'asystent' : 'Kuba/Janek';
    L.push('');
    L.push(`### Krok ${i + 1} — ${step.timestamp} (${rola})`);
    if (step.text) {
      L.push('');
      L.push(step.text);
    }
    for (const img of step.imageFiles) {
      L.push('');
      L.push(`![zrzut](${img})`);
    }
  });
  L.push('');
  L.push('## Meta');
  const zrzutow = steps.reduce((a, s) => a + s.imageFiles.length, 0);
  L.push(`- Kroków: ${steps.length} · Zrzutów: ${zrzutow}`);
  const pominiete = Object.entries(meta.skippedBlockTypes).map(([k, v]) => `${k}=${v}`).join(', ') || 'brak';
  L.push(`- Pominięte bloki (tool_use/tool_result/thinking/inne): ${pominiete}`);
  if (meta.skippedSidechain) L.push(`- Pominięte linie subagentów (isSidechain): ${meta.skippedSidechain}`);
  if (meta.malformedLines) L.push(`- Uszkodzone linie transkryptu (pominięte): ${meta.malformedLines}`);
  L.push(`- Plik transkryptu źródłowy: ${extraction.transcriptPath}`);
  L.push('');
  return L.join('\n');
}

export function guideHtml(session, extraction) {
  const { steps } = extraction;
  const body = steps.map((step, i) => {
    const rola = step.role === 'assistant' ? 'asystent' : 'Kuba/Janek';
    const imgs = step.imageFiles.map((f) => `<img src="${esc(f)}" alt="zrzut krok ${i + 1}">`).join('\n');
    return `<section><h3>Krok ${i + 1} — ${esc(step.timestamp)} (${rola})</h3><p>${esc(step.text)}</p>${imgs}</section>`;
  }).join('\n');
  const t = tytul(session);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>${esc(t)}</title>
<style>
body{font-family:ui-monospace,Consolas,monospace;max-width:900px;margin:2rem auto;
padding:0 1rem;background:#0b1020;color:#dbe4ff;font-size:14px;line-height:1.5}
img{max-width:100%;border:1px solid #2a355c;border-radius:4px;margin:.5rem 0}
section{margin:1.5rem 0;padding-bottom:1rem;border-bottom:1px solid #1c2340}
h1,h3{color:#fff}
</style></head><body>
<h1>${esc(t)}</h1>
<p>Sesja: ${esc(session.id)} · Status: ${esc(session.status)}</p>
${body}
</body></html>
`;
}
