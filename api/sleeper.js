export default async function handler(req, res) {
  const { path } = req.query;
  if (!path || !path.startsWith("/")) {
    return res.status(400).json({ error: "Missing or invalid path" });
  }
  try {
    const upstream = await fetch(`https://api.sleeper.app/v1${path}`);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error" });
    }
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: "Proxy error" });
  }
}
