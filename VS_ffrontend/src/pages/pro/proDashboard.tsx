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
    total_officers: number;
    total_voters: number;
    votes_cast: number;
}

interface Officer {
    officer_id: string;
    name: string;
    role: string;
}

const ProDashboard: React.FC = () => {
    const [station, setStation] = useState<Station | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [officers, setOfficers] = useState<Officer[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const [stationRes, summaryRes, officersRes] = await Promise.all([
                    fetch('http://localhost:3001/api/pro/station', { credentials: 'include' }),
                    fetch('http://localhost:3001/api/pro/summary', { credentials: 'include' }),
                    fetch('http://localhost:3001/api/pro/officers', { credentials: 'include' }),
                ]);
                setStation(await stationRes.json());
                setSummary(await summaryRes.json());
                setOfficers(await officersRes.json());
            } catch (err) {
                console.error('Failed to load PRO data', err);
            }
        })();
    }, []);

    if (!station || !summary) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner className="size-6" />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <header className="mb-8">
                <h2 className="text-3xl font-black tracking-tight">
                    Presiding Officer Dashboard
                </h2>
                <p className="text-muted-foreground mt-1">
                    Oversee your assigned polling station and officers.
                </p>
            </header>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 flex-shrink-0">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Station</p>
                        <p className="text-sm font-bold">{summary.station.name}</p>
                        <p className="text-xs text-muted-foreground">{summary.station.location}</p>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Officers</p>
                        <p className="text-lg font-bold">{summary.total_officers}</p>
                    </div>
                </div>
                <div className="bg-card border rounded-xl p-5 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Votes Cast</p>
                        <p className="text-lg font-bold">
                            {summary.votes_cast} / {summary.total_voters}
                        </p>
                    </div>
                </div>
            </div>

            {/* Officers table */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h3 className="text-sm font-bold">Assigned Officers</h3>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                                Name
                            </TableHead>
                            <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                                Role
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {officers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center py-12 text-muted-foreground">
                                    No officers assigned yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            officers.map((o) => (
                                <TableRow key={o.officer_id}>
                                    <TableCell className="px-6 py-3 text-sm font-medium">
                                        {o.name}
                                    </TableCell>
                                    <TableCell className="px-6 py-3 text-sm text-muted-foreground">
                                        {o.role}
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

export default ProDashboard;
