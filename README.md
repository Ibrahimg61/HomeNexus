# HomeNexus

HomeNexus is a local smart-home energy dashboard for TP-Link Tapo P110 plugs. It polls the configured plugs, stores their current power draw in SQLite, and displays the collected readings as a time-series chart.

## Features

- Next.js dashboard with a Recharts line chart
- Tapo P110 polling through the Python `tapo` library
- SQLite persistence through Prisma's schema and `better-sqlite3`
- Historical readings grouped by device name and timestamp
- Protected JSON endpoint for polling devices
- Date-filtered history endpoint for the dashboard

## Stack

- Next.js 16 and React 19
- TypeScript
- Prisma 7 with SQLite
- `better-sqlite3`
- Python 3 with the `tapo` package
- Tailwind CSS 4 and Recharts

## Prerequisites

- Node.js 20 or newer
- npm
- Python 3.9 or newer
- Network access to the Tapo P110 devices
- Tapo account credentials that can access those devices

## Setup

1. Install the Node dependencies:

   ```bash
   npm install
   ```

2. Create a Python virtual environment and install the Tapo client:

   ```bash
   python3 -m venv .venv
   .venv/bin/python -m pip install --upgrade pip
   .venv/bin/pip install tapo
   ```

3. Create `.env` in the project root. Do not commit it. Generate a long random API key, for example with `openssl rand -hex 32`:

   ```env
   TAPO_EMAIL="your-tapo-account@example.com"
   DATABASE_URL="file:./prisma/dev.db"
   HOMENEXUS_API_KEY="replace-with-a-long-random-value"
   ```

   On macOS, the Tapo password is read from the Keychain entry `Tplinkcloud`. On Linux/Raspberry Pi, add `TAPO_PASSWORD` to a protected systemd environment file instead of committing it.

4. Create the local SQLite database from the Prisma schema and generate the client:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. Add at least one device. The simplest option is Prisma Studio:

   ```bash
   npx prisma studio
   ```

   Create a `Device` record with:

   - `name`: the label shown in the dashboard, for example `Tapo-Raspberry`
   - `ipAddress`: the plug's local IP address
   - `type`: `tapo_p110` (the default)

## Run locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard loads its chart data from `/api/history`.

Useful commands:

```bash
npm run lint       # Run ESLint
npm run build      # Create a production build
npm run start      # Serve the production build
npx prisma studio  # Inspect devices and energy logs
```

## API

### `POST /api/tapo`

Polls every `Device` with type `tapo_p110`, reads its current power usage, and inserts an `EnergyLog` row for successful readings.

```bash
curl -X POST \
   -H "Authorization: Bearer $HOMENEXUS_API_KEY" \
   http://localhost:3000/api/tapo
```

The endpoint returns `401 Unauthorized` without the configured `HOMENEXUS_API_KEY`. It must not be called with `GET`.

The response includes one result per device. A device failure is reported in that device's result while the other devices continue to be processed.

### `GET /api/history`

Returns energy logs in ascending timestamp order, joined with the device name. The dashboard passes optional ISO timestamps through `from` and `to` query parameters.

```bash
curl http://localhost:3000/api/history
```

The dashboard converts the returned `powerW`, `timestamp`, and `deviceName` fields into chart series.

## Automatic polling

The application does not run a background worker. Use an external scheduler to call `/api/tapo`, for example a five-minute cron entry on the same machine as the development or production server:

```cron
*/5 * * * * . /etc/homenexus/homenexus.env && curl --fail --silent -X POST -H "Authorization: Bearer $HOMENEXUS_API_KEY" http://127.0.0.1:3000/api/tapo > /dev/null
```

Adjust the URL and interval for the environment where HomeNexus is running.

## Data model

`Device` stores the plug name, IP address, type, and creation time. `EnergyLog` stores a wattage reading and timestamp linked to a device. Deleting a device cascades to its energy logs.

The database file defaults to `prisma/dev.db` and is ignored by Git. Set `DATABASE_PATH` to place it on a USB drive, for example `/media/usb/home-nexus/dev.db`. This project currently has no checked-in Prisma migration history; `prisma db push` is the intended local setup command.

## Project layout

```text
app/page.tsx              Dashboard UI
app/api/history/route.ts  Historical readings API
app/api/tapo/route.ts     Tapo polling API
prisma/schema.prisma      Device and EnergyLog models
scripts/get_tapo.py       Python Tapo P110 reader
```

## Security notes

- Keep `.env` and the systemd environment file private; rotate credentials if they have been exposed.
- `/api/tapo` requires `Authorization: Bearer $HOMENEXUS_API_KEY` and uses `POST` because it writes to the database.
- The Tapo password is never embedded in a shell command or process argument. It is passed to the Python script through its process environment.
- Do not create a router port forwarding rule for port `3000`. On the Pi, allow port `3000` only from the LAN with a firewall.
- For future remote access, use Tailscale or WireGuard instead of exposing Next.js directly to the internet. If a public domain is required, put a reverse proxy with HTTPS and authentication in front of the app.
- `/api/history` is read-only but exposes device names, local IP addresses and energy data. Keep it behind the LAN/VPN; add authentication at the reverse proxy before enabling public access.

## Deployment

HomeNexus assumes a local SQLite file and access to the Tapo devices from the application host. For deployment, ensure the host has Python, the `.venv` dependencies, a protected environment file, persistent storage for the database, and network access to the plugs. Build and start with:

```bash
npm run build
npm run start
```

To make the app reachable from other devices in the home network, bind Next.js to the LAN interface, for example `npm run start -- --hostname 0.0.0.0`, and restrict access with the Pi firewall. Do not use this as a substitute for authentication.
