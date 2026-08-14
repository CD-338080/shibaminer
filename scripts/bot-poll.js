/**
 * DEV ONLY. Do not use in production.
 * Long-polling requires deleteWebhook and kills Jarvis when this process stops.
 * Production uses Vercel webhook: npm run bot:webhook
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  try {
    const p = path.join(process.cwd(), '.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvFile();

console.error(`
bot:poll is LOCAL DEV only and will BREAK Jarvis when the PC is off
(it deletes the Vercel webhook).

Use this instead (24/7, PC off):
  npm run bot:webhook
`);
process.exit(1);
