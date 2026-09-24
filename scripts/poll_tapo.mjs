const apiUrl = process.env.TAPO_API_URL ?? 'http://127.0.0.1:3000/api/tapo';
const apiKey = process.env.HOMENEXUS_API_KEY;
const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 300000);
const retryDelayMs = 5000;
const requestTimeoutMs = 30000;

async function poll() {
  if (!apiKey) {
    console.error('HOMENEXUS_API_KEY fehlt. Polling wird übersprungen.');
    return;
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const body = await response.text();

      if (!response.ok) {
        console.error(`Polling fehlgeschlagen (${response.status}): ${body}`);
        return;
      }

      console.log(`Polling erfolgreich: ${body}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 3) {
        console.error(`Polling nach ${attempt} Versuchen nicht erreichbar: ${message}`);
        return;
      }
      console.error(`Polling-Versuch ${attempt} fehlgeschlagen: ${message}. Neuer Versuch folgt.`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
}

await poll();
setInterval(poll, intervalMs);
