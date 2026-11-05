import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getDbCollection } from '../db.js';
import { getConfig } from '../config.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeUserSessions,
  authenticateToken,
  verifyTokenString,
  recordAuditLog,
  getImpersonatorId,
  AuthenticatedRequest,
} from '../auth.js';
import { validateBody, LoginSchema, ChangePasswordSchema } from '../validation.js';
import { User, Employee, Role, UserRole } from '../../src/types/index.js';

export const authRouter = express.Router();

// ---------------------------------------------------------------------------
// In-memory failed-login tracker (per IP, auto-purges after 15 min window)
// Max attempts matches the rate limiter cap in server.ts (10 per 15 min)
// ---------------------------------------------------------------------------
const MAX_LOGIN_ATTEMPTS = 10;
const WARN_AFTER_FAILURES = 2; // start showing warning after this many failures
interface FailEntry { count: number; firstFailAt: number; }
const loginFailMap = new Map<string, FailEntry>();

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function recordFailure(ip: string): number {
  const now = Date.now();
  const entry = loginFailMap.get(ip);
  if (!entry || now - entry.firstFailAt > 15 * 60 * 1000) {
    // Fresh window
    loginFailMap.set(ip, { count: 1, firstFailAt: now });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function clearFailures(ip: string) {
  loginFailMap.delete(ip);
}

// Hash of a random throwaway string; compared against when the account doesn't exist.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(`unused-${Date.now()}-${Math.random()}`, 10);

/**
 * POST /api/auth/login
 * Authenticates user by email and password with runtime input validation and token lifecycle support
 */
authRouter.post('/login', validateBody(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ip = getClientIp(req);

    const usersCol = getDbCollection('users');
    // Sign in with a work email or an employee code. Either way the account must already exist:
    // accounts are provisioned by HR (employee create / bulk import) or the backfill script,
    // never implicitly at login.
    const identifier = String(email).trim();
    let user = null;
    if (identifier.includes('@')) {
      user = await usersCol.findOne({ email: identifier.toLowerCase() });
    } else {
      const emp = await getDbCollection('employees').findOne({ employeeCode: identifier.toUpperCase() });
      if (emp) user = await usersCol.findOne({ employeeId: emp.id });
    }

    if (!user) {
      // Equalise response time with the wrong-password path so account existence isn't leaked.
      bcrypt.compareSync(password, DUMMY_BCRYPT_HASH);
      const failCount = recordFailure(ip);
      const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - failCount);
      console.warn(`[Auth] Login failed: User "${email}" not found from IP: ${ip} (Failed attempts: ${failCount}/${MAX_LOGIN_ATTEMPTS})`);
      const payload: Record<string, any> = { error: 'Invalid email or password.' };
      if (failCount >= WARN_AFTER_FAILURES) payload.remainingAttempts = remainingAttempts;
      return res.status(401).json(payload);
    }

    if (!user.active) {
      console.warn(`[Auth] Login blocked: Deactivated account "${user.email}" from IP: ${ip}`);
      return res.status(403).json({ error: 'Account is deactivated. Contact system administrator.' });
    }

    // Strict cryptographic verification against user's stored bcrypt hash
    const isPasswordValid = Boolean(user.passwordHash && bcrypt.compareSync(password, user.passwordHash));
    if (!isPasswordValid) {
      const failCount = recordFailure(ip);
      const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - failCount);
      console.warn(`[Auth] Login failed: Incorrect password for "${user.email}" from IP: ${ip} (Failed attempts: ${failCount}/${MAX_LOGIN_ATTEMPTS})`);
      const payload: Record<string, any> = { error: 'Invalid email or password.' };
      if (failCount >= WARN_AFTER_FAILURES) payload.remainingAttempts = remainingAttempts;
      return res.status(401).json(payload);
    }

    // ✅ Successful login — clear the fail counter
    clearFailures(ip);

    const tokenVersion = user.tokenVersion ?? 1;
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, tokenVersion);

    // Update last login and ensure tokenVersion is stored
    await usersCol.updateOne(
      { id: user.id },
      {
        $set: {
          lastLoginAt: new Date().toISOString(),
          tokenVersion: tokenVersion,
        },
      }
    );

    // Fetch employee profile if exists
    let employeeProfile: Employee | null = null;
    if (user.employeeId) {
      const employeesCol = getDbCollection('employees');
      employeeProfile = await employeesCol.findOne({ id: user.employeeId });
    }

    // Fetch role permissions
    const rolesCol = getDbCollection('roles');
    const roleRecord: Role | null = await rolesCol.findOne({ roleName: user.role });

    // Record login audit log
    await recordAuditLog(
      user.id,
      user.name,
      user.role,
      'AUTHENTICATION',
      'USER_LOGIN',
      user.id,
      '',
      user.role,
      `User ${user.email} logged in successfully`
    );

    console.log(`[Auth] Successful login: "${user.name}" (${user.email}) [Role: ${user.role}]`);

    const safeUser: User = {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role,
      roleId: user.roleId,
      active: user.active,
      avatarUrl: user.avatarUrl,
      lastLoginAt: new Date().toISOString(),
      mustChangePassword: (user as any).mustChangePassword,
      tokenVersion: tokenVersion,
      createdAt: user.createdAt,
    };

    res.json({
      token,
      refreshToken,
      user: safeUser,
      employeeProfile,
      permissions: roleRecord ? roleRecord.permissions : [],
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});


/**
 * GET /api/auth/me
 * Retrieves current authenticated user session
 */
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const safeUser: User = {
    id: req.user.id,
    employeeId: req.user.employeeId,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    roleId: req.user.roleId,
    active: req.user.active,
    avatarUrl: req.user.avatarUrl,
    lastLoginAt: req.user.lastLoginAt,
    mustChangePassword: (req.user as any).mustChangePassword ?? false,
    tokenVersion: req.user.tokenVersion,
    createdAt: req.user.createdAt,
  };

  res.json({
    user: safeUser,
    employeeProfile: req.employeeProfile || null,
    permissions: req.permissions || [],
  });
});

// ---------------------------------------------------------------------------
// Demo persona switcher (staging / local only)
//
// Fail-closed: both endpoints answer 404 unless ENABLE_DEMO_PERSONAS=true, and they always
// require an authenticated SUPER_ADMIN — or a persona session that a SUPER_ADMIN started,
// identified by the impersonatorId claim, so the admin can switch back.
// ---------------------------------------------------------------------------
async function requireDemoPersonaAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!getConfig().ENABLE_DEMO_PERSONAS) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role === 'SUPER_ADMIN') {
    res.locals.adminId = req.user.id;
    return next();
  }
  const impersonatorId = getImpersonatorId(req.headers['authorization']?.split(' ')[1]);
  if (impersonatorId) {
    const admin = await getDbCollection('users').findOne({ id: impersonatorId });
    if (admin && admin.active !== false && admin.role === 'SUPER_ADMIN') {
      res.locals.adminId = admin.id;
      return next();
    }
  }
  return res.status(403).json({ error: 'Forbidden: persona switching requires a Super Admin session.' });
}

const ROLE_ALIASES: Record<string, UserRole> = {
  ADMIN: 'SUPER_ADMIN', SUPERADMIN: 'SUPER_ADMIN', SYSTEMADMIN: 'SUPER_ADMIN',
  HR: 'HR', HRMANAGER: 'HR', HRLEAD: 'HR', HRBP: 'HR', HRADMIN: 'HR', HUMANRESOURCES: 'HR',
  MGR: 'MANAGER', MANAGER: 'MANAGER', REPORTINGMANAGER: 'MANAGER', ENGMANAGER: 'MANAGER',
  HIRINGMANAGER: 'MANAGER', TAMANAGER: 'MANAGER',
  HOD: 'HOD', HEADOFORGANIZATION: 'HOD', HEADOFORGANISATION: 'HOD', HEADOFDEPARTMENT: 'HOD',
  DEPTHEAD: 'HOD', DEPARTMENTHEAD: 'HOD',
  EMPLOYEE: 'EMPLOYEE', DEV: 'EMPLOYEE', STAFF: 'EMPLOYEE', INDIVIDUALCONTRIBUTOR: 'EMPLOYEE', USER: 'EMPLOYEE',
  MANAGEMENT: 'MANAGEMENT', MGMT: 'MANAGEMENT', EXECUTIVE: 'MANAGEMENT', EXEC: 'MANAGEMENT',
  COO: 'MANAGEMENT', CEO: 'MANAGEMENT',
};

function normalizeRole(role: unknown): UserRole | null {
  if (typeof role !== 'string') return null;
  return ROLE_ALIASES[role.trim().toUpperCase().replace(/[\s\-_]+/g, '')] || null;
}

/**
 * GET /api/auth/demo-users
 * Lists active accounts for the staging persona switcher.
 */
authRouter.get(
  '/demo-users',
  authenticateToken,
  requireDemoPersonaAccess,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await (await getDbCollection('users').find({ active: true })).toArray();
      res.json(
        users.map((u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role, employeeId: u.employeeId }))
      );
    } catch {
      res.status(500).json({ error: 'Failed to fetch demo personas.' });
    }
  }
);

/**
 * POST /api/auth/switch-role
 * Issues a session for an existing account (by userId, or the first active account holding
 * the requested role). Never creates accounts and never falls back to another role.
 */
authRouter.post(
  '/switch-role',
  authenticateToken,
  requireDemoPersonaAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role, userId } = req.body || {};
      const adminId: string = res.locals.adminId;
      const usersCol = getDbCollection('users');

      let targetUser: any = null;
      if (typeof userId === 'string' && userId.trim()) {
        const id = userId.trim();
        targetUser = await usersCol.findOne({
          $or: [{ id }, { employeeId: id }, { email: id.toLowerCase() }],
        });
      } else {
        const targetRole = normalizeRole(role);
        if (!targetRole) {
          return res.status(400).json({ error: 'A valid role or userId is required.' });
        }
        targetUser = targetRole === 'SUPER_ADMIN'
          ? await usersCol.findOne({ id: adminId })
          : await usersCol.findOne({ role: targetRole, active: true });
      }

      if (!targetUser || targetUser.active === false) {
        return res.status(404).json({ error: 'No active account found for the requested persona.' });
      }

      // Returning to the admin's own account ends the impersonation.
      const tokenOpts = targetUser.id === adminId ? {} : { impersonatorId: adminId };
      const tokenVersion = targetUser.tokenVersion ?? 1;
      const token = generateAccessToken(targetUser, tokenOpts);
      const refreshToken = generateRefreshToken(targetUser, tokenVersion, tokenOpts);

      const employeeProfile: Employee | null = targetUser.employeeId
        ? await getDbCollection('employees').findOne({ id: targetUser.employeeId })
        : null;
      const roleRecord: Role | null = await getDbCollection('roles').findOne({ roleName: targetUser.role });

      await recordAuditLog(
        adminId,
        req.user!.name,
        req.user!.role,
        'AUTHENTICATION',
        'PERSONA_SWITCH',
        targetUser.id,
        req.user!.id,
        targetUser.id,
        `Demo persona switch to ${targetUser.email} (${targetUser.role}) by admin ${adminId}`
      );

      const safeUser: User = {
        id: targetUser.id,
        employeeId: targetUser.employeeId,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        roleId: targetUser.roleId,
        active: targetUser.active ?? true,
        avatarUrl: targetUser.avatarUrl,
        lastLoginAt: new Date().toISOString(),
        tokenVersion,
        createdAt: targetUser.createdAt,
      };

      res.json({
        token,
        refreshToken,
        user: safeUser,
        employeeProfile,
        permissions: roleRecord ? roleRecord.permissions : [],
      });
    } catch (error: any) {
      console.error('Failed to switch role:', error);
      res.status(500).json({ error: 'Failed to switch role.' });
    }
  }
);


/**
 * POST /api/auth/logout
 * Invalidates session and revokes refresh tokens on logout
 */
authRouter.post('/logout', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      const user = await verifyTokenString(token);
      if (user) {
        // Invalidate active session tokens on logout
        await revokeUserSessions(user.id);
        await recordAuditLog(
          user.id,
          user.name,
          user.role,
          'AUTHENTICATION',
          'USER_LOGOUT',
          user.id,
          '',
          '',
          `User ${user.email} logged out (sessions invalidated)`
        );
      }
    }
  } catch (err) {
    // quiet fallback
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * POST /api/auth/refresh
 * Exchanges a valid, unrevoked Refresh Token for a fresh short-lived Access Token
 * and rotated Refresh Token. Only genuine refresh tokens are accepted.
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const refreshToken = req.body?.refreshToken || headerToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required.' });
    }

    // Verify as a dedicated refresh token (signature, type and tokenVersion revocation)
    const refreshResult = await verifyRefreshToken(refreshToken);
    const user: User | null = refreshResult?.user || null;

    if (!user || user.active === false) {
      console.warn('[Auth] Token refresh failed: Session has expired or been revoked');
      return res.status(401).json({
        error: 'Your session has expired or has been revoked. Please sign in again.',
        code: 'SESSION_REVOKED',
      });
    }

    console.log(`[Auth] Session refreshed for "${user.name}" (${user.email}) [Role: ${user.role}]`);

    const currentVersion = user.tokenVersion ?? 1;
    const tokenOpts = refreshResult?.impersonatorId ? { impersonatorId: refreshResult.impersonatorId } : {};
    const newAccessToken = generateAccessToken(user, tokenOpts);
    const newRefreshToken = generateRefreshToken(user, currentVersion, tokenOpts);

    // Fetch employee profile if exists
    let employeeProfile: Employee | null = null;
    if (user.employeeId) {
      const employeesCol = getDbCollection('employees');
      try {
        employeeProfile = await employeesCol.findOne({ id: user.employeeId });
      } catch { /* ignore */ }
    }

    const rolesCol = getDbCollection('roles');
    let roleRecord: Role | null = null;
    try {
      roleRecord = await rolesCol.findOne({ roleName: user.role });
    } catch { /* ignore */ }

    const safeUser: User = {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role,
      roleId: user.roleId,
      active: user.active,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt,
      mustChangePassword: (user as any).mustChangePassword,
      tokenVersion: currentVersion,
      createdAt: user.createdAt,
    };

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: safeUser,
      employeeProfile,
      permissions: roleRecord ? roleRecord.permissions : [],
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token.' });
  }
});

/**
 * POST /api/auth/revoke-sessions
 * Terminates all active sessions across all devices for the calling user,
 * or for a target employee if called by a SUPER_ADMIN / HR.
 */
authRouter.post('/revoke-sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const targetUserId = req.body?.userId;
    let userIdToRevoke = req.user.id;

    if (targetUserId && targetUserId !== req.user.id) {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'HR') {
        return res.status(403).json({ error: 'Only administrators can revoke sessions of other users.' });
      }
      userIdToRevoke = targetUserId;
    }

    await revokeUserSessions(userIdToRevoke);

    await recordAuditLog(
      req.user.id,
      req.user.name,
      req.user.role,
      'AUTHENTICATION',
      'SESSIONS_REVOKED',
      userIdToRevoke,
      '',
      '',
      `All active sessions revoked for user ${userIdToRevoke} by ${req.user.email}`
    );

    res.json({
      success: true,
      message: 'All active sessions have been revoked successfully across all devices.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to revoke sessions.' });
  }
});

/**
 * PUT /api/auth/change-password
 * Allows an authenticated user to change their password with Zod validation.
 * Clears mustChangePassword flag and revokes all old sessions across all devices.
 */
authRouter.put(
  '/change-password',
  authenticateToken,
  validateBody(ChangePasswordSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { newPassword } = req.body;

      // Reject common/weak passwords
      const forbidden = ['password123', 'Welcome@2026', 'password', '12345678', 'admin123'];
      if (forbidden.includes(newPassword.toLowerCase())) {
        return res.status(400).json({ error: 'This password is too common. Please choose a stronger password.' });
      }

      const usersCol = getDbCollection('users');
      const passwordHash = bcrypt.hashSync(newPassword, 12);

      // Increment tokenVersion by 1 to invalidate all old active sessions across all devices
      const updatedTokenVersion = ((req.user as any).tokenVersion ?? 1) + 1;

      await usersCol.updateOne(
        { id: req.user.id },
        {
          $set: {
            passwordHash,
            mustChangePassword: false,
            passwordChangedAt: new Date().toISOString(),
            tokenVersion: updatedTokenVersion,
          },
        }
      );

      // Record audit
      await recordAuditLog(
        req.user.id,
        req.user.name,
        req.user.role,
        'AUTHENTICATION',
        'PASSWORD_CHANGED',
        req.user.id,
        '',
        '',
        `User ${req.user.email} changed their password (previous sessions invalidated)`
      );

      console.log(`[Auth] Password updated for "${req.user.name}" (${req.user.email}). Sessions rotated to tokenVersion: ${updatedTokenVersion}`);

      const safeUser: User = {
        id: req.user.id,
        employeeId: req.user.employeeId,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        roleId: req.user.roleId,
        active: req.user.active,
        avatarUrl: req.user.avatarUrl,
        lastLoginAt: req.user.lastLoginAt,
        mustChangePassword: false,
        tokenVersion: updatedTokenVersion,
        createdAt: req.user.createdAt,
      };

      // Issue fresh access & refresh tokens with the new tokenVersion
      const newToken = generateAccessToken(safeUser);
      const newRefreshToken = generateRefreshToken(safeUser, updatedTokenVersion);

      res.json({
        success: true,
        user: safeUser,
        token: newToken,
        refreshToken: newRefreshToken,
      });
    } catch (error: any) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password.' });
    }
  }
);
