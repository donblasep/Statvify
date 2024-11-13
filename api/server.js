const axios = require('axios');
const qs = require('qs');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, REDIRECT_URI } = process.env;

// Esta es una función de Vercel (Serverless Function)
module.exports = async (req, res) => {
    const { method } = req;
    
    if (method === 'GET' && req.url === '/login') {
        const scope = 'user-top-read';
        const authURL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}`;
        res.redirect(authURL);
    } else if (method === 'GET' && req.url === '/callback') {
        const code = req.query.code || null;

        try {
            const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', qs.stringify({
                code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
                },
            });

            const accessToken = tokenResponse.data.access_token;

            // Guardar el token en una cookie HTTP-Only
            res.cookie('spotify_token', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3600000, // 1 hora
            });

            res.redirect('/8vinyl');
        } catch (error) {
            console.error('Error obteniendo el token:', error.message);
            res.status(500).send('Error al obtener el token');
        }
    } else {
        res.status(404).send('Route not found');
    }
};
