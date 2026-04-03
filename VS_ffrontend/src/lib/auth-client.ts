const API_BASE = 'http://localhost:3001';

/**
 * Thin fetch wrapper that always sends the JWT cookie with every request.
 * Replace all plain fetch() calls in dashboard pages with apiFetch().
 */
export const apiFetch = (path: string, options: RequestInit = {}): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
    });

export const apiClient = {
    get: (path: string) => apiFetch(path),
    post: (path: string, body: unknown) =>
        apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
    put: (path: string, body: unknown) =>
        apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (path: string) => apiFetch(path, { method: 'DELETE' }),
};
