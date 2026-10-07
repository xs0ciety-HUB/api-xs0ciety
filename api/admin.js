const crypto = require('crypto');
const { redis } = require('./_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

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
};

async function generate(req, res, body) {
    const { email = 'unknown@user.com', quota = 100, days = 30, endpoints = ['*'] } = body;
    const key = 'sk_' + crypto.randomBytes(24).toString('hex');
    const expires_at = Date.now() + days * 24 * 60 * 60 * 1000;
    const info = { email, quota, expires_at, endpoints, created: Date.now() };
    await redis.set(`apikey:${key}`, JSON.stringify(info));
    await redis.sadd('apikeys:all', key);
    return res.json({ success: true, api_key: key, info });
}

async function list(req, res) {
    const keys = await redis.smembers('apikeys:all');
    const out = [];
    for (const k of keys) {
        const raw = await redis.get(`apikey:${k}`);
        if (!raw) continue;
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const used = (await redis.get(`usage:key:${k}:count`)) || 0;
        out.push({ full_key: k, ...info, used: parseInt(used, 10) || 0 });
    }
    return res.json({ success: true, total: out.length, keys: out });
}

async function revoke(req, res, body) {
    const key = body.key || req.query.key;
    if (!key) return res.status(400).json({ success: false, error: 'Parameter "key" wajib' });
    await redis.del(`apikey:${key}`);
    await redis.srem('apikeys:all', key);
    return res.json({ success: true, message: 'Key revoked' });
}

async function topup(req, res, body) {
    const { key, amount = 50, days } = body;
    if (!key || !amount) return res.status(400).json({ success: false, error: 'Butuh "key" dan "amount"' });
    const raw = await redis.get(`apikey:${key}`);
    if (!raw) return res.status(404).json({ success: false, error: 'Key not found' });
    const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
    info.quota += parseInt(amount, 10);
    if (days) info.expires_at = Date.now() + days * 24 * 60 * 60 * 1000;
    await redis.set(`apikey:${key}`, JSON.stringify(info));
    return res.json({ success: true, info });
}
