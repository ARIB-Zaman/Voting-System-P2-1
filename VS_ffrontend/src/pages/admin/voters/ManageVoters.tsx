import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ListView } from '@/components/refine-ui/views/list-view';
import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';
import { Search, Filter, Edit, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import EditVoterModal from './EditVoterModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiFetch } from '@/lib/auth-client';

interface Voter {
    nid: string;
    name: string;
    phone: string;
    email: string;
    voter_type: string;
    constituency_id: number;
    lat: string;
    lng: string;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const ManageVoters = () => {
    const [voters, setVoters] = useState<Voter[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [constituencyFilter, setConstituencyFilter] = useState('all');
    const [constituencies, setConstituencies] = useState<{ id: number; name: string }[]>([]);
    const [electionFilter, setElectionFilter] = useState('all');
    const [elections, setElections] = useState<{ election_id: number; name: string }[]>([]);

    // Edit Modal State
    const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Delete Alert State
    const [deletingVoterNid, setDeletingVoterNid] = useState<string | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

    const fetchVoters = async (page = 1) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                search: search,
                constituency_id: constituencyFilter,
                ...(electionFilter !== 'all' && { election_id: electionFilter })
            });
            const res = await apiFetch(`/api/voters?${queryParams}`);
            const data = await res.json();
            if (res.ok) {
                setVoters(data.data);
                setPagination(data.pagination);
            } else {
                toast.error(data.error || "Failed to fetch voters");
            }
        } catch (err) {
            toast.error("Failed to fetch voters");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVoters(1);
    }, [constituencyFilter, electionFilter, search]);

    useEffect(() => {
        // Fetch constituencies
        fetch('/api/constituency')
            .then(res => res.json())
            .then(data => setConstituencies(data))
            .catch(err => console.error(err));

        // Fetch elections
        fetch('/api/election')
            .then(res => res.json())
            .then(data => setElections(data))
            .catch(err => console.error(err));
    }, []);

    const handleDelete = async () => {
        if (!deletingVoterNid) return;
        try {
            const res = await fetch(`http://localhost:3001/api/voters/${deletingVoterNid}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Voter deleted successfully");
                fetchVoters(pagination.page);
            } else {
                toast.error(data.error || "Delete failed");
            }
        } catch (err) {
            toast.error("Network error");
        } finally {
            setIsDeleteAlertOpen(false);
            setDeletingVoterNid(null);
        }
    };

    return (
        <ListView>
            <Breadcrumb />
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <Card className="shadow-lg border-muted/20">
                    <CardHeader className="border-b bg-muted/5">
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <Search className="h-6 w-6 text-primary" />
                            Manage Voters
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by NID or Name..."
                                    className="pl-10"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
                                <Select value={electionFilter} onValueChange={setElectionFilter}>
                                    <SelectTrigger className="w-[180px]">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4" />
                                            <SelectValue placeholder="All Elections" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Elections</SelectItem>
                                        {elections.map(e => (
                                            <SelectItem key={e.election_id} value={e.election_id.toString()}>{e.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={constituencyFilter} onValueChange={setConstituencyFilter}>
                                    <SelectTrigger className="w-[180px]">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4" />
                                            <SelectValue placeholder="All Constituencies" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Constituencies</SelectItem>
                                        {constituencies.map(c => (
                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="rounded-xl border shadow-sm overflow-hidden bg-background">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold">NID</TableHead>
                                        <TableHead className="font-bold">Name</TableHead>
                                        <TableHead className="font-bold">Phone</TableHead>
                                        <TableHead className="font-bold">Type</TableHead>
                                        <TableHead className="font-bold">Constituency</TableHead>
                                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                                    <p className="text-lg font-medium text-muted-foreground">Loading voters...</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : voters.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-10 w-10 opacity-20" />
                                                    <p className="text-lg font-medium">No voters found match your criteria.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        voters.map((voter) => (
                                            <TableRow key={voter.nid} className="hover:bg-muted/20 transition-colors">
                                                <TableCell className="font-mono text-primary font-medium">{voter.nid}</TableCell>
                                                <TableCell className="font-medium">{voter.name}</TableCell>
                                                <TableCell>{voter.phone || "—"}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${voter.voter_type === 'POSTAL'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {voter.voter_type}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {constituencies.find(c => c.id === voter.constituency_id)?.name || voter.constituency_id}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/5"
                                                            onClick={() => {
                                                                setEditingVoter(voter);
                                                                setIsEditModalOpen(true);
                                                            }}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                                                            onClick={() => {
                                                                setDeletingVoterNid(voter.nid);
                                                                setIsDeleteAlertOpen(true);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6">
                                <p className="text-sm text-muted-foreground">
                                    Showing <span className="font-bold">{voters.length}</span> of <span className="font-bold">{pagination.total}</span> voters
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page === 1}
                                        onClick={() => fetchVoters(pagination.page - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                    </Button>
                                    <div className="flex items-center px-4 text-sm font-medium border rounded-md bg-muted/10">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page === pagination.totalPages}
                                        onClick={() => fetchVoters(pagination.page + 1)}
                                    >
                                        Next <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modals & Dialogs */}
            <EditVoterModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                voter={editingVoter}
                constituencies={constituencies}
                onSuccess={() => fetchVoters(pagination.page)}
            />

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the voter
                            with NID <span className="font-bold text-foreground underline">{deletingVoterNid}</span> from the database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete Voter
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ListView>
    );
};

export default ManageVoters;
