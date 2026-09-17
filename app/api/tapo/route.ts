import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { hasValidApiKey } from '@/app/lib/auth';

export const runtime = 'nodejs';
const execFilePromise = util.promisify(execFile);

async function getTapoPasswordFromKeychain() {
  if (process.env.TAPO_PASSWORD) {
    return process.env.TAPO_PASSWORD;
  }

  try {
    const { stdout } = await execFilePromise('security', ['find-generic-password', '-s', 'Tplinkcloud', '-w']);
    return stdout.trim(); // Entfernt eventuelle Zeilenumbrüche am Ende
  } catch (error) {
    console.error("Fehler beim Lesen aus dem Schlüsselbund:", error);
    return null;
  }
}

export async function POST(request: Request) {
  if (!hasValidApiKey(request)) {
    return NextResponse.json({ success: false, error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const tapoEmail = process.env.TAPO_EMAIL;

    const tapoPassword = await getTapoPasswordFromKeychain();

    if (!tapoEmail || !tapoPassword) {
      return NextResponse.json({ success: false, error: "Zugangsdaten fehlen oder Schlüsselbund blockiert" }, { status: 400 });
    }

    // Ab hier bleibt dein bisheriger Code exakt gleich!
    const db = new Database(process.env.DATABASE_PATH ?? './prisma/dev.db');
    const devices = db.prepare("SELECT id, name, ipAddress FROM Device WHERE type = 'tapo_p110'").all() as { id: string; name: string; ipAddress: string }[];
    if (devices.length === 0) {
      db.close();
      return NextResponse.json({ success: false, message: "Keine Tapo-Geräte in der Datenbank gefunden." });
    }

    const results = [];

    for (const device of devices) {
      try {
        const { stdout } = await execFilePromise(
          '.venv/bin/python',
          ['scripts/get_tapo.py', device.ipAddress, tapoEmail],
          {
            env: { ...process.env, TAPO_PASSWORD: tapoPassword },
            maxBuffer: 1024 * 1024
          }
        );

        const result = JSON.parse(stdout) as { success: boolean; power_watts?: number; error?: string };

        if (!result.success) {
          throw new Error(result.error ?? 'Tapo-Abfrage fehlgeschlagen');
        }

        const insertStmt = db.prepare(`
          INSERT INTO EnergyLog (id, deviceId, powerW, timestamp)
          VALUES (?, ?, ?, ?)
        `);
        
        insertStmt.run(crypto.randomUUID(), device.id, result.power_watts, new Date().toISOString());

        results.push({
          deviceName: device.name,
          ip: device.ipAddress,
          power_watts: result.power_watts,
          status: "Erfolgreich"
        });

      } catch (deviceError) {
        const message = deviceError instanceof Error ? deviceError.message : 'Unbekannter Gerätefehler';
        console.error(`Fehler bei Gerät ${device.name}:`, message);
        results.push({
          deviceName: device.name,
          status: "Fehlgeschlagen"
        });
      }
    }

    db.close();

    return NextResponse.json({
      success: true,
      message: `${results.length} Geräte verarbeitet`,
      data: results
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error("Allgemeiner Fehler im API-Loop:", message);
    return NextResponse.json({ success: false, error: "Abfrage fehlgeschlagen" }, { status: 500 });
  }
}