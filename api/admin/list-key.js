const { redis } = require('../_lib/db');

module.exports = async (req, res) => {
    const secret = req.headers['x-admin-secret'] || req.query.secret;
    if (secret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const keys = await redis.smembers('apikeys:all');
    const list = [];

    for (const k of keys) {
        const raw = await redis.get(`apikey:${k}`);
        if (!raw) continue;
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const used = (await redis.get(`usage:key:${k}:count`)) || 0;
        list.push({
            full_key: k,
            ...info,
            used: parseInt(used, 10) || 0,
        });
    }

    return res.json({ success: true, total: list.length, keys: list });
};
