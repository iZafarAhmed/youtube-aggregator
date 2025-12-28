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

const MIN_VIDEOS = 5;

function parseYouTubeFeed(xml) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
      attrNameProcessors: [xml2js.processors.stripPrefix]
    });

    parser.parseString(xml, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const entries = result.feed?.entry || [];
      if (!Array.isArray(entries)) {
        // Handle case with only one entry
        resolve([entries]);
        return;
      }

      const items = [];
      for (let i = 0; i < Math.min(entries.length, MIN_VIDEOS); i++) {
        const entry = entries[i];

        // === Video ID ===
        let videoId = '';
        if (entry['yt:videoId']) {
          videoId = entry['yt:videoId'];
        } else if (entry.id && typeof entry.id === 'string') {
          const match = entry.id.match(/yt:video:(\w+)/);
          if (match) videoId = match[1];
        }

        // === Title ===
        let title = '[No Title]';
        if (entry['media:group']?.['media:title']) {
          title = entry['media:group']['media:title'];
        } else if (entry.title) {
          title = entry.title;
        }

        // === Video URL ===
        let videoUrl = '';
        if (entry['media:group']?.['media:content']) {
          const content = entry['media:group']['media:content'];
          videoUrl = content?.$?.url || (typeof content === 'string' ? content : '');
        }
        if (!videoUrl && entry.link) {
          videoUrl = entry.link?.$?.href || (typeof entry.link === 'string' ? entry.link : '');
        }

        // === Thumbnail ===
        let thumbnail = '';
        if (entry['media:group']?.['media:thumbnail']) {
          const thumb = entry['media:group']['media:thumbnail'];
          thumbnail = thumb?.$?.url || (typeof thumb === 'string' ? thumb : '');
        }

        // === Published Date ===
        const published = entry.published || '';

        // === Channel Name ===
        let channel = 'Unknown Channel';
        if (entry.author?.name) {
          channel = entry.author.name;
        } else if (entry['yt:channelId']) {
          channel = 'Channel ' + entry['yt:channelId'];
        }

        items.push({
          title: title.trim(),
          url: videoUrl.trim(),
          thumbnail: thumbnail.trim(),
          published: published.trim(),
          channel: channel.trim(),
          videoId: videoId
        });
      }

      resolve(items);
    });
  });
}

async function fetchChannelFeed(channel) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YouTube Aggregator; contact@example.com)',
        'Accept': 'application/atom+xml'
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.error(`⚠️ ${channel.name}: HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = await parseYouTubeFeed(xml);
    return items;
  } catch (error) {
    console.error(`❌ ${channel.name} error:`, error.message);
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
