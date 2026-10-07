const axios = require("axios");
const { validateApiKey } = require('../_lib/auth');

const HEADERS = {
  "accept": "*/*",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

const SAVER_HEADERS = {
  ...HEADERS,
  "referer": "https://spotsaver.net/results/",
  "origin": "https://spotsaver.net",
  "content-type": "application/json",
};

function extractTrackId(url) {
  const m = String(url).match(/\/track\/([a-zA-Z0-9]+)/);
  return m ? m[1] : "";
}

async function getInfo(trackId) {
  const { data } = await axios.get(
    "https://spotsaver.net/api/spotify/",
    {
      params: { url: `https://open.spotify.com/track/${trackId}` },
      headers: SAVER_HEADERS,
      timeout: 20000,
      validateStatus: () => true,
    }
  );
  const items = data.items || [];
  if (!items.length) throw new Error("Gak ada track di response");
  return items[0];
}

async function getVideoId(title, artist) {
  const { data } = await axios.post(
    "https://spotsaver.net/api/get-id/",
    { title, artist },
    { headers: SAVER_HEADERS, timeout: 20000, validateStatus: () => true }
  );
  if (!data.videoId) throw new Error("Video ID kosong");
  return { videoId: data.videoId, candidates: data.candidateIds || [] };
}

async function getDownloadUrl(videoId, candidates, title, artist) {
  const { data } = await axios.post(
    "https://spotsaver.net/api/download/",
    {
      videoId,
      candidateIds: candidates,
      format: "mp3",
      title: artist ? `${title} - ${artist}` : title,
    },
    { headers: SAVER_HEADERS, timeout: 60000, validateStatus: () => true }
  );
  const url = data.downloadUrl || data.url || data.fileUrl || data.mediaUrl;
  if (!url) throw new Error(`Gak ada URL download`);
  return url;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await validateApiKey(req, res, 'spotify');
  if (!auth) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const trackUrl = req.query?.url || body?.url;

  if (!trackUrl) {
    return res.status(400).json({ success: false, error: "Parameter 'url' wajib" });
  }

  const trackId = extractTrackId(trackUrl);
  if (!trackId) {
    return res.status(400).json({ success: false, error: "Track ID tidak ditemukan" });
  }

  try {
    const track = await getInfo(trackId);
    const { videoId, candidates } = await getVideoId(track.title, track.artist);
    const downloadUrl = await getDownloadUrl(videoId, candidates, track.title, track.artist);

    return res.status(200).json({
      success: true,
      data: {
        track_id: trackId,
        title: track.title || "",
        artist: track.artist || "",
        thumbnail: track.thumbnail || track.cover || "",
        download_url: downloadUrl,
        format: "mp3",
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
