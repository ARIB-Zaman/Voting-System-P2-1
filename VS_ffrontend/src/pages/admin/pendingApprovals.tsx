import React, { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle, UserPlus } from 'lucide-react';

interface PendingUser {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

const PendingApprovals: React.FC = () => {
    const [users, setUsers] = useState<PendingUser[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<Set<string>>(new Set());

    const fetchPending = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:3001/api/admin/pending', {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to load pending users');
            const data = await res.json();
            setUsers(data);
            setError(null);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load');
        }
    }, []);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    const handleApprove = async (userId: string) => {
        setProcessing((prev) => new Set(prev).add(userId));
        try {
            const res = await fetch(
                `http://localhost:3001/api/admin/approve/${userId}`,
                { method: 'POST', credentials: 'include' }
            );
            if (!res.ok) throw new Error('Approve failed');
            await fetchPending();
        } catch {
            setError('Failed to approve user. Please try again.');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    };

    const handleReject = async (userId: string) => {
        setProcessing((prev) => new Set(prev).add(userId));
        try {
            const res = await fetch(
                `http://localhost:3001/api/admin/reject/${userId}`,
                { method: 'POST', credentials: 'include' }
            );
            if (!res.ok) throw new Error('Reject failed');
            await fetchPending();
        } catch {
            setError('Failed to reject user. Please try again.');
        } finally {
            setProcessing((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <h2 className="text-3xl font-black tracking-tight">
                    Pending Approvals
                </h2>
                <p className="text-muted-foreground mt-1">
                    Review and manage sign-up requests from new officers.
                </p>
            </header>

            {/* Summary card */}
            <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm mb-8 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
                    <UserPlus className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">
                        Pending Requests
                    </p>
                    {users !== null ? (
                        <p className="text-2xl font-bold">{users.length}</p>
                    ) : (
                        <Spinner className="size-5 mt-1" />
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <pre className="text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-lg">
                    {error}
                </pre>
            )}

            {/* Loading */}
            {!users && !error && (
                <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
                    <Spinner className="size-5" />
                    Loading pending approvals…
                </div>
            )}

            {/* Table */}
            {users && (
                <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                                    Name
                                </TableHead>
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                                    Email
                                </TableHead>
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                                    Requested Role
                                </TableHead>
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">
                                    Signed Up
                                </TableHead>
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="text-center py-16 text-muted-foreground"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                            <p className="font-medium">
                                                All caught up!
                                            </p>
                                            <p className="text-xs">
                                                No pending sign-up requests.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((u) => {
                                    const isProcessing = processing.has(u.id);
                                    return (
                                        <TableRow
                                            key={u.id}
                                            className="hover:bg-muted/40 transition-colors"
                                        >
                                            <TableCell className="px-6 py-4">
                                                <p className="text-sm font-bold">
                                                    {u.name}
                                                </p>
                                            </TableCell>
                                            <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                                                {u.email}
                                            </TableCell>
                                            <TableCell className="px-6 py-4">
                                                <Badge
                                                    variant="outline"
                                                    className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 ${u.role === 'RO'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                        : u.role === 'PRO'
                                                            ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                                                            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                                                        }`}
                                                >
                                                    {u.role === 'RO'
                                                        ? 'Returning Officer'
                                                        : u.role === 'PRO'
                                                            ? 'Presiding Officer'
                                                            : 'Polling Officer'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                                                {formatDate(u.createdAt)}
                                            </TableCell>
                                            <TableCell className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        size="sm"
                                                        disabled={isProcessing}
                                                        onClick={() =>
                                                            handleApprove(u.id)
                                                        }
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                        Approve
                                                    </Button>

                                                    <AlertDialog>
                                                        <AlertDialogTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={
                                                                    isProcessing
                                                                }
                                                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                                            >
                                                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                                                Reject
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Reject{' '}
                                                                    {u.name}?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will
                                                                    permanently
                                                                    delete their
                                                                    account
                                                                    request.
                                                                    They would
                                                                    need to sign
                                                                    up again.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>
                                                                    Cancel
                                                                </AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() =>
                                                                        handleReject(
                                                                            u.id
                                                                        )
                                                                    }
                                                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                                >
                                                                    Reject
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default PendingApprovals;
