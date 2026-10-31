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

// A login wall that carries the real destination in ?next= is still a way to learn the public URL.
function fromLoginWall(u) {
  if (!/facebook\.com$|instagram\.com$/.test(u.hostname)) return null;
  if (!/login|checkpoint/.test(u.pathname)) return null;
  const next = u.searchParams.get("next");
  try { return next ? new URL(next) : null; } catch { return null; }
}

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

async function resolve(start) {
  let u = start;
  for (let hop = 0; hop < 8; hop++) {
    const wall = fromLoginWall(u);
    if (wall) u = wall;
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
