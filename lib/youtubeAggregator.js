// lib/youtubeAggregator.js
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const TECH_CHANNELS = [
  { name: "Mrwhosetheboss", id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw" },
  { name: "Linus Tech Tips", id: "UCsTcErHg8oDvUnTzoqsYeNw" },
  { name: "The Verge", id: "UC1tVU8H153ZFO9eRsxdJlhA" },
  { name: "MKBHD", id: "UCBJycsmduvYEL83R_U4JriQ" },
  { name: "Lawrence Systems", id: "UCHkYOD-3fZbuGhwsADBd9ZQ" },
  { name: "TechChurch", id: "UCWFKCr40YwOZQx8FHU_ZqqQ" }
];

const MIN_VIDEOS = 5;

// Parse XML with xml2js
function parseYouTubeFeed(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false, ignoreAttrs: false }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const entries = result.feed.entry;
      if (!entries) {
        resolve([]);
        return;
      }

      // Ensure entries is an array
      const entryList = Array.isArray(entries) ? entries : [entries];
      const items = entryList.slice(0, MIN_VIDEOS).map(entry => {
        const title = entry['media:title']?._ || '[No Title]';
        const content = entry['media:content'];
        const videoUrl = content?.url || entry.link?.['@_href'] || '';
        const thumbnail = entry['media:thumbnail']?.url || '';
        const published = entry.published || '';

        // Author name (fallback to channel name if missing)
        const authorName = entry.author?.name?._ || '';

        // Extract video ID
        const videoIdMatch = videoUrl.match(/v=([a-zA-Z0-9_-]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : '';

        return {
          title: title.trim(),
          url: videoUrl,
          thumbnail,
          published,
          channel: authorName.trim() || 'Unknown Channel',
          videoId
        };
      });

      resolve(items);
    });
  });
}

async function fetchChannelFeed(channel) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'RSS Aggregator (contact@example.com)', 'Accept': 'application/atom+xml' }
    });

    if (!response.ok) {
      console.error(`⚠️ ${channel.name}: HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = await parseYouTubeFeed(xml);
    return items;
  } catch (error) {
    console.error(`❌ ${channel.name} fetch error:`, error.message);
    return [];
  }
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item.videoId) return true;
    if (seen.has(item.videoId)) return false;
    seen.add(item.videoId);
    return true;
  });
}

module.exports = {
  TECH_CHANNELS,
  fetchChannelFeed,
  dedupe
};
