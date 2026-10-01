# HomeNexus (G-Home)

HomeNexus is a local smart-home energy dashboard for TP-Link Tapo P110 smart plugs. It polls your plugs every few minutes, stores the current power draw in SQLite, and shows the history as a chart. It runs on a Mac or Linux machine and is tuned for a Raspberry Pi with a 7" touch display.

## Features

- **Energy dashboard** with a line chart per device, key figures (current, average, peak, active devices) and quick ranges (24 h, 7 days, 30 days) or a custom date range
- **Device management in the UI**: add and rename plugs without touching the database
- **Light, dark and system theme**, switchable with the gear button in the top right corner and remembered per browser
- **Small-display layout**: compact landscape view for 800×480, 44 px touch targets, no heavy shadows or animations, and a chart limited to 240 points so long ranges stay smooth on a Pi
- **Automatic polling** every five minutes through a small poller container
- **Protected write endpoints** (polling and device changes need the API key), read-only history endpoint, credentials only from the environment
- **Docker Compose setup** with a persistent database volume and a health check

## Architecture

```text
┌──────────┐  POST /api/tapo (Bearer key)  ┌─────────────────────┐   Tapo API    ┌────────────┐
│  poller  │ ────────────────────────────▶ │  Next.js app        │ ────────────▶ │ Tapo P110  │
│ (Node)   │        every 5 minutes        │  (dashboard + API)  │  get_tapo.py  │ plugs (LAN)│
└──────────┘                               └──────────┬──────────┘               └────────────┘
                                                      │ database.py
                                                      ▼
                                              SQLite (db-data/)
```

The Next.js API routes call two small Python scripts: `scripts/get_tapo.py` reads a plug through the `tapo` library, and `scripts/database.py` reads and writes the SQLite file. Prisma is only used to define the schema and create the tables (`prisma db push`).

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4 (plus hand-written CSS with theme variables) and Recharts
- SQLite, schema managed with Prisma 7
- Python 3 with the `tapo` package
- Docker and Docker Compose, GitHub Actions for CI

## Quick start with Docker (recommended)

Requirements: Docker with Compose, and network access from the host to the plugs.

1. Create your environment file. Never commit `.env`:

   ```bash
   cp .env.example .env
   openssl rand -hex 32   # use the output as HOMENEXUS_API_KEY
   ```

   ```env
   TAPO_EMAIL="your-tapo-account@example.com"
   TAPO_PASSWORD="your-tapo-password"
   HOMENEXUS_API_KEY="long-random-value"
   DATABASE_URL="file:/app/db-data/homenexus.db"
   DATABASE_PATH="/app/db-data/homenexus.db"
   ```

2. Create the database tables once. The container does not create them itself. Run this on the host, with the path pointing to the mounted folder:

   ```bash
   npm install
   DATABASE_URL="file:./db-data/homenexus.db" npx prisma db push
   ```

3. Start everything:

   ```bash
   docker compose up -d --build
   ```

4. Open [http://localhost:3000](http://localhost:3000) (or the Pi's address in your LAN). Click the gear button and enter your `HOMENEXUS_API_KEY` under **API-Key**, then add your first plug with **+ Gerät hinzufügen**. The first reading appears after the next polling run.

The container runs as the unprivileged user `node` (uid 1000). The host folder `./db-data` must be writable for that user; on a Raspberry Pi the default user usually is uid 1000. If SQLite reports `readonly database`, run `sudo chown -R 1000:1000 db-data`.

### Update after code changes

```bash
git pull                        # on the Pi
docker compose up -d --build    # rebuilds the image and recreates both containers
docker compose ps               # homenexus should be "healthy"
docker compose logs -f poller   # watch the polling
```

The database lives in `./db-data`, outside the image, so a rebuild keeps all readings. Do not run `docker compose down -v` unless you want to lose them. Reload the browser with a hard refresh (Ctrl/Cmd+Shift+R) after an update.

## Local development

Requirements: Node.js 20+, npm, Python 3.9+.

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install --upgrade pip tapo
```

Use these values in `.env` for a local run (the paths in `.env.example` are for the container):

```env
DATABASE_URL="file:./prisma/dev.db"
DATABASE_PATH="./prisma/dev.db"
```

Then create the tables and start the dev server:

```bash
npx prisma db push
npm run dev
```

On macOS the Tapo password is read from the Keychain entry `Tplinkcloud` if `TAPO_PASSWORD` is not set. Inside Docker there is no Keychain, so `TAPO_PASSWORD` is required there.

Useful commands:

```bash
npm run lint       # ESLint
npm run build      # production build
npm run start      # serve the production build
npx prisma studio  # inspect devices and energy logs
```

## Dashboard usage

- **Time range**: pick 24 h, 7 days or 30 days, or set exact dates.
- **API key**: adding or editing a plug needs `HOMENEXUS_API_KEY`. Enter it once in the settings dialog (gear button); it is stored only in that browser.
- **Devices**: the "Meine Geräte" panel lists your plugs. Use **+ Gerät hinzufügen** to add one (name and IPv4 address) and **Bearbeiten** to rename it or change its IP.
- **Settings**: the gear button opens the appearance dialog with Hell, Dunkel and System.
- **Small screens**: on a 7" display the layout switches to a compact single-screen view automatically.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/tapo` | Bearer key | Polls all devices and stores one reading per device |
| `GET` | `/api/history?from=&to=` | none (LAN only) | Readings in ascending time order; `from` and `to` are optional ISO timestamps |
| `GET` | `/api/devices` | none (LAN only) | Lists all devices |
| `POST` | `/api/devices` | Bearer key | Adds a device: `{ "name", "ipAddress" }` |
| `PATCH` | `/api/devices` | Bearer key | Updates a device: `{ "id", "name", "ipAddress" }` |

Polling example:

```bash
curl -X POST -H "Authorization: Bearer $HOMENEXUS_API_KEY" http://localhost:3000/api/tapo
```

`/api/tapo` returns `401` without the correct key and must not be called with `GET`. The response contains one result per device, and a failing device does not stop the others. Device IPs must be valid IPv4 addresses and are unique.

## Automatic polling

With Docker Compose, the `poller` service calls `/api/tapo` every five minutes (`POLL_INTERVAL_MS`, default `300000`) and retries three times on failure. It uses the same `.env` and exposes no port.

Without Docker, use a scheduler on the same machine, for example cron:

```cron
*/5 * * * * . /etc/homenexus/homenexus.env && curl --fail --silent -X POST -H "Authorization: Bearer $HOMENEXUS_API_KEY" http://127.0.0.1:3000/api/tapo > /dev/null
```

## Data model

- `Device`: id, name, unique IP address, type (`tapo_p110`), creation time
- `EnergyLog`: id, power in watts, timestamp, link to a device

Deleting a device removes its readings. The database path comes from `DATABASE_PATH` (or `DATABASE_URL`) and defaults to `prisma/dev.db`; it can point to a USB drive on the Pi. There is no migration history, `prisma db push` is the intended setup command.

## Project layout

```text
app/page.tsx                 Dashboard UI (chart, devices, settings dialog)
app/layout.tsx               Root layout and theme bootstrap
app/globals.css              Styles, theme variables, small-display rules
app/lib/theme.ts             Theme state (light, dark, system)
app/lib/auth.ts              API key check
app/lib/database.ts          Database path resolution
app/api/tapo/route.ts        Polling endpoint
app/api/history/route.ts     History endpoint
app/api/devices/route.ts     Device management endpoint
scripts/get_tapo.py          Reads a Tapo P110
scripts/database.py          SQLite reads and writes
scripts/poll_tapo.mjs        Poller used by the poller container
prisma/schema.prisma         Device and EnergyLog models
docker-compose.yml           App and poller services
.github/workflows/ci.yml     Lint, audit and build on push and pull requests
```

## Security notes

- Never commit `.env`. It is git-ignored and excluded from the Docker image; only `.env.example` with placeholders belongs in the repository. Rotate the Tapo password and the API key immediately if they were ever exposed.
- Use a long random `HOMENEXUS_API_KEY` (`openssl rand -hex 32`). Anyone who knows it can add or change devices and trigger polling.
- `/api/tapo` needs the API key and uses `POST` because it writes data. The Tapo password reaches the Python script through its environment, never as a command-line argument.
- `POST` and `PATCH` on `/api/devices` need the API key, which the dashboard keeps in the browser's local storage. `GET /api/history` and `GET /api/devices` have no authentication and expose device names, local IPs and energy data. Keep the app inside your LAN.
- The API key is stored in plain text in the browser's local storage on each device where you enter it. Only enter it on devices you trust.
- The Docker container runs as the unprivileged user `node`, not as root.
- Do not forward port 3000 on your router. On the Pi, allow it only from the LAN with a firewall.
- For remote access use Tailscale or WireGuard. If a public domain is unavoidable, put a reverse proxy with HTTPS and authentication in front.

## Continuous integration

GitHub Actions runs `npm ci`, `npm run lint`, `npm audit --omit=dev --audit-level=high` and `npm run build` on every push and pull request to `main`. The audit covers production dependencies and fails the build on high-severity findings. The workflow only has read access to the repository and uses no secrets.

## Troubleshooting

- **Empty chart or no readings**: check that at least one device exists and read the poller logs with `docker compose logs poller`.
- **`Zugangsdaten fehlen`**: `TAPO_EMAIL` or `TAPO_PASSWORD` is missing in `.env`.
- **`401 Nicht autorisiert`**: the poller and the app must share the same `HOMENEXUS_API_KEY`; recreate both containers after changing `.env`.
- **`API-Key fehlt oder ist falsch`**: enter the same `HOMENEXUS_API_KEY` as in `.env` in the settings dialog (gear button) of the browser you use.
- **`readonly database` or the app cannot write**: `./db-data` must be writable for uid 1000, see the Docker quick start.
- **Dashboard shows old styles after an update**: hard-refresh the browser.
- **Plug not reachable**: give the plug a fixed IP in your router and make sure the host is in the same network.
