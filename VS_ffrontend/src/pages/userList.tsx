import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Users, ShieldCheck, UserCheck } from 'lucide-react';
import { apiFetch } from '@/lib/auth-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  active_roles_count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

// ─── Component ───────────────────────────────────────────────────────────────

const UserList = () => {
  const [data, setData] = useState<UserWithRoles[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiFetch('/api/users/with-active-roles')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((json: UserWithRoles[]) => setData(json))
      .catch((err: Error) => setError(err.message));
  }, []);

  // ── Stat counts ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return { total: 0, active: 0, inactive: 0 };
    return {
      total: data.length,
      active: data.filter((u) => u.active_roles_count > 0).length,
      inactive: data.filter((u) => u.active_roles_count === 0).length,
    };
  }, [data]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'active' && u.active_roles_count > 0) ||
        (activeFilter === 'inactive' && u.active_roles_count === 0);

      return matchesSearch && matchesFilter;
    });
  }, [data, search, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilter = (f: 'all' | 'active' | 'inactive') => {
    setActiveFilter(f);
    setPage(1);
  };

  // ── Tab config ────────────────────────────────────────────────────────────
  const tabs: { key: 'all' | 'active' | 'inactive'; label: string }[] = [
    { key: 'all', label: 'All Users' },
    { key: 'active', label: 'Active in Elections' },
    { key: 'inactive', label: 'Unassigned' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Users</h2>
          <p className="text-muted-foreground mt-1">
            All approved users and their active election role assignments.
          </p>
        </div>
      </header>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Users</p>
            {data ? (
              <p className="text-2xl font-bold">{stats.total}</p>
            ) : (
              <Spinner className="size-5 mt-1" />
            )}
          </div>
        </div>

        {/* Active */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active in Elections</p>
            {data ? (
              <p className="text-2xl font-bold">{stats.active}</p>
            ) : (
              <Spinner className="size-5 mt-1" />
            )}
          </div>
        </div>

        {/* Unassigned */}
        <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unassigned</p>
            {data ? (
              <p className="text-2xl font-bold">{stats.inactive}</p>
            ) : (
              <Spinner className="size-5 mt-1" />
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs & Search ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b mb-6 gap-4">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilter(tab.key)}
              className={`pb-4 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === tab.key
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative pb-4 md:pb-0 w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <pre className="text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-lg">
          {error}
        </pre>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {!data && !error && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Spinner className="size-5" />
          Loading users…
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {data && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Full Name
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Email
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-center">
                  Active Roles
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((user) => (
                  <TableRow
                    key={user.id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    {/* Name + initials avatar */}
                    <TableCell className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 uppercase">
                          {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <span className="text-sm font-semibold">{user.name}</span>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="px-6 py-5 text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>

                    {/* Active roles badge */}
                    <TableCell className="px-6 py-5 text-center">
                      {user.active_roles_count > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-0 text-xs font-bold rounded-full px-3 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        >
                          {user.active_roles_count} Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-0 text-xs font-bold rounded-full px-3 py-0.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        >
                          None
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ── Pagination ─────────────────────────────────────────────────── */}
          <div className="px-6 py-4 bg-muted/30 flex items-center justify-between border-t">
            <p className="text-xs text-muted-foreground">
              Showing{' '}
              {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} users
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;