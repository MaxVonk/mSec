import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserRecord, PublicUser, UserRole } from '../types/phishpilot.js';

const USERS_FILE = path.resolve('.msec_data/users.json');

export class UserStore {
  private static users = new Map<string, UserRecord>();
  private static initialized = false;

  public static init(): void {
    if (this.initialized) return;

    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const list: UserRecord[] = JSON.parse(raw);
        this.users.clear();
        list.forEach(u => this.users.set(u.id, u));
      }
    } catch {
      this.users.clear();
    }

    if (this.users.size === 0) {
      this.bootstrapDefaultAdmin();
    }

    this.initialized = true;
  }

  public static hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  public static verifyPassword(password: string, user: UserRecord): boolean {
    const testHash = this.hashPassword(password, user.salt);
    const bufA = Buffer.from(testHash, 'hex');
    const bufB = Buffer.from(user.passwordHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  private static bootstrapDefaultAdmin(): void {
    const salt = crypto.randomBytes(16).toString('hex');
    const adminUser: UserRecord = {
      id: 'usr-admin-default',
      username: 'admin',
      displayName: 'SecOps Administrator',
      email: 'admin@msec.local',
      role: 'ADMIN',
      passwordHash: this.hashPassword('Admin123!', salt),
      salt,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    this.users.set(adminUser.id, adminUser);
    this.persist();
  }

  public static getAll(): PublicUser[] {
    this.init();
    return Array.from(this.users.values()).map(u => this.toPublic(u));
  }

  public static getById(id: string): UserRecord | undefined {
    this.init();
    return this.users.get(id);
  }

  public static getByUsername(username: string): UserRecord | undefined {
    this.init();
    const clean = username.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === clean) {
        return u;
      }
    }
    return undefined;
  }

  public static create(data: {
    username: string;
    displayName: string;
    email: string;
    role: UserRole;
    password: string;
  }): PublicUser {
    this.init();
    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername) {
      throw new Error('Username cannot be empty.');
    }
    if (this.getByUsername(cleanUsername)) {
      throw new Error(`Username "${data.username}" is already in use.`);
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const user: UserRecord = {
      id: `usr-${crypto.randomUUID()}`,
      username: data.username.trim(),
      displayName: data.displayName.trim() || data.username.trim(),
      email: data.email.trim() || `${data.username.trim()}@company.local`,
      role: data.role || 'ANALYST',
      passwordHash: this.hashPassword(data.password, salt),
      salt,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    this.users.set(user.id, user);
    this.persist();
    return this.toPublic(user);
  }

  public static update(
    id: string,
    updates: {
      displayName?: string;
      email?: string;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
    }
  ): PublicUser {
    this.init();
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found.');
    }

    // Protection: Ensure at least one active ADMIN remains
    if (updates.isActive === false || (updates.role && updates.role !== 'ADMIN')) {
      if (user.role === 'ADMIN') {
        const otherActiveAdmins = Array.from(this.users.values()).filter(
          u => u.id !== id && u.role === 'ADMIN' && u.isActive
        );
        if (otherActiveAdmins.length === 0) {
          throw new Error('Cannot deactivate or demote the only remaining active Administrator.');
        }
      }
    }

    if (updates.displayName !== undefined) user.displayName = updates.displayName.trim();
    if (updates.email !== undefined) user.email = updates.email.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    if (updates.password) {
      if (updates.password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = this.hashPassword(updates.password, user.salt);
    }

    this.persist();
    return this.toPublic(user);
  }

  public static delete(id: string): boolean {
    this.init();
    const user = this.users.get(id);
    if (!user) return false;

    if (user.role === 'ADMIN') {
      const otherActiveAdmins = Array.from(this.users.values()).filter(
        u => u.id !== id && u.role === 'ADMIN' && u.isActive
      );
      if (otherActiveAdmins.length === 0) {
        throw new Error('Cannot delete the last remaining Administrator.');
      }
    }

    this.users.delete(id);
    this.persist();
    return true;
  }

  public static recordLogin(id: string): void {
    this.init();
    const user = this.users.get(id);
    if (user) {
      user.lastLogin = new Date().toISOString();
      this.persist();
    }
  }

  public static toPublic(user: UserRecord): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };
  }

  public static resetToDefault(): void {
    this.users.clear();
    this.bootstrapDefaultAdmin();
  }

  private static persist(): void {
    try {
      fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(this.users.values()), null, 2));
    } catch {
      // Ignore write errors in memory
    }
  }
}
