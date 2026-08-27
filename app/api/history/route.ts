import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = new Database('./prisma/dev.db');
    
    // Holt alle Einträge und den passenden Gerätenamen dazu
    const logs = db.prepare(`
      SELECT e.powerW, e.timestamp, d.name as deviceName 
      FROM EnergyLog e 
      JOIN Device d ON e.deviceId = d.id 
      ORDER BY e.timestamp ASC
    `).all();

    db.close();
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}