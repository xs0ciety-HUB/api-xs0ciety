const axios = require("axios");
const { validateApiKey } = require('../_lib/auth');

const URL_API = "https://api.ytultra.com/ikool/youtube/download";

const HEADERS = {
  accept: "*/*",
  "content-type": "application/json",
  origin: "https://www.ytultra.com",
  referer: "https://www.ytultra.com/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

async function getInfo(videoUrl) {
  const { data } = await axios.post(
    URL_API,
    { url: videoUrl },
    { headers: HEADERS, timeout: 30000 }
  );
  return data || {};
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await validateApiKey(req, res, 'youtube');
  if (!auth) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const videoUrl = req.query?.url || body?.url;

  if (!videoUrl) {
    return res.status(400).json({ success: false, error: "Parameter 'url' wajib" });
  }

  try {
    const info = await getInfo(videoUrl);

    if (info.code !== "0000") {
      return res.status(502).json({
        success: false,
        error: info.msg || "Gagal ambil info",
      });
    }

    const data = info.data || {};
    const medias = data.medias || [];

    return res.status(200).json({
      success: true,
      data: {
        title: data.title || "video",
        duration: parseInt(data.duration, 10) || 0,
        thumbnail: data.thumbnail || data.cover || "",
        medias: medias.map((m) => ({
          format: m.format || null,
          fileSize: m.fileSize || null,
          url: m.url || null,
        })),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
