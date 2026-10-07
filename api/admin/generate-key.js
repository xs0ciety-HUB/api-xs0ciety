const crypto = require('crypto');
const { redis } = require('../_lib/db');

module.exports = async (req, res) => {
    // Proteksi pakai ADMIN_SECRET (env)
    const adminSecret = req.headers['x-admin-secret'] || req.query.secret;
    if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'POST only' });
    }

    const { email, quota = 100, days = 30, endpoints = ['*'] } = req.body || {};

    const key = 'sk_' + crypto.randomBytes(24).toString('hex');
    const expires_at = Date.now() + (days * 24 * 60 * 60 * 1000);

    const info = { email, quota, expires_at, endpoints, created: Date.now() };

    await redis.set(`apikey:${key}`, JSON.stringify(info));

    return res.json({
        success: true,
        api_key: key,
        info,
    });
};
