import { Router } from 'express';
import { AuthService } from '../services/authService.js';

const router = Router();

router.get('/login', (req, res) => {
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const { url } = AuthService.generateAuthUrl(origin);
    res.redirect(url);
  } catch (err: any) {
    res.status(400).send(`Authentication setup error: ${err.message}`);
  }
});

router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`Microsoft SSO Error: ${error} - ${error_description}`);
  }

  if (!code || !state) {
    return res.status(400).send('Missing authorization code or state parameter.');
  }

  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const { sessionId } = await AuthService.handleCallback(String(code), String(state), origin);

    // Set secure cookie for session
    res.cookie('msec_session', sessionId, {
      httpOnly: true,
      secure: req.protocol === 'https',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Redirect to home dashboard
    res.redirect('/');
  } catch (err: any) {
    res.status(500).send(`Failed to complete Microsoft login: ${err.message}`);
  }
});

router.get('/me', (req, res) => {
  // Read session from cookie or Authorization header
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;
  let sessionId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionId = authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/msec_session=([a-zA-Z0-9_-]+)/);
    if (match) sessionId = match[1];
  }

  const user = AuthService.getSession(sessionId);
  res.json(user);
});

router.post('/logout', (req, res) => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/msec_session=([a-zA-Z0-9_-]+)/);
    if (match) AuthService.destroySession(match[1]);
  }
  res.clearCookie('msec_session');
  res.json({ success: true, message: 'Logged out' });
});

export default router;

