import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import crypto from 'crypto';
import util from 'util';
import net from 'net';
import { hasValidApiKey } from '@/app/lib/auth';
import { getDatabasePath } from '@/app/lib/database';

export const runtime = 'nodejs';
const execFilePromise = util.promisify(execFile);

export async function GET() {
  try {
    const { stdout } = await execFilePromise('.venv/bin/python', [
      'scripts/database.py', getDatabasePath(), 'devices',
    ]);
    return NextResponse.json({ success: true, devices: JSON.parse(stdout) });
  } catch (error) {
    console.error('Geräte konnten nicht geladen werden:', error);
    return NextResponse.json({ success: false, error: 'Geräte konnten nicht geladen werden' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasValidApiKey(request)) {
    return NextResponse.json({ success: false, error: 'API-Key fehlt oder ist falsch. Bitte in den Einstellungen eintragen.' }, { status: 401 });
  }

  try {
    const body = await request.json() as { name?: string; ipAddress?: string };
    const name = body.name?.trim();
    const ipAddress = body.ipAddress?.trim();

    if (!name || name.length > 80 || !ipAddress || net.isIP(ipAddress) !== 4) {
      return NextResponse.json({ success: false, error: 'Name und gültige IPv4-Adresse erforderlich' }, { status: 400 });
    }

    const { stdout } = await execFilePromise('.venv/bin/python', [
      'scripts/database.py',
      getDatabasePath(),
      'create-device',
      crypto.randomUUID(),
      name,
      ipAddress,
    ]);

    JSON.parse(stdout);
    return NextResponse.json({ success: true, device: { name, ipAddress, type: 'tapo_p110' } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ success: false, error: 'Diese IP-Adresse ist bereits eingetragen' }, { status: 409 });
    }
    console.error('Gerät konnte nicht angelegt werden:', message);
    return NextResponse.json({ success: false, error: 'Gerät konnte nicht angelegt werden' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!hasValidApiKey(request)) {
    return NextResponse.json({ success: false, error: 'API-Key fehlt oder ist falsch. Bitte in den Einstellungen eintragen.' }, { status: 401 });
  }

  try {
    const body = await request.json() as { id?: string; name?: string; ipAddress?: string };
    const id = body.id?.trim();
    const name = body.name?.trim();
    const ipAddress = body.ipAddress?.trim();

    if (!id || !name || name.length > 80 || !ipAddress || net.isIP(ipAddress) !== 4) {
      return NextResponse.json({ success: false, error: 'ID, Name und gültige IPv4-Adresse erforderlich' }, { status: 400 });
    }

    const { stdout } = await execFilePromise('.venv/bin/python', [
      'scripts/database.py', getDatabasePath(), 'update-device', name, ipAddress, id,
    ]);
    JSON.parse(stdout);
    return NextResponse.json({ success: true, device: { id, name, ipAddress, type: 'tapo_p110' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ success: false, error: 'Diese IP-Adresse ist bereits eingetragen' }, { status: 409 });
    }
    console.error('Gerät konnte nicht aktualisiert werden:', message);
    return NextResponse.json({ success: false, error: 'Gerät konnte nicht aktualisiert werden' }, { status: 500 });
  }
}
