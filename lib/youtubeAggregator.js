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

      const feed = result.feed;
      if (!feed) {
        resolve([]);
        return;
      }

      const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : []);
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
        // Try: media:content inside media:group
        if (entry['media:group']?.['media:content']) {
          const content = entry['media:group']['media:content'];
          const url = (typeof content === 'object' && content.$) ? content.$.url : (typeof content === 'string' ? content : '');
          if (url) videoUrl = url.trim();
        }
        // Try: media:content at root level
        if (!videoUrl && entry['media:content']) {
          const content = entry['media:content'];
          const url = (typeof content === 'object' && content.$) ? content.$.url : (typeof content === 'string' ? content : '');
          if (url) videoUrl = url.trim();
        }
        // Try: link[rel=alternate]
        if (!videoUrl && entry.link) {
          const links = Array.isArray(entry.link) ? entry.link : [entry.link];
          const altLink = links.find(l => l.$ && l.$.rel === 'alternate');
          if (altLink && altLink.$.href) {
            videoUrl = altLink.$.href.trim();
          }
        }

// === Thumbnail ===
let thumbnail = '';

// Try: media:thumbnail inside media:group
const mediaGroup = entry['media:group'];
if (mediaGroup?.['media:thumbnail']?.length) {
  const thumbObj = mediaGroup['media:thumbnail'][0];
  if (thumbObj?.$?.url) {
    thumbnail = thumbObj.$.url.trim();
  }
}

// Try: media:thumbnail at root level
if (!thumbnail && entry['media:thumbnail']?.length) {
  const thumbObj = entry['media:thumbnail'][0];
  if (thumbObj?.$?.url) {
    thumbnail = thumbObj.$.url.trim();
  }
}

        // === Published Date ===
        const published = (entry.published || '').trim();

        // === Channel Name ===
        let channel = 'Unknown Channel';
        if (entry.author) {
          const authors = Array.isArray(entry.author) ? entry.author : [entry.author];
          const author = authors.find(a => a.name)?.name || authors[0]?.name;
          if (author) channel = author.trim();
        } else if (entry['yt:channelId']) {
          channel = 'Channel ' + entry['yt:channelId'];
        }

        items.push({
          title: title || '[No Title]',
          url: videoUrl || '',
          thumbnail: thumbnail || '',
          published: published || '',
          channel: channel || 'Unknown Channel',
          videoId: videoId || ''
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
