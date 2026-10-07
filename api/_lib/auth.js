const { redis } = require('./db');

async function validateApiKey(req, res, endpointName) {
    const key =
        req.headers['x-api-key'] ||
        req.query.apikey ||
        req.query.api_key ||
        (req.body && req.body.apikey);

    if (!key) {
        res.status(401).json({ success: false, error: 'API key wajib. Kirim via header "x-api-key" atau ?apikey=' });
        return null;
    }

    const raw = await redis.get(`apikey:${key}`);
    if (!raw) {
        res.status(401).json({ success: false, error: 'API key tidak valid' });
        return null;
    }

    const info = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (info.expires_at && Date.now() > info.expires_at) {
        res.status(403).json({ success: false, error: 'API key expired' });
        return null;
    }

    if (info.quota <= 0) {
        res.status(429).json({ success: false, error: 'Kuota habis' });
        return null;
    }

    if (info.endpoints && !info.endpoints.includes('*') && !info.endpoints.includes(endpointName)) {
        res.status(403).json({ success: false, error: `Endpoint "${endpointName}" tidak diizinkan` });
        return null;
    }

    info.quota -= 1;
    await redis.set(`apikey:${key}`, JSON.stringify(info));
    await redis.incr(`usage:key:${key}:count`);

    res.setHeader('X-Quota-Remaining', info.quota);
    return { key, info };
}

module.exports = { validateApiKey };
