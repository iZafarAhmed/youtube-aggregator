// lib/youtubeAggregator.js
const fetch = require('node-fetch');
const xml2js = require('xml2js');

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
          const url = (typeof content === 'object' && content.$) ? content.$.url : '';
          if (url) videoUrl = url;
        }
        // Try: media:content at root level
        if (!videoUrl && entry['media:content']) {
          const content = entry['media:content'];
          const url = (typeof content === 'object' && content.$) ? content.$.url : '';
          if (url) videoUrl = url;
        }
        // Try: <link rel="alternate">
        if (!videoUrl && entry.link) {
          const links = Array.isArray(entry.link) ? entry.link : [entry.link];
          const altLink = links.find(l => l.$?.rel === 'alternate');
          if (altLink && altLink.$.href) {
            videoUrl = altLink.$.href;
          }
        }
        // Fallback: build from videoId
        if (videoId && !videoUrl) {
          videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // === Thumbnail ===
        let thumbnail = '';
        // Try: media:thumbnail inside media:group
        if (entry['media:group']?.['media:thumbnail']) {
          const thumb = entry['media:group']['media:thumbnail'];
          const url = (typeof thumb === 'object' && thumb.$) ? thumb.$.url : '';
          if (url) thumbnail = url;
        }
        // Try: media:thumbnail at root level
        if (!thumbnail && entry['media:thumbnail']) {
          const thumb = entry['media:thumbnail'];
          const url = (typeof thumb === 'object' && thumb.$) ? thumb.$.url : '';
          if (url) thumbnail = url;
        }
        // Fallback: build from videoId
        if (videoId && !thumbnail) {
          thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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
          title: title.trim(),
          url: videoUrl.trim(),
          thumbnail: thumbnail.trim(),
          published: published,
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
