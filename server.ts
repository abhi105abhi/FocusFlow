import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Needed for audio base64 uploads
  app.use(express.json({ limit: '50mb' }));

  // Google Calendar OAuth Routes
  const getRedirectUri = (req: express.Request) => {
    let protocol = req.headers['x-forwarded-proto'] || (req.hostname === 'localhost' ? 'http' : 'https');
    if (Array.isArray(protocol)) protocol = protocol[0];
    let host = req.headers['x-forwarded-host'] || req.get('host');
    if (Array.isArray(host)) host = host[0];
    return `${protocol}://${host}/api/auth/callback`;
  };

  app.get('/api/auth/url', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: 'OAuth Missing', 
        message: 'To use Google Calendar sync, please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the AI Studio Settings -> Environment Variables.' 
      });
    }

    const redirectUri = getRedirectUri(req);
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      prompt: 'consent'
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    res.json({ url: authUrl });
  });

  app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;
    const redirectUri = getRedirectUri(req);

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      const tokens = await response.json();

      if (!response.ok) {
        console.error("Token exchange failed:", tokens);
        res.status(400).send(`
          <html><body>
            <h2>Authentication Error</h2>
            <p>Failed to exchange token. Check Google Client ID/Secret.</p>
            <pre>${JSON.stringify(tokens, null, 2)}</pre>
          </body></html>
        `);
        return;
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (err) {
      res.status(500).send('OAuth Error');
    }
  });

  // Vite Integration for the SPA
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
