const { redis } = require('./db');

async function validateApiKey(req, res, endpointName) {
    // Ambil key dari header atau query
    const key = req.headers['x-api-key'] 
             || req.query.apikey 
             || req.query.api_key;

    if (!key) {
        res.status(401).json({
            success: false,
            error: 'API key wajib. Kirim via header "x-api-key" atau ?apikey='
        });
        return null;
    }

    // Cek di Redis
    const data = await redis.get(`apikey:${key}`);
    if (!data) {
        res.status(401).json({ success: false, error: 'API key tidak valid' });
        return null;
    }

    const info = typeof data === 'string' ? JSON.parse(data) : data;

    // Cek expired
    if (info.expires_at && Date.now() > info.expires_at) {
        res.status(403).json({ success: false, error: 'API key expired' });
        return null;
    }

    // Cek kuota
    if (info.quota <= 0) {
        res.status(429).json({ 
            success: false, 
            error: 'Kuota habis. Hubungi admin buat top-up.' 
        });
        return null;
    }

    // Cek endpoint allowed
    if (info.endpoints && !info.endpoints.includes('*') 
        && !info.endpoints.includes(endpointName)) {
        res.status(403).json({ 
            success: false, 
            error: `Endpoint "${endpointName}" gak diizinkan buat key ini` 
        });
        return null;
    }

    // Kurangi kuota (atomic)
    await redis.decr(`apikey:${key}:used`);

    // Update info kuota
    info.quota -= 1;
    await redis.set(`apikey:${key}`, JSON.stringify(info));

    return { key, info };
}

module.exports = { validateApiKey };
