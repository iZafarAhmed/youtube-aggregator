// lib/youtubeAggregator.js
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const TECH_CHANNELS = [
  { name: "Mrwhosetheboss", id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw" },
  { name: "Linus Tech Tips", id: "UCsTcErHg8oDvUnTzoqsYeNw" },
  { name: "The Verge", id: "UC1tVU8H153ZFO9eRsxdJlhA" },
  { name: "MKBHD", id: "UCBJycsmduvYEL83R_U4JriQ" },
  { name: "Lawrence Systems", id: "UCHkYOD-3fZbuGhwsADBd9ZQ" },
  { name: "JerryRigEverything", id: "UCWFKCr40YwOZQx8FHU_ZqqQ" }
];

const MIN_VIDEOS = 4;

function parseYouTubeFeed(xml, channelName) {
  // ✅ First: Check if response is valid XML (contains <feed>)
  if (!xml.includes('<feed') && !xml.includes('<entry')) {
    console.warn(`⚠️ ${channelName}: Response is NOT XML (likely HTML or empty)`);
    return [];
  }

  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
      attrNameProcessors: [xml2js.processors.stripPrefix]
    });

    return new Promise((resolve) => {
      parser.parseString(xml, (err, result) => {
        if (err) {
          console.error(`❌ ${channelName} XML parse error:`, err.message);
          resolve([]);
          return;
        }

        const entries = result.feed?.entry || [];
        const items = [];

        for (let i = 0; i < Math.min(entries.length, MIN_VIDEOS); i++) {
          const entry = entries[i];

          // Extract video ID (fallback to URL)
          let videoId = '';
          if (entry['yt:videoId']) {
            videoId = entry['yt:videoId'];
          } else if (entry.id && typeof entry.id === 'string') {
            const match = entry.id.match(/yt:video:(\w+)/);
            if (match) videoId = match[1];
          }

          // Title
          let title = '[No Title]';
          if (entry['media:group']?.['media:title']) {
            title = entry['media:group']['media:title'];
          } else if (entry.title) {
            title = entry.title;
          }

          // URL (fallback to link + videoId)
          let url = '';
          if (entry['media:group']?.['media:content']) {
            const content = entry['media:group']['media:content'];
            url = content?.$?.url || '';
          }
          if (!url && entry.link) {
            url = entry.link?.$?.href || entry.link;
          }
          if (!url && videoId) {
            url = `https://youtu.be/${videoId}`;
          }

          // Thumbnail (fallback to YouTube thumbnail pattern)
          let thumbnail = '';
          if (entry['media:group']?.['media:thumbnail']) {
            const thumb = entry['media:group']['media:thumbnail'];
            thumbnail = thumb?.$?.url || '';
          }
          if (!thumbnail && videoId) {
            thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }

          // Published date
          const published = entry.published || '';

          // Channel name
          let channel = channelName;
          if (entry.author?.name) {
            channel = entry.author.name;
          }

          items.push({
            title: (title || '[No Title]').trim(),
            url: url.trim(),
            thumbnail: thumbnail.trim(),
            published: (published || '').trim(),
            channel: channel.trim(),
            videoId: videoId
          });
        }

        resolve(items);
      });
    });
  } catch (e) {
    console.error(`❌ ${channelName} parser exception:`, e);
    return [];
  }
}

async function fetchChannelFeed(channel) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/atom+xml'
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.error(`❌ ${channel.name}: HTTP ${response.status} ${response.statusText}`);
      return [];
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // ✅ Critical: Detect HTML instead of XML
    if (contentType.includes('html') || text.includes('<!DOCTYPE html') || text.includes('AboutPressCopyright')) {
      console.warn(`⚠️ ${channel.name}: Got HTML (blocked by YouTube). Skipping.`);
      return [];
    }

    const items = await parseYouTubeFeed(text, channel.name);
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
