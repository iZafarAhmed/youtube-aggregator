// api/youtube/tech.js
const { parseYouTubeFeed } = require('../../lib/youtubeParser');

const TECH_CHANNELS = [
{ name: "BBC News", id: "UC16niRr50-MSBwiO3YDb3RA" }, 
{ name: "CNN", id: "UCupvZG-5koeiXAupbDfxWw" }, 
{ name: "Al Jazeera English", id: "UCNye-wNBqNL5ZzHSJj3l8Bg" }, 
{ name: "ABC News", id: "UCBi2mrWuNuyYyNjOtWWfS3A" }, 
{ name: "NBC News", id: "UCeY0bbntWzzVIaj2z3QigXg" }, 
{ name: "Reuters", id: "UChqUTbLdx0892fNoe-3q0ng" }, 
{ name: "The New York Times", id: "UCqnbDFdCpuN8CMEg0QwERPw" }, 
{ name: "Fox News", id: "UCXIJgqnII2ZOINSWNOGFThA" }, 
{ name: "The Guardian", id: "UCHCpS7iIdA9Yid-U-xfMg" }, 
{ name: "Sky News", id: "UCh99op8D1V8r6TuS3_Xg" }
];

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Skip cache for first run (or add query ?refresh=true to force)
    const promises = TECH_CHANNELS.map(async (ch) => {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/atom+xml'
          },
          timeout: 10000
        });

        if (!response.ok) {
          console.warn(`⚠️ ${ch.name}: HTTP ${response.status}`);
          return [];
        }

        const xml = await response.text();
        return parseYouTubeFeed(xml, ch.name);
      } catch (e) {
        console.error(`❌ ${ch.name} fetch error:`, e.message);
        return [];
      }
    });

    const allItems = (await Promise.all(promises)).flat();
    const deduped = [...new Map(allItems.map(i => [i.videoId, i])).values()]; // dedupe by videoId

    res.status(200).json({
      total: deduped.length,
      items: deduped,
      cached: false,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('YouTube API error:', e);
    res.status(500).json({ error: 'Failed to fetch YouTube videos' });
  }
}
