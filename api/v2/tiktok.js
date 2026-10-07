const axios = require("axios");
const { validateApiKey } = require('../_lib/auth');

const BASE = "https://api.tikup.me";
const HEADERS = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json",
  origin: "https://tikup.me",
  referer: "https://tikup.me/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function requestInfo(videoUrl) {
  const { data } = await axios.post(
    `${BASE}/api/video-info`,
    { video_url: videoUrl, debug: false },
    { headers: HEADERS, timeout: 30000 }
  );
  return data || {};
}

async function checkStatus(jobId) {
  const { data } = await axios.get(`${BASE}/api/job-status/${jobId}`, {
    headers: HEADERS,
    timeout: 30000,
  });
  return data || {};
}

async function getVideoInfo(videoUrl, maxWait = 55) {
  const info = await requestInfo(videoUrl);
  const jobId = info.job_id;
  if (!jobId) return { error: "Gak dapet job_id", raw: info };

  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWait) {
    await sleep(2000);
    const status = await checkStatus(jobId);
    if (status.status === "completed") return status;
    if (status.status === "failed" || status.status === "error") return status;
  }
  return { error: "Timeout" };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await validateApiKey(req, res, 'tiktok');
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
    const info = await getVideoInfo(videoUrl);

    if (info.error) {
      return res.status(502).json({ success: false, error: info.error, detail: info.raw || null });
    }
    if (info.status !== "completed") {
      return res.status(502).json({ success: false, error: "Job gagal", detail: info });
    }

    const result = info.result || {};
    const videoUrls = result.videoUrls || {};
    const vd = result.videoData || {};

    return res.status(200).json({
      success: true,
      data: {
        title: vd.title || "",
        video_id: vd.video_id || null,
        author: {
          username: vd.author?.username || "unknown",
          nickname: vd.author?.nickname || "",
          avatar: vd.author?.avatar || "",
        },
        thumbnail: vd.cover || vd.origin_cover || "",
        duration: vd.duration || 0,
        stats: {
          views: vd.view_count || 0,
          likes: vd.like_count || 0,
          comments: vd.comment_count || 0,
          shares: vd.share_count || 0,
        },
        video: {
          no_watermark: videoUrls.no_watermark || null,
          watermark: videoUrls.watermark || null,
          qualities: videoUrls.qualities || [],
        },
        audio: (result.audioUrls && result.audioUrls.original) || null,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
