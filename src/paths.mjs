// AI-Tech-Tutor — ścieżki danych. Zero zależności, tylko node:*.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function dataDir() {
  return process.env.TUTOR_DATA_DIR || join(HERE, '..', 'data');
}
export function sessionsDir() {
  return join(dataDir(), 'sessions');
}
export function logDir() {
  return join(dataDir(), 'log');
}
export function guidesDir() {
  return join(dataDir(), 'przewodniki');
}
