import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const db = new Database(process.env.DATABASE_PATH ?? './prisma/dev.db');

    const conditions = [];
    const params: string[] = [];

    if (from && !Number.isNaN(Date.parse(from))) {
      conditions.push('e.timestamp >= ?');
      params.push(from);
    }

    if (to && !Number.isNaN(Date.parse(to))) {
      conditions.push('e.timestamp <= ?');
      params.push(to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const logs = db.prepare(`
      SELECT e.powerW, e.timestamp, d.name as deviceName 
      FROM EnergyLog e 
      JOIN Device d ON e.deviceId = d.id 
      ${whereClause}
      ORDER BY e.timestamp ASC
    `).all(...params);

    db.close();
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}