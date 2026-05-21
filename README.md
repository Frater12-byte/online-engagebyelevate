# Engage Online

Static sister-site to [engagebyelevate.com](https://engagebyelevate.com) — lets remote attendees access the live programme of **Engage by Elevate 2026** (Dubai, June 2–4) and join sessions via Microsoft Teams.

Lives at **https://online.engagebyelevate.com**.

Zero build step. Two HTML pages, one stylesheet, two scripts, one JSON file. Nginx serves `public/` as the document root.

## What it does

- **Gate page** (`/`) — collects name + email + company, stores them in `localStorage`, redirects to `/programme`.
- **Programme page** (`/programme`) — lists all sessions from `data/meetings.json`, filters by day, shows live/upcoming/ended status, opens Teams join links 10 minutes before each session starts.
- **No backend.** No accounts, no DB, no Node process. Anyone with the URL can sign in — the gate is a soft capture, not auth.

## Local preview

```bash
npx serve public
# or: npx http-server public -p 8080
```

Open http://localhost:3000 (or whatever port `serve` prints).

## Updating sessions

Edit `public/data/meetings.json`. It's an array of session objects:

```json
{
  "id": "opening-keynote",
  "title": "Opening Keynote — Reimagining Hosted Buyer Events",
  "description": "Welcome address and a look at how the hosted buyer model is evolving.",
  "startsAt": "2026-06-02T10:00:00+04:00",
  "endsAt": "2026-06-02T10:45:00+04:00",
  "speakers": ["Francesca Doe — Elevate World", "Guest Speaker TBC"],
  "joinUrl": "https://teams.microsoft.com/l/meetup-join/REPLACE_ME"
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable slug, used as a key. |
| `title` | yes | Shown on the card. |
| `description` | no | One or two sentences. Optional. |
| `startsAt` | yes | ISO 8601 with offset. Use `+04:00` for Dubai (GST). |
| `endsAt` | no | ISO 8601. Defaults to start + 1h if omitted. |
| `speakers` | no | Array of strings. Optional. |
| `joinUrl` | no | MS Teams join link. The card shows a disabled placeholder until 10 min before `startsAt`. |

Sort order is by `startsAt` (the client sorts on load). The day-tab filter uses the Dubai-local calendar date of `startsAt`.

After editing: commit, push, then on the VPS run `deploy-online`.

## Deploying

This site deploys via a VPS-side script invoked from the Hostinger browser terminal — same shape as `deploy-engage` for the main site.

```bash
# On the VPS, as user engagebyelevate-online:
deploy-online
```

That runs `scripts/deploy-online.sh`, which:
1. `git pull`s the latest commit in `/home/engagebyelevate-online/online-engagebyelevate`
2. `rsync`s `public/` into `/home/engagebyelevate-online/htdocs/online.engagebyelevate.com/`
3. Normalises permissions (dirs 755, files 644)

No nginx reload needed — static files are read from disk on every request.

### One-time install on the VPS

```bash
cd /home/engagebyelevate-online
git clone https://github.com/Frater12-byte/online-engagebyelevate.git
chmod +x online-engagebyelevate/scripts/deploy-online.sh
sudo ln -s /home/engagebyelevate-online/online-engagebyelevate/scripts/deploy-online.sh /usr/local/bin/deploy-online
```

## How it's wired (DNS / Nginx / SSL)

- **DNS:** `online.engagebyelevate.com` A record → `145.223.88.138` (Hostinger VPS).
- **Site user:** `engagebyelevate-online` (separate CloudPanel site from the main Node app, which runs as `engagebyelevate`).
- **Document root:** `/home/engagebyelevate-online/htdocs/online.engagebyelevate.com`.
- **Nginx vhost:** managed entirely by **CloudPanel** — do not edit `/etc/nginx/` directly. `nginx/online.engagebyelevate.com.conf` in this repo is a reference snapshot, not a deploy artifact.
- **SSL:** Let's Encrypt via CloudPanel (auto-renewing).

## License

MIT — see [LICENSE](LICENSE).
