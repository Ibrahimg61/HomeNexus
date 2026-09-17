"use client";

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type EnergyLog = { powerW: number; timestamp: string; deviceName: string };
type RangePreset = '24h' | '7d' | '30d' | 'custom';
const chartColors = ['#0f766e', '#e07a5f', '#2563eb', '#ca8a04', '#7c3aed', '#be123c'];

function toDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

export default function Dashboard() {
  const defaultRange = getRange(7);
  const [logs, setLogs] = useState<EnergyLog[]>([]);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59.999`);

    fetch(`/api/history?from=${encodeURIComponent(fromDate.toISOString())}&to=${encodeURIComponent(toDate.toISOString())}`)
      .then(res => res.json())
      .then(json => {
        if (!json.success) throw new Error('Die Messwerte konnten nicht geladen werden.');
        setLogs(json.data);
      })
      .catch(() => setError('Die Messwerte konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [from, to]);

  const devices = useMemo(() => [...new Set(logs.map(log => log.deviceName))], [logs]);
  const chartData = useMemo(() => {
    const grouped = new Map<string, Record<string, string | number>>();
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const key = date.toISOString().slice(0, 16);
      const point = grouped.get(key) ?? { timestamp: date.getTime(), label: date.toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) };
      point[log.deviceName] = log.powerW;
      grouped.set(key, point);
    });
    return [...grouped.values()];
  }, [logs]);

  const averagePower = logs.length ? logs.reduce((sum, log) => sum + log.powerW, 0) / logs.length : 0;
  const peakPower = logs.length ? Math.max(...logs.map(log => log.powerW)) : 0;
  const latestReading = logs.at(-1);

  function applyPreset(nextPreset: Exclude<RangePreset, 'custom'>) {
    const range = getRange(nextPreset === '24h' ? 1 : nextPreset === '30d' ? 30 : 7);
    setLoading(true);
    setError('');
    setPreset(nextPreset);
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div><p className="eyebrow">HOME NEXUS / ENERGIE</p><h1>Dein Zuhause auf einen Blick.</h1><p className="header-copy">Verfolge den Stromverbrauch deiner Geräte und erkenne Trends sofort.</p></div>
          <div className="live-status"><span /> Live-Daten</div>
        </header>

        <section className="filter-panel" aria-label="Zeitraum auswählen">
          <div className="filter-heading"><span className="filter-icon">⌁</span><div><strong>Zeitraum</strong><small>Messwerte anzeigen</small></div></div>
          <div className="preset-group">
            {([['24h', 'Letzte 24h'], ['7d', 'Letzte 7 Tage'], ['30d', 'Letzte 30 Tage']] as const).map(([value, label]) => <button key={value} className={preset === value ? 'preset active' : 'preset'} onClick={() => applyPreset(value)}>{label}</button>)}
          </div>
          <div className="date-fields">
            <label>Von<input type="date" value={from} onChange={event => { setLoading(true); setError(''); setPreset('custom'); setFrom(event.target.value); }} /></label><span className="date-arrow">bis</span><label>Bis<input type="date" value={to} onChange={event => { setLoading(true); setError(''); setPreset('custom'); setTo(event.target.value); }} /></label>
          </div>
        </section>

        <section className="metric-grid">
          <article className="metric-card accent-teal"><span className="metric-label">Aktueller Verbrauch</span><strong>{latestReading ? `${latestReading.powerW.toFixed(1)} W` : '--'}</strong><small>{latestReading ? latestReading.deviceName : 'Keine Daten im Zeitraum'}</small></article>
          <article className="metric-card"><span className="metric-label">Durchschnitt</span><strong>{averagePower.toFixed(1)} W</strong><small>über den ausgewählten Zeitraum</small></article>
          <article className="metric-card"><span className="metric-label">Höchstwert</span><strong>{peakPower.toFixed(1)} W</strong><small>höchste Einzelmessung</small></article>
          <article className="metric-card"><span className="metric-label">Geräte aktiv</span><strong>{devices.length}</strong><small>{logs.length} Messungen gefunden</small></article>
        </section>

        <section className="chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">VERLAUF</p><h2>Stromverbrauch</h2></div><span className="period-label">{from} bis {to}</span></div>
          <div className="chart-wrap">
            {loading ? <div className="empty-state">Messwerte werden geladen ...</div> : error ? <div className="empty-state error-text">{error}</div> : chartData.length === 0 ? <div className="empty-state">Für diesen Zeitraum sind noch keine Messwerte vorhanden.</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dce5e2" /><XAxis dataKey="label" stroke="#71817d" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} /><YAxis stroke="#71817d" fontSize={11} tickLine={false} axisLine={false} unit=" W" /><Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #dce5e2', boxShadow: '0 12px 30px rgba(29, 58, 52, .12)' }} /><Legend iconType="circle" wrapperStyle={{ paddingTop: '18px', fontSize: '12px' }} />{devices.map((device, index) => <Line key={device} type="monotone" dataKey={device} stroke={chartColors[index % chartColors.length]} strokeWidth={2.5} dot={false} connectNulls />)}</LineChart></ResponsiveContainer>}
          </div>
        </section>
      </div>
    </main>
  );
}