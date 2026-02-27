import type { AuthProvider } from '@refinedev/core';
import { authClient } from '@/lib/auth-client';

type SessionUser = {
    id: string;
    name: string;
    email: string;
    image?: string;
    role?: string;
    approved?: boolean;
};

/**
 * Refine AuthProvider backed by BetterAuth.
 * Role-based redirects are handled in App.tsx via <Authenticated>.
 */
export const authProvider: AuthProvider = {
    login: async ({ email, password }) => {
        try {
            const res = await authClient.signIn.email({ email, password });

            if (res.error) {
                return {
                    success: false,
                    error: { name: 'Login failed', message: res.error.message ?? 'Invalid credentials' },
                };
            }

            // Check approval status
            const session = await authClient.getSession();
            const user = session?.data?.user as SessionUser | undefined;

            if (user && user.approved === false) {
                // Not approved — sign them out immediately
                await authClient.signOut();
                return {
                    success: false,
                    error: {
                        name: 'Account pending',
                        message: 'Your account is pending admin approval. Please wait for an administrator to approve your access.',
                    },
                };
            }

            const role = user?.role ?? 'ADMIN';

            const homeMap: Record<string, string> = {
                ADMIN: '/homeAdmin',
                RO: '/homeRO',
                PO: '/homePO',
                PRO: '/homePRO',
            };

            return { success: true, redirectTo: homeMap[role] ?? '/homeAdmin' };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            return { success: false, error: { name: 'Login failed', message } };
        }
    },

    logout: async () => {
        await authClient.signOut();
        return { success: true, redirectTo: '/login' };
    },

    check: async () => {
        try {
            const session = await authClient.getSession();
            if (session?.data?.user) {
                return { authenticated: true };
            }
            return { authenticated: false, redirectTo: '/login' };
        } catch {
            return { authenticated: false, redirectTo: '/login' };
        }
    },

    getIdentity: async () => {
        try {
            const session = await authClient.getSession();
            const user = session?.data?.user as SessionUser | undefined;
            if (!user) return null;
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role ?? 'PO',
                approved: user.approved ?? false,
                avatar: user.image,
            };
        } catch {
            return null;
        }
    },

    getPermissions: async () => {
        try {
            const session = await authClient.getSession();
            const user = session?.data?.user as SessionUser | undefined;
            return user?.role ?? null;
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

