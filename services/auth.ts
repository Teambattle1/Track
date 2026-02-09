
import { AuthUser } from '../types';
import * as db from './db';

const STORAGE_KEY_USER = 'geohunt_auth_user';

// SHA-256 hash for password comparison
export const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const authService = {
    login: async (email: string, password?: string): Promise<AuthUser | null> => {
        try {
            const users = await db.fetchAccountUsers();

            // 1. Normal Login Check — verify email and password against account_users DB
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (user) {
                // Verify password if user has one stored
                if (user.password && password) {
                    const inputHash = await hashPassword(password);
                    // Support both hashed and legacy plaintext passwords
                    const storedIsHash = user.password.length === 64 && /^[0-9a-f]+$/.test(user.password);
                    const passwordMatch = storedIsHash
                        ? inputHash === user.password
                        : password === user.password;

                    if (!passwordMatch) return null;
                }

                const authUser: AuthUser = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role.split(' - ')[0] as any
                };
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(authUser));
                return authUser;
            }

            // 2. Bootstrap / First Run Logic (empty DB — allow first admin setup)
            if (users.length === 0 && email.toLowerCase() === 'admin@teambattle.dk') {
                 const bootstrapUser: AuthUser = {
                    id: 'bootstrap-admin',
                    name: 'System Admin (Setup)',
                    email: 'admin@teambattle.dk',
                    role: 'Owner'
                };
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(bootstrapUser));
                return bootstrapUser;
            }

            return null;
        } catch (e) {
            console.error("Login failed", e);

            // 3. Rescue fallback for Connection Errors (e.g. Table missing)
            if (email.toLowerCase() === 'admin@teambattle.dk') {
                 const rescueUser: AuthUser = {
                    id: 'admin-rescue',
                    name: 'System Admin (Rescue)',
                    email: email,
                    role: 'Owner'
                };
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(rescueUser));
                return rescueUser;
            }

            return null;
        }
    },

    logout: () => {
        localStorage.removeItem(STORAGE_KEY_USER);
    },

    getCurrentUser: (): AuthUser | null => {
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return null;
            }
        }
        return null;
    }
};
