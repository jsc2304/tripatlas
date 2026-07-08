# Demo

Tripatlas ausprobieren ohne echtes Auto oder eine echte TeslaMate-Installation
— mit ~6 Wochen synthetischer Fahrdaten (Raum Zürich, siehe
[`dev/fixtures/seed.ts`](../dev/fixtures/seed.ts)).

## Starten

```bash
docker compose -f docker-compose.demo.yml up --build
```

Baut `web` und `worker` lokal, startet eine eigene `tripatlas-db` und eine
Fake-`teslamate-db` (nur Schema, keine echte TeslaMate-App dahinter), seedet
sie einmalig mit Beispieldaten und lässt den Sync-Worker (15s-Takt statt der
üblichen 60s) alles in die Tripatlas-DB übernehmen. Nach 1–2 Minuten sind die
ersten Fahrten sichtbar, nach ein paar weiteren Zyklen die komplette Fixture
(Ladevorgänge, Parkvorgänge, Fahrzeugstatus).

## Login

<http://localhost:3000> — Passwort **`demo1234`**.

## Alle Werte hier sind Demo-only

`docker-compose.demo.yml` verdrahtet Passwörter fest im Klartext
(`tripatlas-demo`, `teslamate-demo`, `demo1234`). Für eine echte Installation
immer `docker-compose.yml` + `.env` verwenden (siehe README „Deployment"),
niemals diese Datei — sie ist ausschließlich zum Ausprobieren gedacht und
läuft komplett isoliert (eigene Volumes, eigene Image-Tags `:demo`).

## Abbau

```bash
docker compose -f docker-compose.demo.yml down -v
```

`-v` löscht auch die beiden Demo-Datenbank-Volumes — danach ist alles weg,
ein erneutes `up --build` startet wieder bei null.

## Seed-Ansatz (Hinweis für Maintainer)

Der `seed`-Service baut ein eigenes, schlankes Image
([`dev/fixtures/Dockerfile`](../dev/fixtures/Dockerfile)), das
`dev/fixtures/seed.ts` unabhängig vom pnpm-Workspace per `npm install`
ausführt — `seed.ts` hat keine Workspace-internen Abhängigkeiten (nur das
`postgres`-npm-Paket), das hält den Container einfach und robust gegenüber
Lockfile-/Workspace-Eigenheiten.

Falls dieser Ansatz doch mal bricht: Fallback ist manuelles Seeden gegen die
laufende Fixture-DB, z. B. mit einem temporär veröffentlichten Port:

```bash
# In docker-compose.demo.yml bei teslamate-db kurz ergänzen:
#   ports: ["5433:5432"]
docker compose -f docker-compose.demo.yml up -d teslamate-db
TESLAMATE_DATABASE_URL=postgres://teslamate:teslamate-demo@localhost:5433/teslamate \
  pnpm --filter @tripatlas/fixtures seed
```
