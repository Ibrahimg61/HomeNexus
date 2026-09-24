import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';
import { getDatabasePath } from '@/app/lib/database';

export const runtime = 'nodejs';
const execFilePromise = util.promisify(execFile);

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const { stdout } = await execFilePromise('.venv/bin/python', [
      'scripts/database.py',
      getDatabasePath(),
      'history',
      from && !Number.isNaN(Date.parse(from)) ? from : '',
      to && !Number.isNaN(Date.parse(to)) ? to : '',
    ]);
    const logs = JSON.parse(stdout);
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}