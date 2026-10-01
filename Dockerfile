# 1. Basis-Betriebssystem: Ein schlankes Linux mit Node.js 20
FROM node:20-bookworm-slim

# 2. Arbeitsverzeichnis im Container festlegen
WORKDIR /app

# 3. Python 3 und virtuelle Umgebung (venv) installieren
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# 4. Virtuelle Python-Umgebung erstellen und tapo installieren
RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
RUN pip install --upgrade pip && pip install tapo

# 5. Paket-Dateien kopieren und Node.js Abhängigkeiten installieren
COPY package*.json ./
RUN npm ci

# 6. Den restlichen App-Code kopieren
COPY . .

# 7. Next.js App bauen
RUN npm run build

# 8. Als unprivilegierter Benutzer laufen lassen (nicht als root)
RUN mkdir -p /app/db-data && chown -R node:node /app/.next /app/db-data
USER node

# 9. Welcher Port soll nach außen geöffnet werden?
EXPOSE 3000

# 10. Der Befehl, der beim Start des Containers ausgeführt wird
CMD ["npm", "start"]