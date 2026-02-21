import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
    CalendarCheck2,
    CheckCircle2,
    ClipboardList,
    MapPin,
} from 'lucide-react';

interface Election {
    election_id: string | number;
    name: string;
    status: 'PLANNED' | 'LIVE' | 'CLOSED' | 'FINALIZED';
    start_date: string;
    end_date: string;
}

interface Summary {
    elections: { total: number; live: number; planned: number; closed: number };
    stations: number;
    voters: number;
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const statusConfig = {
    LIVE: { label: 'Active', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    PLANNED: { label: 'Scheduled', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    FINALIZED: { label: 'Finalized', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

const RoDashboard: React.FC = () => {
    const [elections, setElections] = useState<Election[] | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('http://localhost:3001/api/ro/elections', { credentials: 'include' })
            .then((r) => { if (!r.ok) throw new Error('Failed to load elections'); return r.json(); })
            .then(setElections)
            .catch((e) => setError(e.message));

        fetch('http://localhost:3001/api/ro/summary', { credentials: 'include' })
            .then((r) => r.json())
            .then(setSummary)
            .catch(() => { });
    }, []);

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <h2 className="text-3xl font-black tracking-tight">RO Dashboard</h2>
                <p className="text-muted-foreground mt-1">
                    Returning Officer — oversee elections and polling stations in your jurisdiction.
                </p>
            </header>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Assigned Elections</p>
                        {summary ? (
                            <p className="text-2xl font-bold">{summary.elections.total}</p>
                        ) : (
                            <Spinner className="size-5 mt-1" />
                        )}
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Polling Stations</p>
                        {summary ? (
                            <p className="text-2xl font-bold">{summary.stations}</p>
                        ) : (
                            <Spinner className="size-5 mt-1" />
                        )}
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
                        <CalendarCheck2 className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Active Right Now</p>
                        {summary ? (
                            <p className="text-2xl font-bold">{summary.elections.live}</p>
                        ) : (
                            <Spinner className="size-5 mt-1" />
                        )}
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <pre className="text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-lg">{error}</pre>
            )}

            {/* Elections Table */}
            {!elections && !error && (
                <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
                    <Spinner className="size-5" />
                    Loading elections…
                </div>
            )}

            {elections && (
                <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b">
                        <h3 className="font-bold text-sm">Election Overview</h3>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Election</TableHead>
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                                <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Date Range</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {elections.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                                        No elections assigned yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                elections.map((e) => {
                                    const cfg = statusConfig[e.status] ?? statusConfig.CLOSED;
                                    return (
                                        <TableRow key={e.election_id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="px-6 py-4">
                                                <p className="text-sm font-bold">{e.name}</p>
                                            </TableCell>
                                            <TableCell className="px-6 py-4">
                                                <Badge variant="outline" className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.className}`}>
                                                    {cfg.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                                                {formatDate(e.start_date)} — {formatDate(e.end_date)}
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

export default RoDashboard;
