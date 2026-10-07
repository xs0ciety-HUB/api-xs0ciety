const crypto = require('crypto');
const { redis } = require('../_lib/db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const secret = req.headers['x-admin-secret'] || req.query.secret;
    if (secret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'POST only' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const {
        email = 'unknown@user.com',
        quota = 100,
        days = 30,
        endpoints = ['*'],
    } = body;

    const key = 'sk_' + crypto.randomBytes(24).toString('hex');
    const expires_at = Date.now() + days * 24 * 60 * 60 * 1000;

    const info = { email, quota, expires_at, endpoints, created: Date.now() };

    await redis.set(`apikey:${key}`, JSON.stringify(info));
    await redis.sadd('apikeys:all', key);

    return res.json({ success: true, api_key: key, info });
};
