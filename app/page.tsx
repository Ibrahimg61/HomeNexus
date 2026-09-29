"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { setTheme, useTheme, type Theme } from '@/app/lib/theme';

type EnergyLog = { powerW: number; timestamp: string; deviceName: string };
type Device = { id: string; name: string; ipAddress: string; type: string };
type RangePreset = '24h' | '7d' | '30d' | 'custom';
const maxChartPoints = 240;
const chartColors = [1, 2, 3, 4, 5, 6].map(index => `var(--chart-${index})`);
const themeOptions: { value: Theme; label: string }[] = [{ value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }, { value: 'system', label: 'System' }];

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
  const theme = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceIp, setDeviceIp] = useState('');
  const [deviceMessage, setDeviceMessage] = useState('');
  const [savedDevices, setSavedDevices] = useState<Device[]>([]);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingIp, setEditingIp] = useState('');
  const [deviceListMessage, setDeviceListMessage] = useState('');

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

  useEffect(() => {
    fetch('/api/devices')
      .then(res => res.json())
      .then(json => {
        if (!json.success) throw new Error('Geräte konnten nicht geladen werden.');
        setSavedDevices(json.devices);
      })
      .catch(() => setDeviceListMessage('Geräte konnten nicht geladen werden.'));
  }, []);

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
    const points = [...grouped.values()];
    // Kleine Geräte (Raspberry Pi) rendern nicht tausende SVG-Punkte flüssig: gleichmäßig ausdünnen.
    if (points.length <= maxChartPoints) return points;
    const step = Math.ceil(points.length / maxChartPoints);
    return points.filter((_, index) => index % step === 0 || index === points.length - 1);
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

  async function addDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeviceMessage('Gerät wird gespeichert ...');
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deviceName, ipAddress: deviceIp }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Gerät konnte nicht gespeichert werden.');
      setDeviceMessage('Gerät gespeichert. Der erste Messwert kommt beim nächsten Polling.');
      setDeviceName('');
      setDeviceIp('');
      const devicesResponse = await fetch('/api/devices');
      const devicesResult = await devicesResponse.json();
      if (devicesResult.success) setSavedDevices(devicesResult.devices);
    } catch (addError) {
      setDeviceMessage(addError instanceof Error ? addError.message : 'Gerät konnte nicht gespeichert werden.');
    }
  }

  function startEditing(device: Device) {
    setEditingDeviceId(device.id);
    setEditingName(device.name);
    setEditingIp(device.ipAddress);
    setDeviceListMessage('');
  }

  async function saveDevice(deviceId: string) {
    setDeviceListMessage('Gerät wird aktualisiert ...');
    try {
      const response = await fetch('/api/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deviceId, name: editingName, ipAddress: editingIp }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Gerät konnte nicht aktualisiert werden.');
      setSavedDevices(current => current.map(device => device.id === deviceId ? result.device : device));
      setEditingDeviceId(null);
      setDeviceListMessage('Gerät aktualisiert.');
    } catch (saveError) {
      setDeviceListMessage(saveError instanceof Error ? saveError.message : 'Gerät konnte nicht aktualisiert werden.');
    }
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div><p className="eyebrow">HOME NEXUS / ENERGIE</p><h1>G-Home</h1><p className="header-copy">Verfolge den Stromverbrauch deiner Geräte und erkenne Trends sofort.</p></div>
          <div className="header-actions">
            <div className="live-status"><span /> Live-Daten</div>
            <button className="settings-button" aria-label="Einstellunn öffnen" onClick={() => setShowSettings(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></button>
          </div>
        </header>

        <section className="filter-panel" aria-label="Zeitraum auswählen">
          <div className="filter-heading"><span className="filter-icoKan">⌁</span><div><strong>Zeitraum</strong><small>Messwerte anzeigen</small></div></div>
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
            {loading ? <div className="empty-state">Messwerte werden geladen ...</div> : error ? <div className="empty-state error-text">{error}</div> : chartData.length === 0 ? <div className="empty-state">Für diesen Zeitraum sind noch keine Messwerte vorhanden.</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--line)" /><XAxis dataKey="label" stroke="var(--ink-muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} /><YAxis stroke="var(--ink-muted)" fontSize={11} tickLine={false} axisLine={false} unit=" W" /><Tooltip contentStyle={{ background: 'var(--surface)', color: 'var(--foreground)', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: 'var(--shadow-tooltip)' }} /><Legend iconType="circle" wrapperStyle={{ paddingTop: '18px', fontSize: '12px' }} />{devices.map((device, index) => <Line key={device} type="monotone" dataKey={device} stroke={chartColors[index % chartColors.length]} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />)}</LineChart></ResponsiveContainer>}
          </div>
        </section>

        <section className="devices-panel">
          <div className="panel-heading"><div><p className="eyebrow">VERWALTUNG</p><h2>Meine Geräte</h2></div><div className="devices-panel-actions"><span className="period-label">{savedDevices.length} gespeichert</span><button className="add-device-button" onClick={() => { setShowDeviceForm(true); setDeviceMessage(''); }}>+ Gerät hinzufügen</button></div></div>
          {deviceListMessage && <p className="device-list-message">{deviceListMessage}</p>}
          {savedDevices.length === 0 ? <div className="devices-empty">Noch keine Geräte gespeichert. Füge oben deine erste Tapo-Steckdose hinzu.</div> : <div className="device-list">{savedDevices.map(device => <article className="device-row" key={device.id}>{editingDeviceId === device.id ? <><label>Name<input value={editingName} onChange={event => setEditingName(event.target.value)} maxLength={80} /></label><label>IP-Adresse<input value={editingIp} onChange={event => setEditingIp(event.target.value)} inputMode="decimal" /></label><div className="device-row-actions"><button className="device-save" onClick={() => saveDevice(device.id)}>Speichern</button><button className="device-cancel" onClick={() => setEditingDeviceId(null)}>Abbrechen</button></div></> : <><div className="device-identity"><span className="device-dot" /><div><strong>{device.name}</strong><small>{device.ipAddress} · Tapo P110</small></div></div><button className="device-edit" onClick={() => startEditing(device)}>Bearbeiten</button></>}</article>)}</div>}
        </section>
      </div>
      {showSettings && <div className="modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setShowSettings(false); }}><section className="device-modal" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title"><div className="modal-heading"><div><p className="eyebrow">EINSTELLUNGEN</p><h2 id="settings-dialog-title">Darstellung</h2></div><button className="close-button" aria-label="Dialog schließen" onClick={() => setShowSettings(false)}>×</button></div><p className="settings-label">Farbschema</p><div className="preset-group theme-group" role="group" aria-label="Farbschema">{themeOptions.map(option => <button key={option.value} className={theme === option.value ? 'preset active' : 'preset'} aria-pressed={theme === option.value} onClick={() => setTheme(option.value)}>{option.label}</button>)}</div></section></div>}
      {showDeviceForm &&<div className="modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setShowDeviceForm(false); }}><section className="device-modal" role="dialog" aria-modal="true" aria-labelledby="device-dialog-title"><div className="modal-heading"><div><p className="eyebrow">NEUES GERÄT</p><h2 id="device-dialog-title">Tapo-Steckdose hinzufügen</h2></div><button className="close-button" aria-label="Dialog schließen" onClick={() => setShowDeviceForm(false)}>×</button></div><form onSubmit={addDevice}><label>Gerätename<input value={deviceName} onChange={event => setDeviceName(event.target.value)} placeholder="z. B. Wohnzimmer" required maxLength={80} /></label><label>IPv4-Adresse<input value={deviceIp} onChange={event => setDeviceIp(event.target.value)} placeholder="z. B. 192.168.178.50" required inputMode="decimal" /></label>{deviceMessage && <p className="device-message">{deviceMessage}</p>}<button className="save-device-button" type="submit">Gerät speichern</button></form></section></div>}
    </main>
  );
}