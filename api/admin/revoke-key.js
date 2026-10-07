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
    const key = body?.key || req.query.key;

    if (!key) {
        return res.status(400).json({ success: false, error: 'Parameter "key" wajib' });
    }

    await redis.del(`apikey:${key}`);
    await redis.srem('apikeys:all', key);

    return res.json({ success: true, message: 'Key revoked' });
};
