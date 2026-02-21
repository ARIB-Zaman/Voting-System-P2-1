import React, { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { CheckCircle2, MapPin, Users } from 'lucide-react';

interface Station {
    station_id: string | null;
    name: string;
    location: string;
    capacity: number;
}

interface Summary {
    station: { name: string; location: string };
    today_checkins: number;
    total_voters: number;
    votes_cast: number;
}

interface Voter {
    voter_id: string;
    name: string;
    checked_in: boolean;
}

const PoDashboard: React.FC = () => {
    const [station, setStation] = useState<Station | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [voters, setVoters] = useState<Voter[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('http://localhost:3001/api/po/station', { credentials: 'include' })
            .then((r) => r.json())
            .then(setStation)
            .catch(() => setStation({ station_id: null, name: 'Unassigned', location: 'N/A', capacity: 0 }));

        fetch('http://localhost:3001/api/po/summary', { credentials: 'include' })
            .then((r) => r.json())
            .then(setSummary)
            .catch(() => { });

        fetch('http://localhost:3001/api/po/voters', { credentials: 'include' })
            .then((r) => r.json())
            .then(setVoters)
            .catch(() => setVoters([]));
    }, []);

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <h2 className="text-3xl font-black tracking-tight">PO Dashboard</h2>
                <p className="text-muted-foreground mt-1">
                    Polling Officer — manage your polling station and track voter activity.
                </p>
            </header>

            {/* Station Info Banner */}
            {station && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-center gap-4">
                    <MapPin className="text-primary h-5 w-5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-sm">{station.name}</p>
                        <p className="text-xs text-muted-foreground">{station.location}</p>
                    </div>
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Total Voters</p>
                        {summary ? (
                            <p className="text-2xl font-bold">{summary.total_voters}</p>
                        ) : (
                            <Spinner className="size-5 mt-1" />
                        )}
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Today's Check-Ins</p>
                        {summary ? (
                            <p className="text-2xl font-bold">{summary.today_checkins}</p>
                        ) : (
                            <Spinner className="size-5 mt-1" />
                        )}
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Votes Cast</p>
                        {summary ? (
                            <p className="text-2xl font-bold">{summary.votes_cast}</p>
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

            {/* Voter List Table */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h3 className="font-bold text-sm">Voter Check-In List</h3>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Voter ID</TableHead>
                            <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Name</TableHead>
                            <TableHead className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {voters.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                                    No voter data available for this station yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            voters.map((v) => (
                                <TableRow key={v.voter_id} className="hover:bg-muted/40 transition-colors">
                                    <TableCell className="px-6 py-4 font-mono text-xs">{v.voter_id}</TableCell>
                                    <TableCell className="px-6 py-4 text-sm font-medium">{v.name}</TableCell>
                                    <TableCell className="px-6 py-4">
                                        <span className={`text-xs font-bold ${v.checked_in ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                            {v.checked_in ? '✓ Checked In' : 'Pending'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default PoDashboard;
