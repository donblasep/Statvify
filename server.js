const express = require('express');
const axios = require('axios');
const qs = require('qs');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');

dotenv.config();

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PORT } = process.env;

// Configurar la URI de redirección según el entorno
const REDIRECT_URI = process.env.NODE_ENV === 'production'
    ? 'https://statvify.onrender.com/callback'
    : process.env.REDIRECT_URI;

const app = express();

app.use(express.static('public'));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => {
    const scope = 'user-top-read';
    const authURL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}`;
    res.redirect(authURL);
});

app.get('/callback', async (req, res) => {
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

        const port = PORT || 3000;
        const baseUrl = req.hostname === 'localhost' ? `http://localhost:${port}` : `https://${req.hostname}`;
        res.redirect(`${baseUrl}/8vinyl`);
    } catch (error) {
        console.error('Error obteniendo el token:', error.message);
        res.status(500).send('Error al obtener el token');
    }
});

app.get('/top-albums', async (req, res) => {
    const accessToken = req.cookies.spotify_token;

    if (!accessToken) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const topTracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const albumsMap = new Map();
        topTracksResponse.data.items.forEach(track => {
            const album = track.album;
            const albumId = album.id;

            if (!albumsMap.has(albumId)) {
                albumsMap.set(albumId, {
                    name: album.name,
                    artists: album.artists.map(artist => artist.name).join(', '),
                    cover: album.images[0].url,
                    count: 1,
                });
            } else {
                albumsMap.get(albumId).count++;
            }
        });

        const topAlbums = Array.from(albumsMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        res.json(topAlbums);
    } catch (error) {
        console.error('Error obteniendo los álbumes:', error.message);
        res.status(500).json({ error: 'Error al obtener los álbumes' });
    }
});

app.get('/8vinyl', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vinylfive.html'));
});

app.get('/', (req, res) => {
    const port = PORT || 3000;
    const baseUrl = req.hostname === 'localhost' ? `http://localhost:${port}` : `https://${req.hostname}`;
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
