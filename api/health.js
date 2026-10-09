module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    return res.json({
        success: true,
        status: 'ok',
        service: 'xs0cietyHUB Download API',
        version: '2.0.0',
        timestamp: Date.now(),
        uptime: Math.round(process.uptime()),
        region: process.env.VERCEL_REGION || 'unknown',
        node: process.version,
    });
};
