// Module-level instance cache — avoids re-fetching the ~5MB players DB on every request
let _cache     = null;
let _cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) {
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(_cache);
  }
  try {
    const upstream = await fetch("https://api.sleeper.app/v1/players/nfl");
    if (!upstream.ok) {
      if (_cache) {
        res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).send(_cache);
      }
      return res.status(upstream.status).json({ error: "Upstream error" });
    }
    _cache     = await upstream.text();
    _cacheTime = now;
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(_cache);
  } catch {
    if (_cache) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
      res.setHeader("Content-Type", "application/json");
      return res.status(200).send(_cache);
    }
    return res.status(500).json({ error: "Players DB unavailable" });
  }
}
