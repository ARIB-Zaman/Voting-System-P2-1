import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Building2,
    CalendarDays,
    Check,
    ChevronsUpDown,
    Edit3,
    Eye,
    MapPin,
    Plus,
    Save,
    Trash2,
    User,
    X,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ConstituencyInfo {
    constituency_id: number;
    constituency_name: string;
    region: string;
    election_id: number;
    election_name: string;
    start_date: string;
    end_date: string;
    status: string;
}

interface PollingCenter {
    center_id: number;
    name: string;
    address: string;
    status: 'OPEN' | 'FLAGGED' | 'CLOSED';
    constituency_id: number;
    presiding_officer_id: string | null;
    presiding_officer_name: string | null;
}

interface POUser {
    id: string;
    name: string;
}

type PCStatus = 'OPEN' | 'FLAGGED' | 'CLOSED';

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const formatDateShort = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const isWithinRange = (start: string, end: string): boolean => {
    const now = new Date();
    return now >= new Date(start) && now <= new Date(end);
};

const electionStatusConfig: Record<string, { label: string; className: string }> = {
    LIVE: { label: 'Active', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    PLANNED: { label: 'Scheduled', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    CLOSED: { label: 'Completed', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    FINALIZED: { label: 'Finalized', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
};

const pcStatusConfig: Record<PCStatus, { label: string; className: string }> = {
    OPEN: { label: 'Open', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    FLAGGED: { label: 'Flagged', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

// ── PO Combobox ───────────────────────────────────────────────────────────────

const POCombobox: React.FC<{
    value: string | null;
    onChange: (id: string | null) => void;
    poUsers: POUser[];
}> = ({ value, onChange, poUsers }) => {
    const [open, setOpen] = useState(false);
    const selected = poUsers.find((u) => u.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal h-9 text-sm"
                >
                    <span className={selected ? '' : 'text-muted-foreground'}>
                        {selected ? selected.name : 'Select officer (optional)…'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search officers…" />
                    <CommandList>
                        <CommandEmpty>No officers found.</CommandEmpty>
                        <CommandGroup>
                            {/* Clear selection */}
                            <CommandItem
                                onSelect={() => { onChange(null); setOpen(false); }}
                                className="text-muted-foreground italic"
                            >
                                <span>None (unassign)</span>
                                {!value && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                            {poUsers.map((po) => (
                                <CommandItem
                                    key={po.id}
                                    value={po.name}
                                    onSelect={() => { onChange(po.id); setOpen(false); }}
                                >
                                    <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                    {po.name}
                                    {value === po.id && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
    cId: string;
    backPath: string;
    backLabel?: string;
    viewCenterPath: (centerId: number) => string;
}

const ConstituencyDetailsContent: React.FC<Props> = ({ cId, backPath, backLabel = "Back", viewCenterPath }) => {
    const navigate = useNavigate();

    // ── Data state ────────────────────────────────────────────────────────────
    const [info, setInfo] = useState<ConstituencyInfo | null>(null);
    const [centers, setCenters] = useState<PollingCenter[]>([]);
    const [poUsers, setPoUsers] = useState<POUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Add row state ─────────────────────────────────────────────────────────
    const [showAddRow, setShowAddRow] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newStatus, setNewStatus] = useState<PCStatus>('OPEN');
    const [newPOId, setNewPOId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);

    // ── Edit row state ────────────────────────────────────────────────────────
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{
        name: string;
        address: string;
        status: PCStatus;
        presiding_officer_id: string | null;
    }>({ name: '', address: '', status: 'OPEN', presiding_officer_id: null });
    const [saving, setSaving] = useState(false);

    // ── Processing set for deletes ────────────────────────────────────────────
    const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchInfo = useCallback(async () => {
        if (!cId) return;
        const res = await fetch(`${API}/ro/constituency/${cId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load constituency info');
        return res.json() as Promise<ConstituencyInfo>;
    }, [cId]);

    const fetchCenters = useCallback(async () => {
        if (!cId) return;
        const res = await fetch(`${API}/ro/constituency/${cId}/polling-centers`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load polling centers');
        return res.json() as Promise<PollingCenter[]>;
    }, [cId]);

    const fetchPOUsers = useCallback(async () => {
        try {
            const res = await fetch(`${API}/users/pro`);
            if (!res.ok) return;
            setPoUsers(await res.json());
        } catch {
            // Non-critical — dropdown will just be empty
        }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [infoData, centersData] = await Promise.all([
                    fetchInfo(),
                    fetchCenters(),
                ]);
                if (infoData) {
                    setInfo(infoData);
                    setNewStatus(isWithinRange(infoData.start_date, infoData.end_date) ? 'OPEN' : 'CLOSED');
                }
                if (centersData) setCenters(centersData);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to load');
            } finally {
                setLoading(false);
            }
        })();
        fetchPOUsers();
    }, [fetchInfo, fetchCenters, fetchPOUsers]);

    // ── Reset add row ─────────────────────────────────────────────────────────
    const resetAddRow = () => {
        setNewName('');
        setNewAddress('');
        setNewPOId(null);
        setNewStatus(info ? (isWithinRange(info.start_date, info.end_date) ? 'OPEN' : 'CLOSED') : 'OPEN');
        setShowAddRow(false);
    };

    // ── Add handler ───────────────────────────────────────────────────────────
    const addCenter = async () => {
        if (!cId || !newName.trim() || !newAddress.trim()) {
            toast.error('Name and address are required');
            return;
        }
        setAdding(true);
        try {
            const res = await fetch(`${API}/ro/constituency/${cId}/polling-centers`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    address: newAddress.trim(),
                    status: newStatus,
                    presiding_officer_id: newPOId,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? 'Failed to add');
            }
            const created: PollingCenter = await res.json();
            setCenters((prev) => [...prev, created]);
            resetAddRow();
            toast.success('Polling center added');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to add polling center');
        } finally {
            setAdding(false);
        }
    };

    // ── Edit handlers ─────────────────────────────────────────────────────────
    const startEdit = (pc: PollingCenter) => {
        setEditingId(pc.center_id);
        setEditForm({
            name: pc.name,
            address: pc.address,
            status: pc.status,
            presiding_officer_id: pc.presiding_officer_id,
        });
    };

    const cancelEdit = () => setEditingId(null);

    const saveEdit = async () => {
        if (editingId === null) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/ro/polling-centers/${editingId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    address: editForm.address,
                    status: editForm.status,
                    presiding_officer_id: editForm.presiding_officer_id,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? 'Update failed');
            }
            const updated: PollingCenter = await res.json();
            setCenters((prev) => prev.map((pc) => (pc.center_id === editingId ? updated : pc)));
            setEditingId(null);
            toast.success('Polling center updated');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to update polling center');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete handler ────────────────────────────────────────────────────────
    const deleteCenter = async (centerId: number) => {
        setProcessingIds((prev) => new Set(prev).add(centerId));
        try {
            const res = await fetch(`${API}/ro/polling-centers/${centerId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Delete failed');
            setCenters((prev) => prev.filter((pc) => pc.center_id !== centerId));
            toast.success('Polling center deleted');
        } catch {
            toast.error('Failed to delete polling center');
        } finally {
            setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(centerId);
                return next;
            });
        }
    };

    // ── Loading / Error ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner className="size-6" />
            </div>
        );
    }

    if (error || !info) {
        return (
            <div className="p-8 max-w-6xl mx-auto">
                <p className="text-destructive">{error ?? 'Constituency not found'}</p>
            </div>
        );
    }

    const elCfg = electionStatusConfig[info.status] ?? electionStatusConfig.PLANNED;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

            {/* ── Back + Header ────────────────────────────────────────────────── */}
            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="mb-4 text-muted-foreground -ml-2"
                    onClick={() => navigate(backPath)}
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {backLabel}
                </Button>

                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tight">
                        {info.constituency_name}
                    </h1>
                    <Badge variant="secondary" className="text-xs font-medium">
                        <MapPin className="h-3 w-3 mr-1" />
                        {info.region}
                    </Badge>
                </div>
            </div>

            {/* ── Election Info (read-only) ─────────────────────────────────────── */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/30">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Election Information
                    </h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Election</Label>
                        <p className="text-sm font-semibold">{info.election_name}</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start Date</Label>
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            {formatDateShort(info.start_date)}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">End Date</Label>
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            {formatDateShort(info.end_date)}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Election Status</Label>
                        <Badge
                            variant="outline"
                            className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight ${elCfg.className}`}
                        >
                            {elCfg.label}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* ── Polling Centers ───────────────────────────────────────────────── */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Polling Centers
                        </h2>
                        <Badge variant="secondary" className="text-xs">{centers.length}</Badge>
                    </div>
                    {!showAddRow && editingId === null && (
                        <Button size="sm" variant="outline" onClick={() => setShowAddRow(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Polling Center
                        </Button>
                    )}
                </div>

                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Name</TableHead>
                            <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Address</TableHead>
                            <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Status</TableHead>
                            <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Presiding Officer</TableHead>
                            <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {/* ── Add row ────────────────────────────────────────────────── */}
                        {showAddRow && (
                            <TableRow className="bg-primary/5">
                                <TableCell className="px-6 py-3">
                                    <Input
                                        placeholder="Center name"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell className="px-6 py-3">
                                    <Input
                                        placeholder="Address"
                                        value={newAddress}
                                        onChange={(e) => setNewAddress(e.target.value)}
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell className="px-6 py-3">
                                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as PCStatus)}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OPEN">Open</SelectItem>
                                            <SelectItem value="FLAGGED">Flagged</SelectItem>
                                            <SelectItem value="CLOSED">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="px-6 py-3">
                                    <POCombobox value={newPOId} onChange={setNewPOId} poUsers={poUsers} />
                                </TableCell>
                                <TableCell className="px-6 py-3 text-right">
                                    <div className="flex gap-1.5 justify-end">
                                        <Button
                                            size="sm"
                                            onClick={addCenter}
                                            disabled={adding}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            {adding ? <Spinner className="size-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={resetAddRow}>
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {/* ── Empty state ───────────────────────────────────────────── */}
                        {centers.length === 0 && !showAddRow ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Building2 className="h-8 w-8 opacity-40" />
                                        <p className="font-medium">No polling centers yet</p>
                                        <p className="text-xs">Add a polling center to get started.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            centers.map((pc) => {
                                const isEditing = editingId === pc.center_id;
                                const isProcessing = processingIds.has(pc.center_id);
                                const sCfg = pcStatusConfig[pc.status] ?? pcStatusConfig.CLOSED;

                                if (isEditing) {
                                    return (
                                        <TableRow key={pc.center_id} className="bg-primary/5">
                                            <TableCell className="px-6 py-3">
                                                <Input
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                                    className="h-9"
                                                />
                                            </TableCell>
                                            <TableCell className="px-6 py-3">
                                                <Input
                                                    value={editForm.address}
                                                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                                                    className="h-9"
                                                />
                                            </TableCell>
                                            <TableCell className="px-6 py-3">
                                                <Select
                                                    value={editForm.status}
                                                    onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as PCStatus }))}
                                                >
                                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="OPEN">Open</SelectItem>
                                                        <SelectItem value="FLAGGED">Flagged</SelectItem>
                                                        <SelectItem value="CLOSED">Closed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="px-6 py-3">
                                                <POCombobox
                                                    value={editForm.presiding_officer_id}
                                                    onChange={(id) => setEditForm((f) => ({ ...f, presiding_officer_id: id }))}
                                                    poUsers={poUsers}
                                                />
                                            </TableCell>
                                            <TableCell className="px-6 py-3 text-right">
                                                <div className="flex gap-1.5 justify-end">
                                                    <Button
                                                        size="sm"
                                                        onClick={saveEdit}
                                                        disabled={saving}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    >
                                                        {saving ? <Spinner className="size-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }

                                return (
                                    <TableRow key={pc.center_id} className={isProcessing ? 'opacity-50' : ''}>
                                        <TableCell className="px-6 py-3 font-medium text-sm">{pc.name}</TableCell>
                                        <TableCell className="px-6 py-3 text-sm text-muted-foreground">{pc.address}</TableCell>
                                        <TableCell className="px-6 py-3">
                                            <Badge
                                                variant="outline"
                                                className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight ${sCfg.className}`}
                                            >
                                                {sCfg.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-3 text-sm text-muted-foreground">
                                            {pc.presiding_officer_name ? (
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3.5 w-3.5 shrink-0" />
                                                    {pc.presiding_officer_name}
                                                </div>
                                            ) : (
                                                <span className="italic text-muted-foreground/60 text-xs">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-6 py-3 text-right">
                                            <div className="flex gap-1.5 justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-primary hover:text-primary/80 font-medium"
                                                    onClick={() => navigate(viewCenterPath(pc.center_id))}
                                                    disabled={isProcessing}
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                    View
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => startEdit(pc)}
                                                    disabled={isProcessing || showAddRow}
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                            disabled={isProcessing}
                                                        >
                                                            {isProcessing ? <Spinner className="size-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete "{pc.name}"?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently remove this polling center. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => deleteCenter(pc.center_id)}
                                                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                            >
                                                                Delete
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
        </div>
    );
};

export default ConstituencyDetailsContent;
