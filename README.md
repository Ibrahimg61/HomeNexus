# HomeNexus

HomeNexus is a local smart-home energy dashboard for TP-Link Tapo P110 plugs. It polls the configured plugs, stores their current power draw in SQLite, and displays the collected readings as a time-series chart.

## Features

- Next.js dashboard with a Recharts line chart
- Tapo P110 polling through the Python `tapo` library
- SQLite persistence through Prisma's schema and `better-sqlite3`
- Historical readings grouped by device name and timestamp
- JSON endpoints for polling devices and reading history

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

3. Create `.env` in the project root. Do not commit it:

   ```env
   TAPO_EMAIL="your-tapo-account@example.com"
   TAPO_PASSWORD="your-tapo-password"
   DATABASE_URL="file:./prisma/dev.db"
   ```

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

### `GET /api/tapo`

Polls every `Device` with type `tapo_p110`, reads its current power usage, and inserts an `EnergyLog` row for successful readings.

```bash
curl http://localhost:3000/api/tapo
```

The response includes one result per device. A device failure is reported in that device's result while the other devices continue to be processed.

### `GET /api/history`

Returns all energy logs in ascending timestamp order, joined with the device name.

```bash
curl http://localhost:3000/api/history
```

The dashboard converts the returned `powerW`, `timestamp`, and `deviceName` fields into chart series.

## Automatic polling

The application does not run a background worker. Use an external scheduler to call `/api/tapo`, for example a five-minute cron entry on the same machine as the development or production server:

```cron
*/5 * * * * curl --fail --silent http://localhost:3000/api/tapo > /dev/null
```

Adjust the URL and interval for the environment where HomeNexus is running.

## Data model

`Device` stores the plug name, IP address, type, and creation time. `EnergyLog` stores a wattage reading and timestamp linked to a device. Deleting a device cascades to its energy logs.

The database file is `prisma/dev.db` and is ignored by Git. This project currently has no checked-in Prisma migration history; `prisma db push` is the intended local setup command.

## Project layout

```text
app/page.tsx              Dashboard UI
app/api/history/route.ts  Historical readings API
app/api/tapo/route.ts     Tapo polling API
prisma/schema.prisma      Device and EnergyLog models
scripts/get_tapo.py       Python Tapo P110 reader
```

## Security notes

- Keep `.env` private and rotate credentials if they have been exposed.
- `/api/tapo` has no authentication and should not be exposed directly to the public internet.
- The polling endpoint executes the local Python script, so run the app only in a trusted environment.

## Deployment

HomeNexus currently assumes a local SQLite file and access to the Tapo devices from the application host. For deployment, ensure the host has Python, the `.venv` dependencies, the environment variables, persistent storage for `prisma/dev.db`, and network access to the plugs. Build and start with:

```bash
npm run build
npm run start
```
