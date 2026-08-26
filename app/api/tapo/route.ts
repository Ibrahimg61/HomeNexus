import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import Database from 'better-sqlite3';
import crypto from 'crypto';

export const runtime = 'nodejs';
const execPromise = util.promisify(exec);

export async function GET() {
  try {
    const tapoEmail = process.env.TAPO_EMAIL;
    const tapoPassword = process.env.TAPO_PASSWORD;

    if (!tapoEmail || !tapoPassword) {
      return NextResponse.json({ success: false, error: "Zugangsdaten fehlen in .env" }, { status: 400 });
    }

    const db = new Database('./prisma/dev.db');

    const devices = db.prepare("SELECT * FROM Device WHERE type = 'tapo_p110'").all() as any[];

    if (devices.length === 0) {
      db.close();
      return NextResponse.json({ success: false, message: "Keine Tapo-Geräte in der Datenbank gefunden." });
    }

    const results = [];

    for (const device of devices) {
      try {
        const command = `.venv/bin/python scripts/get_tapo.py "${device.ipAddress}" "${tapoEmail}" "${tapoPassword}"`;
        const { stdout } = await execPromise(command);

        const result = JSON.parse(stdout);

        if (!result.success) {
          throw new Error(result.error);
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

      } catch (deviceError: any) {
        console.error(`Fehler bei Gerät ${device.name}:`, deviceError.message || deviceError);
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

  } catch (error: any) {
    console.error("Allgemeiner Fehler im API-Loop:", error.message || error);
    return NextResponse.json({ success: false, error: "Abfrage fehlgeschlagen" }, { status: 500 });
  }
}