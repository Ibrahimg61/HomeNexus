import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function GET() {
  try {
    const tapoIp = process.env.TAPO_IP;
    const tapoEmail = process.env.TAPO_EMAIL;
    const tapoPassword = process.env.TAPO_PASSWORD;

    if (!tapoIp || !tapoEmail || !tapoPassword) {
      return NextResponse.json({ success: false, error: "Zugangsdaten fehlen in .env" }, { status: 400 });
    }

    // pyhton skript ausführen und ergbnis abrufen
    const command = `.venv/bin/python scripts/get_tapo.py "${tapoIp}" "${tapoEmail}" "${tapoPassword}"`;
    const { stdout } = await execPromise(command);

    // antwort von python skript 
    const result = JSON.parse(stdout);

    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      device: "Tapo P110 (Python Bridge)",
      power_watts: result.power_watts
    });

  } catch (error: any) {
    console.error("Fehler in der Python-Brücke:", error.message || error);
    return NextResponse.json({ success: false, error: "Lokale Abfrage fehlgeschlagen" }, { status: 500 });
  }
}