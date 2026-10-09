const crypto = require('crypto');
const { redis } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
        const secret = req.headers['x-admin-secret'] || req.query.secret;
        if (secret !== process.env.ADMIN_SECRET) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch { body = {}; }
        }
        body = body || {};

        const action = req.query.action || body.action;

        if (action === 'generate') return await generate(req, res, body);
        if (action === 'list')     return await list(req, res);
        if (action === 'revoke')   return await revoke(req, res, body);
        if (action === 'topup')    return await topup(req, res, body);

        return res.json({
            success: true,
            info: 'Admin API',
            actions: ['generate', 'list', 'revoke', 'topup'],
            usage: 'GET/POST /api/admin?action=generate&secret=XXX',
        });
    } catch (err) {
        console.error('[admin] error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Server error',
        });
    }
};

/* =================================================================
   GENERATE — Bikin API key baru
   Body: { email, quota, days, endpoints }
================================================================= */
async function generate(req, res, body) {
    const {
        email = 'unknown@user.com',
        quota = 100,
        days = 30,
        endpoints = ['*']
    } = body;

    const key = 'sk_' + crypto.randomBytes(24).toString('hex');
    const expires_at = Date.now() + days * 24 * 60 * 60 * 1000;

    const info = {
        email,
        quota: parseInt(quota, 10),
        expires_at,
        endpoints,
        created: Date.now(),
    };

    await redis.set(`apikey:${key}`, JSON.stringify(info));
    await redis.sadd('apikeys:all', key);

    return res.json({ success: true, api_key: key, info });
}

/* =================================================================
   LIST — Daftar semua API key
================================================================= */
async function list(req, res) {
    const keys = await redis.smembers('apikeys:all');
    const out = [];

    for (const k of keys) {
        const raw = await redis.get(`apikey:${k}`);
        if (!raw) continue;

        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const used = (await redis.get(`usage:key:${k}:count`)) || 0;

        out.push({
            full_key: k,
            ...info,
            used: parseInt(used, 10) || 0,
        });
    }

    // Sort: yang paling baru di atas
    out.sort((a, b) => (b.created || 0) - (a.created || 0));

    return res.json({ success: true, total: out.length, keys: out });
}

/* =================================================================
   REVOKE — Hapus API key permanen
   Body: { key }
================================================================= */
async function revoke(req, res, body) {
    const key = body.key || req.query.key;
    if (!key) {
        return res.status(400).json({ success: false, error: 'Parameter "key" wajib' });
    }

    const raw = await redis.get(`apikey:${key}`);
    if (!raw) {
        return res.status(404).json({ success: false, error: 'Key tidak ditemukan' });
    }

    await redis.del(`apikey:${key}`);
    await redis.srem('apikeys:all', key);

    return res.json({ success: true, message: 'Key revoked' });
}

/* =================================================================
   TOPUP — Nambah kuota &/atau perpanjang expired
   Body: { key, amount?, days? }
   - amount: jumlah kuota yang ditambah (opsional)
   - days  : jumlah hari perpanjangan (opsional)
   Minimal salah satu harus ada.
================================================================= */
async function topup(req, res, body) {
    const { key, amount, days } = body;

    // Validasi key
    if (!key) {
        return res.status(400).json({
            success: false,
            error: 'Parameter "key" wajib'
        });
    }

    // Validasi: minimal isi amount atau days
    const hasAmount = amount !== undefined && amount !== null && amount !== '';
    const hasDays   = days   !== undefined && days   !== null && days   !== '';

    if (!hasAmount && !hasDays) {
        return res.status(400).json({
            success: false,
            error: 'Isi minimal "amount" (kuota) atau "days" (perpanjangan)'
        });
    }

    const parsedAmount = hasAmount ? parseInt(amount, 10) : 0;
    const parsedDays   = hasDays   ? parseInt(days, 10)   : 0;

    if (hasAmount && (isNaN(parsedAmount) || parsedAmount < 0)) {
        return res.status(400).json({
            success: false,
            error: '"amount" harus angka ≥ 0'
        });
    }

    if (hasDays && (isNaN(parsedDays) || parsedDays < 0)) {
        return res.status(400).json({
            success: false,
            error: '"days" harus angka ≥ 0'
        });
    }

    // Ambil data key
    const raw = await redis.get(`apikey:${key}`);
    if (!raw) {
        return res.status(404).json({ success: false, error: 'Key tidak ditemukan' });
    }

    const info = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const before = {
        quota: info.quota,
        expires_at: info.expires_at,
    };

    // Tambah kuota
    if (parsedAmount > 0) {
        info.quota = (info.quota || 0) + parsedAmount;
    }

    // Perpanjang expired
    // Kalau expired lama masih berlaku → nambah dari tanggal itu
    // Kalau udah lewat → mulai dari sekarang
    if (parsedDays > 0) {
        const now = Date.now();
        const baseTime = (info.expires_at && info.expires_at > now)
            ? info.expires_at
            : now;

        info.expires_at = baseTime + parsedDays * 24 * 60 * 60 * 1000;
    }

    info.last_topup = Date.now();

    await redis.set(`apikey:${key}`, JSON.stringify(info));

    return res.json({
        success: true,
        message: 'Topup berhasil',
        before,
        info,
    });
}
