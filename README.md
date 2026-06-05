# Query2Card MVP

Query2Card records search queries and AI prompts into a local SQLite database, then lets you review them in a local web page.

Default URL:

```text
http://127.0.0.1:22333
```

## Windows One-Click Start

Double-click:

```text
start-query2card.bat
```

It will:

- install Python dependencies from `backend/requirements.txt`
- start the local backend on port `22333` if it is not already running
- open `http://127.0.0.1:22333`

To create a desktop shortcut, double-click:

```text
install-desktop-shortcut.bat
```

This creates `Query2Card.lnk` on your desktop.

To start Query2Card when Windows logs in, double-click:

```text
install-startup-shortcut.bat
```

This creates `Query2Card.lnk` in your Windows Startup folder.

## Docker Autostart

Start with Docker Compose:

```bash
docker compose up -d --build
```

The service uses:

- host port: `127.0.0.1:22333`
- container restart policy: `unless-stopped`
- database volume: `./data/query2card.db`

After Docker Desktop starts, Compose can restart the container automatically because `docker-compose.yml` uses `restart: unless-stopped`.

Stop it:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

## Chrome Extension

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select this folder:

```text
extension
```

After changing extension files, reload the extension and refresh already-open AI pages.

## Captured Sources

- Google
- Bing
- Baidu
- ChatGPT
- Gemini
- Claude
- Kimi
- DeepSeek
- Perplexity

## Local Data

Default local Python run:

```text
backend/query2card.db
```

Docker run:

```text
data/query2card.db
```

Data stays on your machine.
