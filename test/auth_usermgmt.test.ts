import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { UserStore } from '../server/services/userStore.js';
import { AuthService } from '../server/services/authService.js';

describe('Authentication & User Management Suite Tests', () => {
  beforeEach(() => {
    UserStore.resetToDefault();
  });

  describe('UserStore & Password Security', () => {
    it('should bootstrap default admin account on start', () => {
      const users = UserStore.getAll();
      assert.ok(users.length >= 1, 'Should contain at least the default admin');

      const admin = UserStore.getByUsername('admin');
      assert.ok(admin, 'Admin account must exist');
      assert.strictEqual(admin.role, 'ADMIN');
      assert.strictEqual(admin.isActive, true);
      assert.ok(admin.passwordHash, 'Admin must have a password hash');
      assert.ok(admin.salt, 'Admin must have a unique cryptographic salt');

      // Verify default password
      assert.strictEqual(UserStore.verifyPassword('Admin123!', admin), true);
      assert.strictEqual(UserStore.verifyPassword('WrongPassword', admin), false);
    });

    it('should hash passwords uniquely with random salts', () => {
      const salt1 = 'salt11111111111111111111111111111111';
      const salt2 = 'salt22222222222222222222222222222222';
      const hash1 = UserStore.hashPassword('Secret123!', salt1);
      const hash2 = UserStore.hashPassword('Secret123!', salt2);

      assert.notStrictEqual(hash1, hash2, 'Same password with different salts must produce different hashes');
    });

    it('should create a new analyst user and omit sensitive fields in public view', () => {
      const newUser = UserStore.create({
        username: 'analyst_bob',
        displayName: 'Bob Smith',
        email: 'bob@soc.local',
        role: 'ANALYST',
        password: 'Password999!'
      });

      assert.strictEqual(newUser.username, 'analyst_bob');
      assert.strictEqual(newUser.role, 'ANALYST');
      assert.strictEqual(newUser.isActive, true);
      assert.strictEqual((newUser as any).passwordHash, undefined, 'PublicUser must not expose passwordHash');
      assert.strictEqual((newUser as any).salt, undefined, 'PublicUser must not expose salt');

      const raw = UserStore.getById(newUser.id);
      assert.ok(raw);
      assert.strictEqual(UserStore.verifyPassword('Password999!', raw), true);
    });

    it('should reject duplicate usernames', () => {
      assert.throws(() => {
        UserStore.create({
          username: 'admin',
          displayName: 'Duplicate Admin',
          email: 'admin2@soc.local',
          role: 'ADMIN',
          password: 'Password123!'
        });
      }, /already in use/);
    });

    it('should update user role, display name, and password', () => {
      const user = UserStore.create({
        username: 'analyst_carol',
        displayName: 'Carol Danvers',
        email: 'carol@soc.local',
        role: 'ANALYST',
        password: 'Password123!'
      });

      const updated = UserStore.update(user.id, {
        role: 'READONLY',
        displayName: 'Carol Danvers (Auditor)',
        password: 'NewPassword456!'
      });

      assert.strictEqual(updated.role, 'READONLY');
      assert.strictEqual(updated.displayName, 'Carol Danvers (Auditor)');

      const raw = UserStore.getById(user.id);
      assert.ok(raw);
      assert.strictEqual(UserStore.verifyPassword('NewPassword456!', raw), true);
      assert.strictEqual(UserStore.verifyPassword('Password123!', raw), false);
    });

    it('should prevent deactivating or deleting the sole administrator', () => {
      const admin = UserStore.getByUsername('admin')!;

      assert.throws(() => {
        UserStore.update(admin.id, { isActive: false });
      }, /only remaining active Administrator/);

      assert.throws(() => {
        UserStore.delete(admin.id);
      }, /last remaining Administrator/);
    });
  });

  describe('AuthService Credentials & Session Management', () => {
    it('should authenticate valid credentials and issue active session', () => {
      const result = AuthService.loginWithPassword('admin', 'Admin123!');
      assert.ok(result.sessionId, 'Must return a session token');
      assert.strictEqual(result.user.username, 'admin');
      assert.strictEqual(result.user.role, 'ADMIN');
      assert.strictEqual(result.user.isAuthenticated, true);

      // Verify session can be retrieved
      const session = AuthService.getSession(result.sessionId);
      assert.strictEqual(session.isAuthenticated, true);
      assert.strictEqual(session.username, 'admin');
      assert.strictEqual(session.role, 'ADMIN');
    });

    it('should reject invalid passwords and non-existent usernames', () => {
      assert.throws(() => {
        AuthService.loginWithPassword('admin', 'IncorrectPass!');
      }, /Invalid username or password/);

      assert.throws(() => {
        AuthService.loginWithPassword('unknown_user', 'AnyPassword123!');
      }, /Invalid username or password/);
    });

    it('should reject authentication for disabled users', () => {
      const user = UserStore.create({
        username: 'disabled_user',
        displayName: 'Disabled User',
        email: 'disabled@soc.local',
        role: 'ANALYST',
        password: 'TestPassword123!'
      });

      UserStore.update(user.id, { isActive: false });

      assert.throws(() => {
        AuthService.loginWithPassword('disabled_user', 'TestPassword123!');
      }, /disabled/);
    });

    it('should destroy session on logout', () => {
      const { sessionId } = AuthService.loginWithPassword('admin', 'Admin123!');
      assert.strictEqual(AuthService.getSession(sessionId).isAuthenticated, true);

      AuthService.destroySession(sessionId);
      assert.strictEqual(AuthService.getSession(sessionId).isAuthenticated, false);
    });
  });
});

