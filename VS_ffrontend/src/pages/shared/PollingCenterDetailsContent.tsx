import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
    CalendarDays,
    Check,
    ChevronsUpDown,
    Edit3,
    Hash,
    Plus,
    Save,
    Trash2,
    User,
    UserPlus,
    X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CenterInfo {
    center_id: number;
    center_name: string;
    address: string;
    center_status: 'OPEN' | 'FLAGGED' | 'CLOSED';
    constituency_id: number;
    constituency_name: string;
    election_id: number;
    election_name: string;
    start_date: string;
    end_date: string;
    election_status: string;
}

interface OfficerAssignment {
    booth_id: number;
    po_id: string;
    po_name: string;
}

interface Booth {
    booth_number: number;
    officers: OfficerAssignment[];
}

interface POUser {
    id: string;
    name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

const electionStatusConfig: Record<string, { label: string; className: string }> = {
    LIVE: { label: 'Active', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    PLANNED: { label: 'Scheduled', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    CLOSED: { label: 'Completed', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    FINALIZED: { label: 'Finalized', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
};

// ── PO Combobox ───────────────────────────────────────────────────────────────

const POCombobox: React.FC<{
    value: string | null;
    onChange: (id: string | null) => void;
    poUsers: POUser[];
    excludeIds?: string[];
    placeholder?: string;
}> = ({ value, onChange, poUsers, excludeIds = [], placeholder = 'Select officer…' }) => {
    const [open, setOpen] = useState(false);
    const available = poUsers.filter((u) => !excludeIds.includes(u.id) || u.id === value);
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
                        {selected ? selected.name : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search officers…" />
                    <CommandList>
                        <CommandEmpty>No officers found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                onSelect={() => { onChange(null); setOpen(false); }}
                                className="text-muted-foreground italic"
                            >
                                None
                                {!value && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                            {available.map((po) => (
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
    centerId: string;
    backPath: string;
    backLabel: string;
}

const PollingCenterDetailsContent: React.FC<Props> = ({ centerId, backPath, backLabel }) => {
    const navigate = useNavigate();

    // ── Data ──────────────────────────────────────────────────────────────────
    const [info, setInfo] = useState<CenterInfo | null>(null);
    const [booths, setBooths] = useState<Booth[]>([]);
    const [poUsers, setPoUsers] = useState<POUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Add booth state ───────────────────────────────────────────────────────
    const [showAddBooth, setShowAddBooth] = useState(false);
    const [newBoothNumber, setNewBoothNumber] = useState('');
    const [addingBooth, setAddingBooth] = useState(false);

    // ── Rename booth state ────────────────────────────────────────────────────
    const [renamingBooth, setRenamingBooth] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [savingRename, setSavingRename] = useState(false);

    // ── Add officer state per booth ───────────────────────────────────────────
    // Maps booth_number → selected po_id being added
    const [addingOfficerTo, setAddingOfficerTo] = useState<number | null>(null);
    const [newOfficerId, setNewOfficerId] = useState<string | null>(null);
    const [savingOfficer, setSavingOfficer] = useState(false);

    // ── Processing sets ───────────────────────────────────────────────────────
    const [deletingBooths, setDeletingBooths] = useState<Set<number>>(new Set());
    const [deletingAssignments, setDeletingAssignments] = useState<Set<number>>(new Set());

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchInfo = useCallback(async () => {
        const res = await fetch(`${API}/polling-center/${centerId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load center info');
        return res.json() as Promise<CenterInfo>;
    }, [centerId]);

    const fetchBooths = useCallback(async () => {
        const res = await fetch(`${API}/polling-center/${centerId}/booths`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load booths');
        return res.json() as Promise<Booth[]>;
    }, [centerId]);

    const fetchPOUsers = useCallback(async () => {
        try {
            const res = await fetch(`${API}/users/po`);
            if (res.ok) setPoUsers(await res.json());
        } catch { /* non-critical */ }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [infoData, boothsData] = await Promise.all([fetchInfo(), fetchBooths()]);
                setInfo(infoData);
                setBooths(boothsData);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to load');
            } finally {
                setLoading(false);
            }
        })();
        fetchPOUsers();
    }, [fetchInfo, fetchBooths, fetchPOUsers]);

    // ── Add booth ─────────────────────────────────────────────────────────────
    const addBooth = async () => {
        const num = parseInt(newBoothNumber);
        if (!newBoothNumber || isNaN(num) || num < 1) {
            toast.error('Enter a valid booth number');
            return;
        }
        setAddingBooth(true);
        try {
            const res = await fetch(`${API}/polling-center/${centerId}/booths`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booth_number: num }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            const created: Booth = await res.json();
            setBooths((prev) => [...prev, created].sort((a, b) => a.booth_number - b.booth_number));
            setNewBoothNumber('');
            setShowAddBooth(false);
            toast.success(`Booth #${created.booth_number} added`);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to add booth');
        } finally {
            setAddingBooth(false);
        }
    };

    // ── Rename booth ──────────────────────────────────────────────────────────
    const startRename = (boothNumber: number) => {
        setRenamingBooth(boothNumber);
        setRenameValue(String(boothNumber));
    };

    const saveRename = async (oldNumber: number) => {
        const newNum = parseInt(renameValue);
        if (isNaN(newNum) || newNum < 1) { toast.error('Enter a valid booth number'); return; }
        if (newNum === oldNumber) { setRenamingBooth(null); return; }
        setSavingRename(true);
        try {
            const res = await fetch(`${API}/polling-center/${centerId}/booths/${oldNumber}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_booth_number: newNum }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            setBooths((prev) =>
                prev.map((b) => b.booth_number === oldNumber ? { ...b, booth_number: newNum } : b)
                    .sort((a, b) => a.booth_number - b.booth_number)
            );
            setRenamingBooth(null);
            toast.success('Booth renamed');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to rename');
        } finally {
            setSavingRename(false);
        }
    };

    // ── Add officer ───────────────────────────────────────────────────────────
    const saveOfficer = async (boothNumber: number) => {
        if (!newOfficerId) { toast.error('Select an officer'); return; }
        setSavingOfficer(true);
        try {
            const res = await fetch(`${API}/polling-center/${centerId}/booths/${boothNumber}/officers`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ po_id: newOfficerId }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            const assignment: OfficerAssignment = await res.json();
            setBooths((prev) =>
                prev.map((b) =>
                    b.booth_number === boothNumber
                        ? { ...b, officers: [...b.officers, assignment] }
                        : b
                )
            );
            setAddingOfficerTo(null);
            setNewOfficerId(null);
            toast.success('Officer assigned');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to assign officer');
        } finally {
            setSavingOfficer(false);
        }
    };

    // ── Remove officer ────────────────────────────────────────────────────────
    const removeOfficer = async (boothNumber: number, boothId: number) => {
        setDeletingAssignments((prev) => new Set(prev).add(boothId));
        try {
            const res = await fetch(`${API}/polling-center/assignment/${boothId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to remove');
            setBooths((prev) =>
                prev.map((b) =>
                    b.booth_number === boothNumber
                        ? { ...b, officers: b.officers.filter((o) => o.booth_id !== boothId) }
                        : b
                )
            );
            toast.success('Officer removed');
        } catch {
            toast.error('Failed to remove officer');
        } finally {
            setDeletingAssignments((prev) => { const n = new Set(prev); n.delete(boothId); return n; });
        }
    };

    // ── Delete booth ──────────────────────────────────────────────────────────
    const deleteBooth = async (boothNumber: number) => {
        setDeletingBooths((prev) => new Set(prev).add(boothNumber));
        try {
            const res = await fetch(`${API}/polling-center/${centerId}/booths/${boothNumber}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete');
            setBooths((prev) => prev.filter((b) => b.booth_number !== boothNumber));
            toast.success(`Booth #${boothNumber} deleted`);
        } catch {
            toast.error('Failed to delete booth');
        } finally {
            setDeletingBooths((prev) => { const n = new Set(prev); n.delete(boothNumber); return n; });
        }
    };

    // ── Loading / Error ───────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center py-20"><Spinner className="size-6" /></div>
    );
    if (error || !info) return (
        <div className="p-8 max-w-6xl mx-auto">
            <p className="text-destructive">{error ?? 'Center not found'}</p>
        </div>
    );

    const elCfg = electionStatusConfig[info.election_status] ?? electionStatusConfig.PLANNED;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

            {/* ── Back + Title ─────────────────────────────────────────────────── */}
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
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl font-black tracking-tight">{info.center_name}</h1>
                    <Badge variant="secondary" className="text-xs">{info.constituency_name}</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{info.address}</p>
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
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start</Label>
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                            {formatDateTime(info.start_date)}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">End</Label>
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                            {formatDateTime(info.end_date)}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</Label>
                        <Badge
                            variant="outline"
                            className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight ${elCfg.className}`}
                        >
                            {elCfg.label}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* ── Booths ───────────────────────────────────────────────────────── */}
            <div className="space-y-4">
                {/* Section header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            Polling Booths
                        </h2>
                        <Badge variant="secondary" className="text-xs">{booths.length}</Badge>
                    </div>
                    {!showAddBooth && (
                        <Button size="sm" variant="outline" onClick={() => setShowAddBooth(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Booth
                        </Button>
                    )}
                </div>

                {/* Add booth form */}
                {showAddBooth && (
                    <div className="bg-primary/5 border rounded-xl px-5 py-4 flex items-center gap-3">
                        <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                            type="number"
                            min={1}
                            placeholder="Booth number"
                            value={newBoothNumber}
                            onChange={(e) => setNewBoothNumber(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addBooth()}
                            className="h-9 w-36"
                            autoFocus
                        />
                        <div className="flex gap-1.5 ml-auto">
                            <Button
                                size="sm"
                                onClick={addBooth}
                                disabled={addingBooth}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {addingBooth ? <Spinner className="size-3.5" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setShowAddBooth(false); setNewBoothNumber(''); }}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {booths.length === 0 && !showAddBooth && (
                    <div className="bg-card border rounded-xl py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                            <Hash className="h-8 w-8 opacity-40" />
                            <p className="font-medium">No booths yet</p>
                            <p className="text-xs">Add a booth to get started.</p>
                        </div>
                    </div>
                )}

                {/* Booth cards */}
                {booths.map((booth) => {
                    const isDeleting = deletingBooths.has(booth.booth_number);
                    const isRenamingThis = renamingBooth === booth.booth_number;
                    const isAddingOfficerHere = addingOfficerTo === booth.booth_number;
                    const assignedIds = booth.officers.map((o) => o.po_id);

                    return (
                        <div
                            key={booth.booth_number}
                            className={`bg-card border rounded-xl shadow-sm overflow-hidden transition-opacity ${isDeleting ? 'opacity-50' : ''}`}
                        >
                            {/* Booth header */}
                            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    {isRenamingThis ? (
                                        <div className="flex items-center gap-2">
                                            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <Input
                                                type="number"
                                                min={1}
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(booth.booth_number); if (e.key === 'Escape') setRenamingBooth(null); }}
                                                className="h-7 w-24 text-sm"
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => saveRename(booth.booth_number)}
                                                disabled={savingRename}
                                            >
                                                {savingRename ? <Spinner className="size-3" /> : <Save className="h-3 w-3" />}
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setRenamingBooth(null)}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <h3 className="text-sm font-bold">
                                            Booth <span className="text-primary">#{booth.booth_number}</span>
                                        </h3>
                                    )}
                                    <Badge variant="secondary" className="text-xs">
                                        {booth.officers.length} officer{booth.officers.length !== 1 ? 's' : ''}
                                    </Badge>
                                </div>

                                {!isRenamingThis && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2"
                                            onClick={() => startRename(booth.booth_number)}
                                            disabled={isDeleting}
                                            title="Rename booth"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                    disabled={isDeleting}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Booth #{booth.booth_number}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will remove the booth and all its officer assignments. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => deleteBooth(booth.booth_number)}
                                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                    >
                                                        Delete Booth
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}
                            </div>

                            {/* Officers list */}
                            <div className="px-5 py-3 space-y-2">
                                {booth.officers.length === 0 && !isAddingOfficerHere && (
                                    <p className="text-xs text-muted-foreground italic py-1">No officers assigned.</p>
                                )}

                                {booth.officers.map((officer) => {
                                    const isDeletingThis = deletingAssignments.has(officer.booth_id);
                                    return (
                                        <div
                                            key={officer.booth_id}
                                            className={`flex items-center justify-between rounded-lg px-3 py-2 bg-muted/40 transition-opacity ${isDeletingThis ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-background border flex items-center justify-center">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                                <span className="text-sm font-medium">{officer.po_name}</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => removeOfficer(booth.booth_number, officer.booth_id)}
                                                disabled={isDeletingThis}
                                                title="Remove officer"
                                            >
                                                {isDeletingThis ? <Spinner className="size-3" /> : <X className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                    );
                                })}

                                {/* Inline add officer row */}
                                {isAddingOfficerHere ? (
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="flex-1">
                                            <POCombobox
                                                value={newOfficerId}
                                                onChange={setNewOfficerId}
                                                poUsers={poUsers}
                                                excludeIds={assignedIds}
                                                placeholder="Select polling officer…"
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => saveOfficer(booth.booth_number)}
                                            disabled={savingOfficer || !newOfficerId}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                        >
                                            {savingOfficer ? <Spinner className="size-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="shrink-0"
                                            onClick={() => { setAddingOfficerTo(null); setNewOfficerId(null); }}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2"
                                        onClick={() => {
                                            setAddingOfficerTo(booth.booth_number);
                                            setNewOfficerId(null);
                                        }}
                                        disabled={isDeleting}
                                    >
                                        <UserPlus className="h-3 w-3" />
                                        Add Officer
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PollingCenterDetailsContent;
