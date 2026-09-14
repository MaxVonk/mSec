import { Router } from 'express';
import { AuthService } from '../services/authService.js';
import { UserStore } from '../services/userStore.js';

const router = Router();

function getSessionId(req: any): string | undefined {
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/msec_session=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
  }
  return undefined;
}

// 1. Password Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  try {
    const { sessionId, user } = AuthService.loginWithPassword(username, password);

    res.cookie('msec_session', sessionId, {
      httpOnly: true,
      secure: req.protocol === 'https',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ success: true, sessionId, user });
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Change Password (required on first login or user self-service)
router.post('/change-password', (req, res) => {
  const sessionId = getSessionId(req);
  const currentUser = AuthService.getSession(sessionId);

  let targetUserId = currentUser.isAuthenticated ? currentUser.id : undefined;

  // Fallback: If session cookie was not attached but valid username + currentPassword is provided
  if (!targetUserId && req.body.username) {
    const userRecord = UserStore.getByUsername(req.body.username);
    if (userRecord && UserStore.verifyPassword(req.body.currentPassword, userRecord)) {
      targetUserId = userRecord.id;
    }
  }

  if (!targetUserId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  try {
    const updatedUser = AuthService.changePassword(targetUserId, currentPassword, newPassword);
    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

function getOrigin(req: any): string {
  let origin = (process.env.APP_URL || '').trim();
  if (!origin) {
    origin = `${req.protocol}://${req.get('host')}`;
  }
  if (!/^https?:\/\//i.test(origin)) {
    origin = `https://${origin}`;
  }
  return origin;
}

// 2. Microsoft SSO Login
router.get('/microsoft', (req, res) => {
  try {
    const origin = getOrigin(req);
    const { url } = AuthService.generateAuthUrl(origin);
    res.redirect(url);
  } catch (err: any) {
    res.status(400).send(`Authentication setup error: ${err.message}`);
  }
});

// Legacy SSO redirect endpoint
router.get('/login', (req, res) => {
  res.redirect('/api/auth/microsoft');
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
    const origin = getOrigin(req);
    const { sessionId } = await AuthService.handleCallback(String(code), String(state), origin);

    res.cookie('msec_session', sessionId, {
      httpOnly: true,
      secure: req.protocol === 'https',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.redirect('/');
  } catch (err: any) {
    res.status(500).send(`Failed to complete Microsoft login: ${err.message}`);
  }
});

// 3. Current User Profile
router.get('/me', (req, res) => {
  const sessionId = getSessionId(req);
  const user = AuthService.getSession(sessionId);
  res.json(user);
});

// 4. Logout
router.post('/logout', (req, res) => {
  const sessionId = getSessionId(req);
  if (sessionId) {
    AuthService.destroySession(sessionId);
  }
  res.clearCookie('msec_session');
  res.json({ success: true, message: 'Logged out' });
});

// 5. User Management API (Admin / Authorized Users)
export const userRouter = Router();

userRouter.get('/', (req, res) => {
  const sessionId = getSessionId(req);
  const currentUser = AuthService.getSession(sessionId);

  // In authenticated sessions, only allow ADMIN
  if (currentUser.isAuthenticated && currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Administrator role required.' });
  }

  res.json(UserStore.getAll());
});

userRouter.post('/', (req, res) => {
  const sessionId = getSessionId(req);
  const currentUser = AuthService.getSession(sessionId);

  if (currentUser.isAuthenticated && currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Administrator role required.' });
  }

  try {
    const user = UserStore.create(req.body);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

userRouter.patch('/:id', (req, res) => {
  const sessionId = getSessionId(req);
  const currentUser = AuthService.getSession(sessionId);

  const isSelf = currentUser.isAuthenticated && currentUser.id === req.params.id;
  const isAdmin = currentUser.role === 'ADMIN' || !currentUser.isAuthenticated;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const updatePayload = isAdmin ? req.body : {
      password: req.body.password,
      displayName: req.body.displayName
    };
    const updated = UserStore.update(req.params.id, updatePayload);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

userRouter.delete('/:id', (req, res) => {
  const sessionId = getSessionId(req);
  const currentUser = AuthService.getSession(sessionId);

  if (currentUser.isAuthenticated && currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied: Administrator role required.' });
  }

  try {
    const deleted = UserStore.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ success: true, message: 'User deleted.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Mount userRouter inside authRoutes so /api/auth/users works
router.use('/users', userRouter);

export default router;
