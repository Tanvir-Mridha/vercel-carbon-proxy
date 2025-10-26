// api/carbon.js
// Proxy serverless function for Website Carbon API
// Usage: https://<your-vercel-app>/api/carbon?url=https://youtube.com

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Missing `url` parameter" });

    // Optional: restrict to certain domains (set null to allow all)
    const allowlist = null; // e.g. ['youtube.com','example.com']
    if (allowlist) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        if (!allowlist.includes(host)) {
          return res.status(403).json({ error: "Domain not allowed" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }
    }

    // In-memory cache (per cold-start)
    if (!global.__carbon_cache) global.__carbon_cache = {};
    const cache = global.__carbon_cache;
    const KEY = url;
    const TTL = 1000 * 60 * 60 * 24; // 24h

    const cached = cache[KEY];
    if (cached && (Date.now() - cached.t) < TTL) {
      return res.status(200).json({ cached: true, ...cached.v });
    }

    // Forward request to WebsiteCarbon API
    const wcUrl = `https://api.websitecarbon.com/site?url=${encodeURIComponent(url)}`;
    const r = await fetch(wcUrl);

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).json({ error: "Upstream error", status: r.status, body: text });
    }

    const data = await r.json();
    cache[KEY] = { t: Date.now(), v: data };

    // Return proxy response
    return res.status(200).json({ cached: false, ...data });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
