#!/usr/bin/env node
// AI-Tech-Tutor — CLI. `node src/cli.mjs` bez argumentów = pomoc.
import { startSession, stopSession, generateGuide, listSessions } from './sessions.mjs';
import { rebuildIndex } from './index.mjs';

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const k = t.slice(2);
      const v = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      a[k] = v;
    } else a._.push(t);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const out = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

const POMOC = `AI-Tech-Tutor — auto-dokumentacja sesji naprawczych Claude Code (v1, klient zero)

  start "<opis problemu>"                                        SES-01: rozpocznij sesję
  stop [--sesja <id>] [--transkrypt <ścieżka>]                    SES-03: zakończ -> wygeneruj przewodnik
  generuj --ostatnia [--sesja <id>] [--transkrypt <ścieżka>] [--refresh]   GEN-04: przewodnik częściowy/odświeżony
  lista [--json]                                                  LIB-01: lista sesji + przewodników`;

switch (cmd) {
  case 'start':
    out(startSession(args._[1]));
    break;
  case 'stop': {
    const { session, guide } = stopSession({ sessionId: args.sesja, transkrypt: args.transkrypt });
    out({ session: session.id, guide });
    break;
  }
  case 'generuj': {
    const { session, guide } = generateGuide({
      sessionId: args.sesja,
      ostatnia: Boolean(args.ostatnia),
      transkrypt: args.transkrypt,
      refresh: Boolean(args.refresh),
    });
    out({ session: session.id, guide });
    break;
  }
  case 'lista': {
    const sessions = listSessions();
    if (args.json) {
      out(sessions);
    } else {
      const { md } = rebuildIndex();
      out(md);
    }
    break;
  }
  default:
    out(POMOC);
}
