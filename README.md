# Tripatlas

[![CI](https://github.com/jsc2304/tripatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/jsc2304/tripatlas/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

**Self-hosted Fahrtenarchiv & Analytics für Tesla.** Datum wählen, jede Fahrt des Tages sehen, klassifizieren, exportieren — deine Bewegungsdaten bleiben auf deinem Server.

Tripatlas liest die Datenbank einer bestehenden [TeslaMate](https://github.com/teslamate-org/teslamate)-Installation (read-only) und macht daraus ein durchsuchbares Fahrten-, Park- und Ladearchiv mit Tagesansicht, Orten, Tags, Auto-Klassifizierung und Business-Exporten (CSV/PDF/GPX). Kein Abo, keine Cloud, kein Tracking.

> *English: Tripatlas is a self-hosted trip archive and analytics UI on top of your existing TeslaMate database — day timeline, trip classification (logbook-style), tagging, charging analytics, journeys, exports (CSV/PDF/GPX), auto-classification rules, per-place charging costs, insights, dark mode, German/English UI. Read-only against TeslaMate, your data stays on your server.*

## Warum?

Tessie & Co. sind gut, aber: Abo-Kosten, Feature-Überschneidung mit der Tesla-App und Bewegungsdaten bei einem Drittanbieter. TeslaMate loggt hervorragend, hat aber keinen Workflow zum **Wiederfinden und Nachweisen** einzelner Fahrten. Tripatlas ist die Produkt-Schicht darüber.

## Features

**Fahrtenarchiv (der Kern)**
- **Tagesansicht** — Datum wählen → jede Fahrt als atomarer Eintrag: `08:14–08:47 · Zuhause → Kunde Müller · 27,3 km · Geschäftlich`; Parken und Laden interleaved als Timeline
- **Klassifizieren & Annotieren** — privat / geschäftlich / Arbeitsweg per Segmented Control, Zweck, Kunde, Projekt, Notizen, Tags; jede Änderung im Audit-Log
- **Auto-Klassifizierungs-Regeln** — „Zuhause → Büro, Mo–Fr = Arbeitsweg": Regeln mit Orts- und Wochentags-Bedingungen klassifizieren neue Fahrten automatisch — und fassen nie an, was du manuell entschieden hast (Provenance im Audit-Log)
- **Bulk-Bearbeitung** — viele Fahrten auf einmal auswählen und klassifizieren/taggen, in Tagesansicht und Suche
- **Orte** — Geofences mit Karten-Picker und Adresssuche (OSM/Nominatim); manuelle Korrekturen mit Lock, die jeden Re-Sync überleben
- **Kalender, Suche, Reports** — Monatsgrid mit Fahrt-Intensität; Volltextsuche über Orte/Kunden/Projekte/Tags mit Filtern; Monatsreports mit CSV-/PDF-Export (Fahrtenbuch-Stil)

**Fahrt- & Lade-Analytics**
- **Fahrt-Detail** — Route auf der Karte, kombinierter Verlaufs-Chart (Höhe/SoC/Tempo), Temperaturen, Max-Speed/-Leistung/Rekuperation, historisches Wetter zur Fahrtzeit, GPX-Export
- **Ladeübersicht** — Ladekurve (kW über SoC), AC/DC, Kosten, Standort-Karte
- **Automatische Ladekosten** — Strompreis pro Ort hinterlegen (z. B. Zuhause 0,32 €/kWh) → Sessions ohne bekannten Preis werden automatisch berechnet, manuelle und gesyncte Kosten bleiben unangetastet
- **Journeys** — Urlaube/Reisen als Klammer über Fahrten + Ladestopps mit Kennzahlen-Dashboard, Karte aller Etappen und Export als CSV, PDF und GPX
- **Insights** — persönliche Verbrauchskurve: Verbrauch vs. Außentemperatur und Tempo, Saisonmuster, Kurzstrecken-Anteil
- **Standzeit-Analytics** — Vampir-Verlust pro Parkvorgang, Standzeiten pro Ort
- **Routenplaner (experimentell)** — Reichweiten-Check mit echter Route (OSRM), Höhenprofil und deinem persönlichen Verbrauchsprofil aus der eigenen Historie; alle Annahmen offengelegt

**Cockpit & Fahrzeug**
- **Start-Dashboard** — SoC + Reichweite, Standort, Status, Wetter, Reifendruck mit Warnung, letzte Fahrten als Karte + Liste
- **Software-Update-Historie** und Fahrzeugdaten in den Settings
- **Verbindungs-Diagnose** — Sync-Gesundheit pro Datenquelle auf einen Blick, optionaler TeslaMate-Direkttest

**Oberfläche**
- **Deutsch & Englisch** — umschaltbar im UI (Standard Deutsch)
- **Dark Mode** — Hell/Dunkel/System-Switcher, ohne Flackern
- **Mobile-first** — als PWA installierbar, 16px-Formularfelder (kein iOS-Zoom), Safe-Area-aware Bottom-Navigation

**Daten**
- **Datenhoheit** — eigene PostgreSQL-DB, quellen-agnostisches Schema (`source`/`source_id`), Annotationen überleben strukturell jeden Re-Sync
- **Tessie-Import** — rekonstruiert Fahrten/Ladungen aus einem Tessie-Rohdaten-Export (`import-tessie`-CLI), inkl. echter Energiewerte per Fahrzeug-Zähler
- **Energie ehrlich** — echte Zählerwerte wo verfügbar, sonst gekennzeichnete Schätzung; Effizienz-Fallback in den Settings, bis TeslaMate den Fahrzeugwert gelernt hat

## Demo ohne Auto

Kein Tesla, kein TeslaMate? Der Demo-Stack startet eine komplett gefüllte App mit sechs Wochen synthetischer Fahrdaten:

```bash
docker compose -f docker-compose.demo.yml up -d --build
# → http://localhost:3000, Login: demo1234
```

Details: [docs/demo.md](docs/demo.md)

## Stack

pnpm-Monorepo: Next.js 15 (`apps/web`) · Sync-Worker (`apps/worker`) · Drizzle-Schema (`packages/db`) · pure Domain-Logik (`packages/core`) · PostgreSQL 17 · Docker Compose.

## Entwicklung

Ohne echtes Auto — eine Fixture-TeslaMate-DB mit 6 Wochen synthetischer Fahrdaten liegt bei:

```bash
pnpm install
pnpm dev:db                                # tripatlas-db :5432 + fixture teslamate-db :5433
pnpm db:seed:teslamate                     # ~140 Fahrten, Laden, Geofences (Raum Zürich)
DATABASE_URL=postgres://tripatlas:tripatlas@localhost:5432/tripatlas pnpm db:migrate
pnpm --filter @tripatlas/worker dev        # Sync-Loop (braucht DATABASE_URL + TESLAMATE_DATABASE_URL, siehe .env.example)
pnpm --filter @tripatlas/web dev           # http://localhost:3000
```

Tests: `pnpm test` · Typecheck: `pnpm lint` · Mehr: [CONTRIBUTING.md](CONTRIBUTING.md)

## Deployment

Docker Compose auf Home Server/NAS/Raspberry Pi im LAN oder VPN (z. B. Tailscale), angebunden an die bestehende TeslaMate-Postgres über eine read-only-Rolle.

### Voraussetzungen

- Docker + Docker Compose (Plugin) auf dem Zielgerät (Raspberry Pi, NAS, Home Server)
- ≥ 4 GB RAM
- Eine laufende TeslaMate-Installation mit erreichbarer Postgres (LAN, VPN oder gleicher Docker-Host)

### 0. Noch kein TeslaMate? Mitinstallieren

Ein minimales TeslaMate-Compose (ohne Grafana) liegt unter [deploy/teslamate/](deploy/teslamate/docker-compose.yml) — Anleitung im Datei-Kopf. Danach auf `http://<host>:4000` das Tesla-Konto anmelden. Damit Tripatlas die TeslaMate-DB über den Compose-Service-Namen `database` erreicht, im Tripatlas-Verzeichnis eine `docker-compose.override.yml` anlegen:

```yaml
services:
  worker:
    networks: [default, teslamate]
networks:
  teslamate:
    external: true
    name: teslamate_default
```

### 1. Read-only-Rolle auf der TeslaMate-DB anlegen

Tripatlas liest die TeslaMate-DB nur — nie schreibend. Auf dem TeslaMate-Postgres ausführen:

```sql
CREATE ROLE tripatlas_ro WITH LOGIN PASSWORD 'ein-sicheres-passwort';
GRANT CONNECT ON DATABASE teslamate TO tripatlas_ro;
GRANT USAGE ON SCHEMA public TO tripatlas_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tripatlas_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tripatlas_ro;
```

### 2. `.env` einrichten

```bash
cp .env.example .env
```

Mindestens setzen:

- `POSTGRES_PASSWORD` — Passwort für die neue tripatlas-eigene Postgres (Pflicht, kein Default)
- `TESLAMATE_DATABASE_URL` — Connection-String der `tripatlas_ro`-Rolle gegen die TeslaMate-DB (LAN/Tailscale-Host oder Compose-Service-Name, siehe Kommentare in `docker-compose.yml`)
- optional `WEB_PORT` (Default `3000`), `APP_TIMEZONE`, `SYNC_INTERVAL_SECONDS`, `OSRM_URL` (eigener Routing-Server für den Planer)

### 3. Stack starten

```bash
docker compose up -d --build
```

Das baut `apps/web` und `apps/worker`, lässt den `migrate`-Service einmalig die Drizzle-Migrationen einspielen (`restart: "no"`, muss erfolgreich durchlaufen) und startet dann `db`, `web` und `worker` dauerhaft (`restart: unless-stopped`).

### 4. Erstanmeldung

Beim ersten Start wird ein Admin-Account bootstrapped. Optional vorab ein Passwort über `INITIAL_ADMIN_PASSWORD` in `.env` setzen — sonst wird beim ersten Login-Flow eines gesetzt (mit Passwort-Wiederholung).

### 5. HTTPS / Fernzugriff

Kein eigener Reverse Proxy im Compose-Stack. Empfehlung: [`tailscale serve`](https://tailscale.com/kb/1242/tailscale-serve) auf dem Zielgerät vor `${WEB_PORT}` schalten — TLS-Zertifikat und Zugriff nur im eigenen Tailnet, ohne offenen Port am Router.

### Update

```bash
git pull
docker compose up -d --build
```

Baut Images neu, spielt neue Migrationen über den `migrate`-Service ein, rollt `web`/`worker` neu aus.

### Backup

```bash
docker compose exec db pg_dump -U tripatlas tripatlas > backup-$(date +%F).sql
```

Die TeslaMate-Daten selbst sichert TeslaMate — Tripatlas sichert nur seine eigenen Annotationen, Places, Tags, Regeln und den Sync-State.

### Historie importieren (Tessie)

Wer vorher Tessie genutzt hat, kann den Rohdaten-Export (CSV-Zeitreihen) importieren — Tripatlas rekonstruiert daraus Fahrten, Park- und Ladesessions:

```bash
docker compose run --rm -v /pfad/zum/tessie-export:/import:ro worker \
  node dist/cli.js import-tessie /import
```

Idempotent (mehrfacher Lauf unschädlich), kollidiert nicht mit TeslaMate-Daten.

## Grenzen (ehrlich)

- **Braucht TeslaMate** als Datenquelle — Tripatlas spricht nicht selbst mit der Tesla-API und weckt dein Auto nie
- **Ein Fahrzeug** pro Instanz im Fokus (Multi-Vehicle auf der Roadmap)
- **Zahlenformatierung** aktuell durchgehend de-DE (Dezimalkomma), auch in der englischen UI
- **Routenplaner** ist ein experimenteller Reichweiten-Check — keine Ladestopp-Planung, Standard-Routing über den öffentlichen OSRM-Demo-Server
- **Kein steuerrechtliches Gutachten**: Exporte sind fahrtenbuch-artig mit Audit-Log, aber die Anerkennung beim Finanzamt ist einzelfallabhängig

## Roadmap

- Ladestopp-Planung im Routenplaner (Ladekurven + Ladepark-Daten)
- API/Webhooks für eigene Auswertungen
- Kalenderintegration (Termine ↔ Fahrten)
- Multi-Vehicle
- 2FA, Backup-Automation
- Weitere Import-Quellen (TeslaLogger, CSV)

## Mitmachen & Sicherheit

- Beiträge: [CONTRIBUTING.md](CONTRIBUTING.md) · Issues gerne auf Deutsch oder Englisch
- Sicherheitslücken bitte privat melden: [SECURITY.md](SECURITY.md)
- Änderungen: [CHANGELOG.md](CHANGELOG.md)

## Lizenz

[AGPL-3.0](LICENSE) © 2026 Jan Schultheiss
