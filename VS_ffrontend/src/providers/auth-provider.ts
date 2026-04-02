import type { AuthProvider } from '@refinedev/core';
import { apiFetch } from '@/lib/auth-client';

const API = 'http://localhost:3001';

type MeUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    approved: boolean;
};

/**
 * Custom Refine AuthProvider backed by our own JWT implementation.
 * The JWT lives in an httpOnly cookie — we never touch it directly.
 * apiFetch() always includes credentials: 'include' so the cookie is sent.
 */
export const authProvider: AuthProvider = {
    login: async ({ email, password }) => {
        try {
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                return {
                    success: false,
                    error: {
                        name: 'Login failed',
                        message: data?.error ?? 'Invalid credentials',
                    },
                };
            }

            const role: string = data?.user?.role ?? 'USER';

            const homeMap: Record<string, string> = {
                ADMIN: '/homeAdmin',
                USER: '/homeUSER',
            };

            return { success: true, redirectTo: homeMap[role] ?? '/homeUSER' };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            return { success: false, error: { name: 'Login failed', message } };
        }
    },

    logout: async () => {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // ignore — cookie will expire anyway
        }
        return { success: true, redirectTo: '/login' };
    },

    check: async () => {
        try {
            const res = await apiFetch('/api/auth/me');
            if (res.ok) {
                return { authenticated: true };
            }
            return { authenticated: false, redirectTo: '/login' };
        } catch {
            return { authenticated: false, redirectTo: '/login' };
        }
    },

    getIdentity: async () => {
        try {
            const res = await apiFetch('/api/auth/me');
            if (!res.ok) return null;
            const user: MeUser = await res.json();
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role ?? 'USER',
                approved: user.approved ?? false,
            };
        } catch {
            return null;
        }
    },

    getPermissions: async () => {
        try {
            const res = await apiFetch('/api/auth/me');
            if (!res.ok) return null;
            const user: MeUser = await res.json();
            return user.role ?? null;
        } catch {
            return null;
        }
    },

    onError: async (error) => {
        if (error?.status === 401 || error?.status === 403) {
            return { logout: true, redirectTo: '/login' };
        }
        return { error };
    },
};
