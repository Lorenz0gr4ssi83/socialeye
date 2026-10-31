// Expands share/short links (facebook.com/share/…, vm.tiktok.com, t.co, pin.it…)
// to the full public URL, so the page can use the platform's official embed.
// It only follows redirects of an allow-listed set of hosts and never sends cookies or logs in.

const SHORT_HOSTS = [
  /^(www\.|m\.)?facebook\.com$/, /^fb\.watch$/, /^fb\.me$/,
  /^(vm|vt)\.tiktok\.com$/, /^(www\.)?tiktok\.com$/,
  /^t\.co$/, /^pin\.it$/, /^(www\.)?reddit\.com$/, /^redd\.it$/,
  /^(www\.)?instagram\.com$/, /^youtu\.be$/,
];
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

const allowed = (u) => u.protocol === "https:" && SHORT_HOSTS.some((re) => re.test(u.hostname));

function clean(u) {
  if (/facebook\.com$/.test(u.hostname) && /^\/(reel\/\d+|[^/]+\/videos\/\d+|[^/]+\/posts\/[\w]+)/.test(u.pathname)) u.search = "";
  if (/facebook\.com$/.test(u.hostname)) u.hostname = "www.facebook.com";
  if (/(instagram|tiktok)\.com$/.test(u.hostname)) u.search = "";
  u.hash = "";
  return u.href;
}

function isStillShort(u) {
  return /^(fb\.watch|fb\.me|vm\.tiktok\.com|vt\.tiktok\.com|t\.co|pin\.it|redd\.it)$/.test(u.hostname)
    || /^\/share\//.test(u.pathname) || /\/s\/\w+/.test(u.pathname) || /^\/t\//.test(u.pathname);
}

// Official Meta oEmbed API (needs a Meta developer app with "oEmbed Read").
// Set FB_APP_ID and FB_CLIENT_TOKEN in the Vercel project settings to enable it.
async function viaMetaOembed(u) {
  const id = process.env.FB_APP_ID, token = process.env.FB_CLIENT_TOKEN;
  if (!id || !token || !/(facebook\.com|fb\.watch)$/.test(u.hostname)) return null;
  const isVideo = /^\/share\/(r|v)\//.test(u.pathname) || u.hostname === "fb.watch" || /\/(reel|videos|watch)\b/.test(u.pathname);
  const kinds = isVideo ? ["oembed_video", "oembed_post"] : ["oembed_post", "oembed_video"];
  for (const kind of kinds) {
    const api = `https://graph.facebook.com/v21.0/${kind}?url=${encodeURIComponent(u.href)}&omitscript=true&access_token=${id}|${token}`;
    const res = await fetch(api);
    if (!res.ok) continue;
    const data = await res.json();
    const m = String(data.html || "").match(/(?:data-href|cite)="([^"]+)"/);
    if (m) {
      const full = new URL(m[1].replace(/&amp;/g, "&"));
      if (!isStillShort(full)) return clean(full);
    }
  }
  return null;
}

async function resolve(start) {
  const official = await viaMetaOembed(start).catch(() => null);
  if (official) return official;
  let u = start;
  for (let hop = 0; hop < 8; hop++) {
    if (/^\/(login|checkpoint)/.test(u.pathname)) return null; // login wall: stop here
    if (!isStillShort(u)) return clean(u);
    if (!allowed(u)) return null;
    const res = await fetch(u.href, { redirect: "manual", headers: { "user-agent": UA, "accept-language": "it-IT,it;q=0.9" } });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u); continue; }
    if (res.ok) {
      // Some services answer 200 with the canonical URL in the page head.
      const html = (await res.text()).slice(0, 200000);
      const m = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/http-equiv=["']refresh["'][^>]+url=([^"'>]+)/i);
      if (m) { const next = new URL(m[1].replace(/&amp;/g, "&"), u); if (next.href !== u.href) { u = next; continue; } }
    }
    return null;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "public, max-age=3600");
  let start;
  try { start = new URL(String(req.query.url || "")); } catch { return res.status(400).json({ error: "bad url" }); }
  if (!allowed(start)) return res.status(400).json({ error: "host not supported" });
  try {
    const url = await resolve(start);
    if (!url) return res.status(404).json({ error: "not resolved" });
    return res.status(200).json({ url });
  } catch {
    return res.status(502).json({ error: "fetch failed" });
  }
}
