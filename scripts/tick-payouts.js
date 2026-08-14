/**
 * 24/7 payout tick — runs on GitHub Actions (PC off).
 * 1) Reads live SHIB transfers from Shibariumscan
 * 2) Posts DISTINCT txs to PAYOUT_CHANNEL_ID via BOT_TOKEN
 *
 * Env: BOT_TOKEN, PAYOUT_CHANNEL_ID, optional NEXT_PUBLIC_BOT_USERNAME, SEND_COUNT
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

if (!process.env.BOT_TOKEN) loadEnvFile();

const SHIB = '0x495eea66B0f8b636D441dC6a98d8F5C3D455C4c0';
const SKIP = new Set(
  [
    '0xb9a712f7e551488fcdf6b6be1ca4a2cd340c415e0dcb7d3d96c32e44d09359b2',
  ].map((s) => s.toLowerCase())
);

function formatAmount(value, decimals) {
  const raw = BigInt(String(value || '0').split('.')[0] || '0');
  let base = 1n;
  for (let i = 0; i < decimals; i++) base *= 10n;
  const whole = raw / base;
  const frac = raw % base;
  let amount = whole.toLocaleString('en-US');
  if (frac > 0n) {
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 4);
    if (fracStr) amount += '.' + fracStr;
  }
  return amount;
}

async function loadLiveTransfers() {
  const url = `https://www.shibariumscan.io/api/v2/tokens/${SHIB}/transfers`;
  const data = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ShibaMinerPayouts/1.0' },
  }).then((r) => r.json());
  const items = Array.isArray(data.items) ? data.items : [];
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const txid = String(item.transaction_hash || '').trim();
    if (!txid || seen.has(txid.toLowerCase()) || SKIP.has(txid.toLowerCase())) continue;
    const to = item.to && item.to.hash;
    if (!to) continue;
    const decimals = Number((item.token && item.token.decimals) || 18) || 18;
    const value = (item.total && item.total.value) || '0';
    try {
      if (BigInt(String(value).split('.')[0] || '0') <= 0n) continue;
    } catch {
      continue;
    }
    const ts = item.timestamp ? Date.parse(item.timestamp) : Date.now();
    if (!Number.isFinite(ts)) continue;
    seen.add(txid.toLowerCase());
    out.push({
      txid,
      to,
      amount: formatAmount(value, decimals),
      when: new Date(ts).toUTCString(),
      ts,
    });
  }
  return out;
}

async function alreadySent(statePath) {
  try {
    if (!fs.existsSync(statePath)) return new Set();
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return new Set((raw.txids || []).map((x) => String(x).toLowerCase()));
  } catch {
    return new Set();
  }
}

async function saveSent(statePath, txids) {
  const prev = [...(await alreadySent(statePath))];
  const next = [...new Set([...prev, ...txids.map((x) => x.toLowerCase())])].slice(-400);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ txids: next, at: Date.now() }));
}

async function main() {
  const token = process.env.BOT_TOKEN;
  const channel = String(process.env.PAYOUT_CHANNEL_ID || '').replace(/^["']|["']$/g, '');
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME || 'Shiba_Inu_Pro_Miner_Bot').replace(/^@/, '');
  const limit = Number(process.env.SEND_COUNT || 3);
  if (!token || !channel) {
    console.error('BOT_TOKEN / PAYOUT_CHANNEL_ID missing');
    process.exit(1);
  }

  const statePath = path.join(process.cwd(), '.data', 'gh-payout-sent.json');
  const sent = await alreadySent(statePath);
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  const live = await loadLiveTransfers();
  const fresh = live
    .filter((t) => !sent.has(t.txid.toLowerCase()) && t.ts >= cutoff)
    .slice(0, limit);
  if (!fresh.length) {
    const fallback = live.filter((t) => !sent.has(t.txid.toLowerCase())).slice(0, 1);
    if (!fallback.length) {
      console.log('no new transfers to post', { live: live.length, already: sent.size });
      return;
    }
    fresh.push(...fallback);
  }

  const posted = [];
  for (const tx of fresh) {
    const short = tx.to.length > 12 ? `${tx.to.slice(0, 6)}…${tx.to.slice(-4)}` : tx.to;
    const shortTx = `${tx.txid.slice(0, 8)}…${tx.txid.slice(-6)}`;
    const text = [
      `<b>🐾 Shiba Miner · Payout</b>`,
      `<i>from @${bot}</i>`,
      ``,
      `💰 <b>${tx.amount}</b> SHIB`,
      `📤 To: <code>${short}</code>`,
      `🧾 Tx: <code>${shortTx}</code>`,
      `🕐 ${tx.when}`,
      ``,
      `<a href="https://www.shibariumscan.io/tx/${tx.txid}">Verify on Shibarium ↗</a>`,
      ``,
      `#SHIB #ShibaMiner #Payout`,
    ].join('\n');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channel,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    }).then((r) => r.json());

    console.log(JSON.stringify({ ok: res.ok, error: res.description || null, txid: tx.txid, amount: tx.amount }));
    if (!res.ok) process.exit(1);
    posted.push(tx.txid);
    await new Promise((r) => setTimeout(r, 400));
  }
  await saveSent(statePath, posted);
  console.log('posted', posted.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
