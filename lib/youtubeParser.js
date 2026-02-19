// lib/youtubeParser.js
const xml2js = require('xml2js');

function parseYouTubeFeed(xml, channelName) {
  return new Promise((resolve) => {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
      attrNameProcessors: [xml2js.processors.stripPrefix]
    });

    parser.parseString(xml, (err, result) => {
      if (err) {
        console.error('XML parse error:', err);
        return resolve([]);
      }

      const entries = result.feed?.entry || [];
      const items = [];

      for (let i = 0; i < Math.min(entries.length, 4); i++) {
        const entry = entries[i];

        // Extract video ID (priority: <yt:videoId>, then <id> with pattern)
        let videoId = '';
        if (entry['yt:videoId']) {
          videoId = entry['yt:videoId'];
        } else if (entry.id && typeof entry.id === 'string') {
          const match = entry.id.match(/yt:video:(\w+)/);
          if (match) videoId = match[1];
        }

        // Title: try <media:group><media:title>, then <title>
        let title = '[No Title]';
        if (entry['media:group']?.['media:title']) {
          title = entry['media:group']['media:title'];
        } else if (entry.title) {
          title = entry.title;
        }

        // URL: try <link href>, then <media:content url>, then fallback to youtu.be
        let url = '';
        if (entry.link?.['@_href']) {
          url = entry.link['@_href'];
        } else if (entry['media:group']?.['media:content']?.['@_url']) {
          url = entry['media:group']['media:content']['@_url'];
        }
        if (!url && videoId) {
          url = `https://youtu.be/${videoId}`;
        }

        // Thumbnail: try <media:group><media:thumbnail url>, then <media:thumbnail url>
        let thumbnail = '';
        if (entry['media:group']?.['media:thumbnail']?.['@_url']) {
          thumbnail = entry['media:group']['media:thumbnail']['@_url'];
        } else if (entry['media:thumbnail']?.['@_url']) {
          thumbnail = entry['media:thumbnail']['@_url'];
        }

        // Published date: use <published> first, then <updated>
        let published = '';
        if (entry.published) {
          published = entry.published;
        } else if (entry.updated) {
          published = entry.updated;
        }

        // Channel name: use <author><name> or fallback to input channelName
        let channel = channelName;
        if (entry.author?.name) {
          channel = entry.author.name;
        }

        items.push({
          title: (title || '').trim(),
          url: (url || '').trim(),
          thumbnail: (thumbnail || '').trim(),
          published: (published || '').trim(),
          channel: (channel || 'Unknown Channel').trim(),
          videoId: (videoId || '').trim()
        });
      }

      resolve(items);
    });
  });
}

module.exports = { parseYouTubeFeed };
