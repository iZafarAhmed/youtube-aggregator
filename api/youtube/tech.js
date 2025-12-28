// api/youtube/tech.js
const { TECH_CHANNELS, fetchChannelFeed, dedupe } = require('../../lib/youtubeAggregator');

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limit = 100, source: sourceParam } = req.query;
  const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 200);
  const sourcesFilter = sourceParam ? sourceParam.split(',').map(s => s.trim()) : null;

  try {
    // Use cache if valid
    if (cache && Date.now() - cacheTime < CACHE_TTL) {
      let results = cache;
      if (sourcesFilter) {
        results = results.filter(item => sourcesFilter.includes(item.channel));
      }
      return res.json({
        total: results.length,
        items: results.slice(0, limitNum),
        cached: true,
        updated_at: new Date(cacheTime).toISOString()
      });
    }

    // Fetch fresh
    const promises = TECH_CHANNELS.map(ch => fetchChannelFeed(ch));
    const allItems = (await Promise.all(promises)).flat();
    const deduped = dedupe(allItems);
    const sorted = deduped.sort((a, b) => new Date(b.published) - new Date(a.published));

    cache = sorted;
    cacheTime = Date.now();

    let filtered = sorted;
    if (sourcesFilter) {
      filtered = sorted.filter(item => sourcesFilter.includes(item.channel));
    }

    res.status(200).json({
      total: filtered.length,
      items: filtered.slice(0, limitNum),
      cached: false,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('YouTube aggregation error:', e);
    res.status(500).json({ error: 'Failed to fetch YouTube videos' });
  }
}
