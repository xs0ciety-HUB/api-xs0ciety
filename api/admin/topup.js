const { redis } = require('../_lib/db');

module.exports = async (req, res) => {
    const secret = req.headers['x-admin-secret'] || req.query.secret;
    if (secret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { key, amount = 50, days } = body || {};

    if (!key || !amount) {
        return res.status(400).json({ success: false, error: 'Butuh "key" dan "amount"' });
    }

    const raw = await redis.get(`apikey:${key}`);
    if (!raw) return res.status(404).json({ success: false, error: 'Key not found' });

    const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
    info.quota += parseInt(amount, 10);
    if (days) info.expires_at = Date.now() + days * 24 * 60 * 60 * 1000;

    await redis.set(`apikey:${key}`, JSON.stringify(info));

    return res.json({ success: true, info });
};
