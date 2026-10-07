const axios = require("axios");
const { validateApiKey } = require('../_lib/auth');

const API_BASE = "https://api.toolenium.com";

const HEADERS = {
  accept: "*/*",
  "content-type": "application/json",
  origin: "https://scload.com",
  referer: "https://scload.com/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

async function getInfo(scUrl) {
  const { data } = await axios.post(
    `${API_BASE}/v1/info`,
    { url: scUrl },
    { headers: HEADERS, timeout: 30000 }
  );
  return data || {};
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await validateApiKey(req, res, 'soundcloud');
  if (!auth) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const scUrl = req.query?.url || body?.url;

  if (!scUrl) {
    return res.status(400).json({ success: false, error: "Parameter 'url' wajib" });
  }

  try {
    const info = await getInfo(scUrl);

    if (!info || !info.formats) {
      return res.status(502).json({ success: false, error: "Gagal ambil info" });
    }

    return res.status(200).json({
      success: true,
      data: {
        title: info.title || "soundcloud",
        duration: info.duration || null,
        thumbnail: info.thumbnail || "",
        formats: (info.formats || []).map((f) => ({
          format_id: f.format_id || null,
          ext: f.audio_ext || "mp3",
          resolution: f.resolution || null,
          url: f.url || null,
        })),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
