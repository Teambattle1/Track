import { AuthUser } from '../types';
import * as db from './db';

const STORAGE_KEY_USER = 'geohunt_auth_user';

const getThomasPassword = (): string => {
    const local = typeof window !== 'undefined' ? localStorage.getItem('THOMAS_ADMIN_PASSWORD') : null;
    const env = (import.meta as any).env?.VITE_THOMAS_ADMIN_PASSWORD;
    // Password must be configured via localStorage or environment variable - no fallback
    return local || env || '';
};

export const authService = {
    login: async (email: string, password?: string): Promise<AuthUser | null> => {
        try {
            // 0. Owner Login (Thomas) - password can be overridden via localStorage/env
            if (email.toLowerCase() === 'thomas@teambattle.dk' && password === getThomasPassword()) {
                 const thomasUser: AuthUser = {
                    id: 'admin-thomas-permanent',
                    name: 'THOMAS',
                    email: 'thomas@teambattle.dk',
                    role: 'Owner'
                };
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(thomasUser));
                return thomasUser;
            }

            const users = await db.fetchAccountUsers();
            
            // 1. Normal Login Check
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            // Note: In a real app, we would check user.password here. 
            // For now, we trust the DB record existence for non-hardcoded users 
            // or perform a simulated check if the user record has a password field.
            if (user) {
                const authUser: AuthUser = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role.split(' - ')[0] as any // Extract Role from "Owner - full access"
                };
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(authUser));
                return authUser;
            }

            // 2. Bootstrap / First Run Logic (Legacy fallback)
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
            
            // 3. Fallback for Connection Errors (e.g. Table missing)
            // Allow entry to run SQL setup script in Admin panel
            if (email.toLowerCase() === 'admin@teambattle.dk' || (email.toLowerCase() === 'thomas@teambattle.dk' && password === getThomasPassword())) {
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
