# AI Tech Tutor

Lokalne CLI do dokumentowania sesji pomocy technicznej. Rejestruje początek i koniec sesji, odczytuje transkrypt JSONL i buduje instrukcję krok po kroku w Markdown oraz HTML, z odwołaniami do zrzutów ekranu.

**To parser i generator dokumentacji.** Nie steruje komputerem, nie wykonuje napraw i nie wywołuje API modelu. Przykłady i testy są syntetyczne; transkrypty oraz wygenerowane przewodniki pozostają lokalnie w ignorowanym `data/`.

## Uruchomienie

Wymagany Node.js 24+. Brak zależności do instalacji.

```sh
npm test
node src/cli.mjs
node src/cli.mjs start "Przykładowy problem techniczny"
node src/cli.mjs stop --transkrypt /pełna/ścieżka/do/syntetycznego.jsonl
node src/cli.mjs lista
```

`generuj --ostatnia` tworzy częściowy przewodnik; `stop` zamyka sesję. Bez jawnej ścieżki parser szuka transkryptów zwykłych lokalnych sesji Claude Code. Do demonstracji użyj wyłącznie własnego syntetycznego transkryptu. `npm test` sprawdza cykl sesji, generowanie i odporność parsera na niepoprawną strukturę JSON w izolowanym katalogu tymczasowym, bez usług zewnętrznych.

## Mapa kodu

| Plik | Rola |
| --- | --- |
| [src/cli.mjs](src/cli.mjs) | Polecenia CLI |
| [src/sessions.mjs](src/sessions.mjs) | Cykl życia sesji i generowanie |
| [src/transcript.mjs](src/transcript.mjs) | Wybór i parsowanie transkryptu |
| [src/guide.mjs](src/guide.mjs) | Kroki, Markdown i HTML |
| [src/log.mjs](src/log.mjs) | Lokalny log JSONL |
| [src/index.mjs](src/index.mjs) | Indeks przewodników |
| [test/smoke.test.mjs](test/smoke.test.mjs) | Testy pełnego lokalnego cyklu |

## Granice prywatności

Narzędzie nie ma automatycznej redakcji haseł ani analizy wrażliwej zawartości obrazów. Transkrypt i screeny mogą zawierać dane klientów, sesje logowania lub tokeny. Wymagają ręcznej kontroli przed wygenerowaniem i udostępnieniem instrukcji. Nie commituj `data/`, transkryptów ani zrzutów. Generator nie daje gwarancji, że dokument został automatycznie oczyszczony z sekretów.

To jednoosobowy prototyp bez backendu, logowania, synchronizacji ani pracy wielu operatorów. CI uruchamia lokalne testy i niczego nie wysyła do usług AI.
