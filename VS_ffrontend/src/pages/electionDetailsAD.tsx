import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Eye,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth-client';

// ── Types ────────────────────────────────────────────────────────────────────

interface Election {
  election_id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Constituency {
  coe_id: number;
  constituency_id: number;
  name: string;
  region: string;
  ro_id: string | null;
  ro_name: string | null;
}

interface AssignableUser {
  id: string;
  name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = '/api';

const statusConfig: Record<string, { label: string; className: string }> = {
  LIVE: {
    label: 'Active',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  PLANNED: {
    label: 'Scheduled',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  CLOSED: {
    label: 'Completed',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  FINALIZED: {
    label: 'Finalized',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
};

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ── RO Combobox Component ────────────────────────────────────────────────────

const ROCombobox: React.FC<{
  value: string | null;
  onChange: (id: string | null, name: string | null) => void;
  users: AssignableUser[];
}> = ({ value, onChange, users }) => {
  const [open, setOpen] = useState(false);

  const selected = users.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          {selected ? selected.name : 'Select user (optional)…'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users…" />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {/* Allow clearing */}
              <CommandItem
                onSelect={() => {
                  onChange(null, null);
                  setOpen(false);
                }}
                className="text-muted-foreground italic"
              >
                <span>None (unassign)</span>
                {!value && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => {
                    onChange(u.id, u.name);
                    setOpen(false);
                  }}
                >
                  {u.name}
                  {value === u.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const ElectionDetailsAD: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Data state ───────────────────────────────────────────────────────────
  const [election, setElection] = useState<Election | null>(null);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Election edit state ──────────────────────────────────────────────────
  const [editingInfo, setEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Election>>({});
  const [savingInfo, setSavingInfo] = useState(false);

  // (Add constituency removed — managed elsewhere)

  // ── Inline RO edit state ─────────────────────────────────────────────────
  const [editingRoCoeId, setEditingRoCoeId] = useState<number | null>(null);
  const [savingRoCoeId, setSavingRoCoeId] = useState<number | null>(null);
  
  // ── Available constituencies state ───────────────────────────────────────
  const [unassignedConstituencies, setUnassignedConstituencies] = useState<{ id: number; name: string; region: string }[]>([]);
  const [addingConstituency, setAddingConstituency] = useState(false);

  // ── Delete election state ────────────────────────────────────────────────
  const [deletingElection, setDeletingElection] = useState(false);

  // ── Remove constituency state ────────────────────────────────────────────
  const [deletingCoeId, setDeletingCoeId] = useState<number | null>(null);

  // ── Voters Management state ──────────────────────────────────────────────
  const [assignedVoters, setAssignedVoters] = useState<any[]>([]);
  const [assignedVoterSearch, setAssignedVoterSearch] = useState('');
  const [assignedConstituencyFilter, setAssignedConstituencyFilter] = useState<string>('all');
  const [removingVoterNid, setRemovingVoterNid] = useState<string | null>(null);

  // ── Add Voters Dialog state ──────────────────────────────────────────────
  const [addVoterDialogOpen, setAddVoterDialogOpen] = useState(false);
  const [dialogVoters, setDialogVoters] = useState<any[]>([]);
  const [dialogSearch, setDialogSearch] = useState('');
  const [dialogConstituencyFilter, setDialogConstituencyFilter] = useState<string>('all');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedVoterNids, setSelectedVoterNids] = useState<Set<string>>(new Set());
  const [addingVoters, setAddingVoters] = useState(false);

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchElection = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`${API}/election/${id}`);
      if (!res.ok) throw new Error('Failed to fetch election');
      const data = await res.json();
      setElection(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [id]);

  const fetchConstituencies = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`${API}/constituency_of_election/election/${id}`);
      if (!res.ok) throw new Error('Failed to fetch constituencies');
      const data = await res.json();
      setConstituencies(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load constituencies');
    }
  }, [id]);

  const fetchAssignableUsers = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`${API}/users/assignable-for-election?election_id=${id}`);
      if (!res.ok) throw new Error('Failed to fetch assignable users');
      const data = await res.json();
      setAssignableUsers(data);
    } catch {
      // Non-critical
    }
  }, [id]);

  const fetchUnassignedConstituencies = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`${API}/constituency/unassigned/${id}`);
      if (!res.ok) throw new Error('Failed to fetch unassigned constituencies');
      const data = await res.json();
      setUnassignedConstituencies(data);
    } catch {
      // Non-critical, just keep empty
    }
  }, [id]);

  const fetchAssignedVoters = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`${API}/voter-allocation/election/${id}`);
      if (!res.ok) throw new Error('Failed to fetch assigned voters');
      const data = await res.json();
      setAssignedVoters(data);
    } catch (e: any) {
      console.error(e.message);
    }
  }, [id]);

  const fetchDialogVoters = useCallback(async (constituencyId: string, search: string) => {
    if (!id || !constituencyId || constituencyId === 'all') {
      setDialogVoters([]);
      return;
    }
    setDialogLoading(true);
    try {
      const params = new URLSearchParams({
        election_id: id,
        constituency_id: constituencyId,
        q: search,
        not_in_election: 'true',
        limit: '200',
      });
      const res = await apiFetch(`${API}/voter-allocation/search?${params}`);
      if (!res.ok) throw new Error('Failed to fetch voters');
      const data = await res.json();
      setDialogVoters(data);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setDialogLoading(false);
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchElection(),
        fetchConstituencies(),
        fetchAssignableUsers(),
        fetchUnassignedConstituencies(),
        fetchAssignedVoters(),
      ]);
      setLoading(false);
    })();
  }, [fetchElection, fetchConstituencies, fetchAssignableUsers, fetchUnassignedConstituencies, fetchAssignedVoters]);

  // ── Election edit handlers ───────────────────────────────────────────────
  const startEditInfo = () => {
    if (!election) return;
    setEditForm({
      name: election.name,
      description: election.description ?? '',
      start_date: toDatetimeLocal(election.start_date),
      end_date: toDatetimeLocal(election.end_date),
      status: election.status,
    });
    setEditingInfo(true);
  };

  const cancelEditInfo = () => {
    setEditingInfo(false);
    setEditForm({});
  };

  const saveElectionInfo = async () => {
    if (!election) return;
    setSavingInfo(true);
    try {
      const body: Record<string, unknown> = { ...editForm };
      // Convert datetime-local back to ISO
      if (body.start_date)
        body.start_date = new Date(body.start_date as string).toISOString();
      if (body.end_date)
        body.end_date = new Date(body.end_date as string).toISOString();

      const res = await apiFetch(`${API}/election/${election.election_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setElection(updated);
      setEditingInfo(false);
      toast.success('Election updated');
    } catch {
      toast.error('Failed to update election');
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Delete election ──────────────────────────────────────────────────────
  const deleteElection = async () => {
    if (!election) return;
    setDeletingElection(true);
    try {
      const res = await apiFetch(`${API}/election/${election.election_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Election deleted');
      navigate('/homeAdmin');
    } catch {
      toast.error('Failed to delete election');
    } finally {
      setDeletingElection(false);
    }
  };

  // ── Constituency handlers ────────────────────────────────────────────────
  const openRoEditor = async (c: Constituency) => {
    // Re-fetch election-scoped eligible users each time the editor opens
    if (id) {
      try {
        const res = await apiFetch(`${API}/users/assignable-for-election?election_id=${id}`);
        if (res.ok) setAssignableUsers(await res.json());
      } catch { /* non-critical */ }
    }
    setEditingRoCoeId(c.coe_id);
  };

  const saveRO = async (coeId: number, roId: string | null) => {
    setSavingRoCoeId(coeId);
    try {
      const res = await apiFetch(`${API}/constituency_of_election/${coeId}/ro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ro_id: roId }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setConstituencies((prev) =>
        prev.map((c) => (c.coe_id === coeId ? updated : c))
      );
      setEditingRoCoeId(null);
      toast.success('Returning officer updated');
    } catch {
      toast.error('Failed to update returning officer');
    } finally {
      setSavingRoCoeId(null);
    }
  };

  const addConstituency = async (constituencyId: number) => {
    if (!election) return;
    setAddingConstituency(true);
    try {
      const res = await apiFetch(`${API}/constituency_of_election`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          election_id: election.election_id,
          constituency_ids: [constituencyId],
        }),
      });
      if (!res.ok) throw new Error('Add failed');
      
      toast.success('Constituency added to election');
      // Refresh the lists
      await Promise.all([fetchConstituencies(), fetchUnassignedConstituencies()]);
    } catch {
      toast.error('Failed to add constituency');
    } finally {
      setAddingConstituency(false);
    }
  };

  const deleteConstituency = async (coeId: number) => {
    setDeletingCoeId(coeId);
    try {
      const res = await apiFetch(`${API}/constituency_of_election/${coeId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Constituency removed from election');
      // Refresh the lists
      await Promise.all([fetchConstituencies(), fetchUnassignedConstituencies()]);
    } catch {
      toast.error('Failed to remove constituency');
    } finally {
      setDeletingCoeId(null);
    }
  };

  // ── Voter actions ────────────────────────────────────────────────────────
  const openAddVoterDialog = () => {
    setSelectedVoterNids(new Set());
    setDialogSearch('');
    setDialogConstituencyFilter('all');
    setDialogVoters([]);
    setAddVoterDialogOpen(true);
  };

  const handleDialogConstituencyChange = (value: string) => {
    setDialogConstituencyFilter(value);
    setSelectedVoterNids(new Set());
    fetchDialogVoters(value, dialogSearch);
  };

  const handleDialogSearchChange = (value: string) => {
    setDialogSearch(value);
    fetchDialogVoters(dialogConstituencyFilter, value);
  };

  const toggleVoter = (nid: string) => {
    setSelectedVoterNids((prev) => {
      const next = new Set(prev);
      next.has(nid) ? next.delete(nid) : next.add(nid);
      return next;
    });
  };

  const toggleAllVoters = () => {
    const allSelected = dialogVoters.length > 0 && dialogVoters.every((v) => selectedVoterNids.has(v.nid));
    setSelectedVoterNids((prev) => {
      const next = new Set(prev);
      dialogVoters.forEach((v) => (allSelected ? next.delete(v.nid) : next.add(v.nid)));
      return next;
    });
  };

  const addSelectedVoters = async () => {
    if (!id || selectedVoterNids.size === 0) return;
    setAddingVoters(true);
    let successCount = 0;
    let failCount = 0;
    for (const nid of selectedVoterNids) {
      try {
        const res = await apiFetch(`${API}/voter-allocation/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nid, election_id: id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) toast.success(`${successCount} voter(s) added to election`);
    if (failCount > 0) toast.error(`${failCount} voter(s) could not be added`);
    setAddingVoters(false);
    setAddVoterDialogOpen(false);
    await fetchAssignedVoters();
  };

  const removeVoter = async (voter: any) => {
    if (!id) return;
    setRemovingVoterNid(voter.nid);
    try {
      const res = await apiFetch(`${API}/voter-allocation/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nid: voter.nid,
          election_id: id
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Removal failed');
      toast.success(`Voter ${voter.name} removed`);
      await fetchAssignedVoters();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRemovingVoterNid(null);
    }
  };

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-destructive">{error ?? 'Election not found'}</p>
      </div>
    );
  }

  const cfg = statusConfig[election.status] ?? statusConfig.PLANNED;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* ── Back + Header ──────────────────────────────────────────────── */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 text-muted-foreground -ml-2"
          onClick={() => navigate('/homeAdmin')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Elections
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">
              {election.name}
            </h1>
            <Badge
              variant="outline"
              className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 uppercase tracking-tight ${cfg.className}`}
            >
              {cfg.label}
            </Badge>
          </div>
          <div className="flex gap-2">
            {!editingInfo && (
              <Button variant="outline" size="sm" onClick={startEditInfo}>
                <Edit3 className="h-4 w-4 mr-1" />
                Edit Info
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete "{election.name}"?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the election and
                    all its constituencies. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteElection}
                    disabled={deletingElection}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    {deletingElection ? 'Deleting…' : 'Delete Election'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* ── General Information ────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            General Information
          </h2>
          {editingInfo && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEditInfo}
                disabled={savingInfo}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveElectionInfo}
                disabled={savingInfo}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {savingInfo ? (
                  <Spinner className="size-4 mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Election Name
            </Label>
            {editingInfo ? (
              <Input
                value={editForm.name ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            ) : (
              <p className="text-sm font-medium">{election.name}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Status
            </Label>
            {editingInfo ? (
              <Select
                value={editForm.status}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNED">Scheduled</SelectItem>
                  <SelectItem value="LIVE">Active</SelectItem>
                  <SelectItem value="CLOSED">Completed</SelectItem>
                  <SelectItem value="FINALIZED">Finalized</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant="outline"
                className={`border-0 text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.className}`}
              >
                {cfg.label}
              </Badge>
            )}
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Start Date
            </Label>
            {editingInfo ? (
              <Input
                type="datetime-local"
                value={editForm.start_date ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    start_date: e.target.value,
                  }))
                }
              />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {formatDateShort(election.start_date)}
              </div>
            )}
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              End Date
            </Label>
            {editingInfo ? (
              <Input
                type="datetime-local"
                value={editForm.end_date ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    end_date: e.target.value,
                  }))
                }
              />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {formatDateShort(election.end_date)}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Description
            </Label>
            {editingInfo ? (
              <Textarea
                value={editForm.description ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {election.description || 'No description provided.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Constituencies Table ────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Constituencies
            </h2>
            <Badge variant="secondary" className="text-xs">
              {constituencies.length}
            </Badge>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Name
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Region
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">
                Returning Officer
              </TableHead>
              <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {constituencies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-12 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <MapPin className="h-8 w-8 opacity-40" />
                    <p className="font-medium">No constituencies yet</p>
                    <p className="text-xs">
                      Add a constituency to get started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              constituencies.map((c) => (
                <TableRow
                  key={c.coe_id}
                  className="hover:bg-muted/40 transition-colors"
                >
                  {/* Name */}
                  <TableCell className="px-6 py-4">
                    <p className="text-sm font-medium">{c.name}</p>
                  </TableCell>

                  {/* Region */}
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.region}
                    </div>
                  </TableCell>

                  {/* Returning Officer — inline click-to-edit */}
                  <TableCell className="px-6 py-4">
                    {editingRoCoeId === c.coe_id ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[260px]">
                          <ROCombobox
                            value={c.ro_id}
                            onChange={(roId) => {
                              setEditingRoCoeId(null);
                              saveRO(c.coe_id, roId);
                            }}
                            users={assignableUsers}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={() => setEditingRoCoeId(null)}
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openRoEditor(c)}
                        className="text-left hover:underline cursor-pointer group flex items-center gap-1.5"
                        title="Click to assign / change RO"
                        disabled={savingRoCoeId === c.coe_id}
                      >
                        {savingRoCoeId === c.coe_id ? (
                          <Spinner className="size-3.5" />
                        ) : c.ro_name ? (
                          <>
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{c.ro_name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            Assign RO…
                          </span>
                        )}
                      </button>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          navigate(
                            `/homeAdmin/showElection/${id}/constituency/${c.constituency_id}`
                          )
                        }
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Remove from election"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Constituency</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove <strong>{c.name}</strong> from this election? This will also remove any Returning Officer assignment for this mapping.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteConstituency(c.coe_id)}
                              disabled={deletingCoeId === c.coe_id}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              {deletingCoeId === c.coe_id ? 'Removing…' : 'Remove'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>



      {/* ── Available Constituencies Badge Picker ──────────────────────── */}
      {unassignedConstituencies.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Available Constituencies
            </h2>
            <Badge variant="secondary" className="text-xs">
              {unassignedConstituencies.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Click a constituency to add it to this election.
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedConstituencies.map((c) => (
              <Badge
                key={c.id}
                variant="secondary"
                className={`cursor-pointer px-3 py-1.5 transition-colors hover:bg-primary hover:text-primary-foreground ${
                  addingConstituency ? 'opacity-50 pointer-events-none' : ''
                }`}
                onClick={() => addConstituency(c.id)}
              >
                {c.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      
      {/* ── Voter Management Section ───────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Voters Management</h2>
        </div>

        {/* Assigned Voters Table */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Assigned Voters
              </h3>
              <Badge variant="secondary" className="text-xs">
                {assignedVoters.length}
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {/* Constituency filter */}
              <Select value={assignedConstituencyFilter} onValueChange={setAssignedConstituencyFilter}>
                <SelectTrigger className="h-9 sm:w-48 text-xs">
                  <SelectValue placeholder="All Constituencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Constituencies</SelectItem>
                  {constituencies.map((c) => (
                    <SelectItem key={c.constituency_id} value={c.constituency_id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Name / NID search */}
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or NID..."
                  value={assignedVoterSearch}
                  onChange={(e) => setAssignedVoterSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-primary border-primary/30 hover:bg-primary/10 h-9 shrink-0"
                onClick={openAddVoterDialog}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Voters
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">NID</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Name</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Constituency</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const filteredAssignedVoters = assignedVoters.filter(v => {
                    const matchesSearch =
                      v.name.toLowerCase().includes(assignedVoterSearch.toLowerCase()) ||
                      v.nid.toString().toLowerCase().includes(assignedVoterSearch.toLowerCase());
                    const matchesConstituency =
                      assignedConstituencyFilter === 'all' ||
                      v.constituency_id?.toString() === assignedConstituencyFilter;
                    return matchesSearch && matchesConstituency;
                  });

                  return filteredAssignedVoters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-14 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 opacity-30" />
                          <p className="font-medium">
                            {assignedVoters.length === 0 ? "No voters assigned yet" : "No voters match your search"}
                          </p>
                          <p className="text-xs">
                            {assignedVoters.length === 0 ? "Click \"Add Voters\" to get started." : "Try adjusting your search or constituency filter."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssignedVoters.map((v) => (
                      <TableRow key={v.nid} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="px-6 py-3 font-mono text-xs">{v.nid}</TableCell>
                      <TableCell className="px-6 py-3 font-medium">{v.name}</TableCell>
                      <TableCell className="px-6 py-3">
                        {v.constituency_name ? (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[140px]" title={v.constituency_name}>{v.constituency_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-3">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight">
                          {v.voter_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-3 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={removingVoterNid === v.nid}
                            >
                              {removingVoterNid === v.nid ? (
                                <Spinner className="size-3 mr-1" />
                              ) : (
                                <X className="h-4 w-4 mr-1" />
                              )}
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Voter</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove <strong>{v.name}</strong> from this election? This cannot be undone if they have not yet voted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeVoter(v)}
                                disabled={removingVoterNid === v.nid}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                    ))
                  );
                })()}
              </TableBody>
            </Table>
          </div>
          {assignedVoters.length > 0 && (
            <div className="px-6 py-3 bg-muted/30 border-t flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {assignedVoters.length} voter(s) assigned to this election
              </p>
              {assignedConstituencyFilter !== 'all' && (
                <button
                  onClick={() => setAssignedConstituencyFilter('all')}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add Voters Dialog */}
        <Dialog open={addVoterDialogOpen} onOpenChange={(o) => { if (!o) setAddVoterDialogOpen(false); }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Voters to Election</DialogTitle>
              <DialogDescription>
                Select a constituency, optionally search, then pick voters to assign.
              </DialogDescription>
            </DialogHeader>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={dialogConstituencyFilter} onValueChange={handleDialogConstituencyChange}>
                <SelectTrigger className="sm:w-56 flex-shrink-0">
                  <SelectValue placeholder="Filter by Constituency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select Constituency…</SelectItem>
                  {constituencies.map((c) => (
                    <SelectItem key={c.constituency_id} value={c.constituency_id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or NID…"
                  className="pl-9"
                  value={dialogSearch}
                  onChange={(e) => handleDialogSearchChange(e.target.value)}
                  disabled={dialogConstituencyFilter === 'all'}
                />
              </div>
            </div>

            {/* Voter list */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6 max-h-[45vh] space-y-1">
              {dialogConstituencyFilter === 'all' ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">Select a constituency to see voters</p>
                  <p className="text-xs mt-1">Voters not yet in this election will be shown.</p>
                </div>
              ) : dialogLoading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Spinner className="size-5" /> Loading…
                </div>
              ) : dialogVoters.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No unassigned voters found</p>
                  <p className="text-xs mt-1">All voters in this constituency may already be assigned.</p>
                </div>
              ) : (
                <>
                  {/* Select All row */}
                  <label className="flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer hover:bg-muted/40 rounded-md transition-colors">
                    <Checkbox
                      checked={dialogVoters.length > 0 && dialogVoters.every((v) => selectedVoterNids.has(v.nid))}
                      onCheckedChange={toggleAllVoters}
                    />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select All</span>
                    <span className="text-xs text-muted-foreground ml-auto">{dialogVoters.length} voter(s)</span>
                  </label>
                  {dialogVoters.map((v) => (
                    <label key={v.nid} className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/40 rounded-md transition-colors">
                      <Checkbox
                        checked={selectedVoterNids.has(v.nid)}
                        onCheckedChange={() => toggleVoter(v.nid)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{v.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{v.nid}</span>
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tight">
                            {v.voter_type}
                          </Badge>
                        </div>
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>

            <DialogFooter className="border-t pt-4 flex items-center !justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedVoterNids.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setAddVoterDialogOpen(false)} disabled={addingVoters}>
                  Cancel
                </Button>
                <Button onClick={addSelectedVoters} disabled={selectedVoterNids.size === 0 || addingVoters}>
                  {addingVoters ? <Spinner className="size-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add Selected ({selectedVoterNids.size})
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      

    </div>
  );
};

export default ElectionDetailsAD;