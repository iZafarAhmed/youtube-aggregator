// lib/youtubeAggregator.js
const fetch = require('node-fetch');

const TECH_CHANNELS = [
  { name: "Mrwhosetheboss", id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw" },
  { name: "Linus Tech Tips", id: "UCsTcErHg8oDvUnTzoqsYeNw" },
  { name: "The Verge", id: "UC1tVU8H153ZFO9eRsxdJlhA" },
  { name: "MKBHD", id: "UCBJycsmduvYEL83R_U4JriQ" },
  { name: "Lawrence Systems", id: "UCHkYOD-3fZbuGhwsADBd9ZQ" },
  { name: "TechChurch", id: "UCWFKCr40YwOZQx8FHU_ZqqQ" }
];

const MIN_VIDEOS = 5;

async function fetchChannelFeed(channel) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/atom+xml' }
  });

  if (!response.ok) {
    console.error(`Failed to fetch ${channel.name}: ${response.status}`);
    return [];
  }

  const xml = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const entries = Array.from(doc.querySelectorAll('entry'));
  return entries.slice(0, MIN_VIDEOS).map(entry => {
    const title = entry.querySelector('media\\:title')?.textContent?.trim() || '[No Title]';
    const videoUrl = entry.querySelector('media\\:content')?.getAttribute('url') || '';
    const thumbnail = entry.querySelector('media\\:thumbnail')?.getAttribute('url') || '';
    const published = entry.querySelector('published')?.textContent || '';
    const authorName = entry.querySelector('author name')?.textContent?.trim() || channel.name;

    const videoIdMatch = videoUrl.match(/v=([a-zA-Z0-9_-]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';

    return {
      title,
      url: videoUrl,
      thumbnail,
      published,
      channel: authorName,
      videoId
    };
  });
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
