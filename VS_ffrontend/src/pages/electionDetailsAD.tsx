import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Trash2,
  Users,
  X,
} from 'lucide-react';

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
  constituency_id: number;
  name: string;
  region: string;
  election_id: number;
  ro_id: string | null;
  ro_name: string | null;
}

interface ROUser {
  id: string;
  name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = 'http://localhost:3001/api';

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
  roUsers: ROUser[];
}> = ({ value, onChange, roUsers }) => {
  const [open, setOpen] = useState(false);

  const selected = roUsers.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          {selected ? selected.name : 'Select RO (optional)…'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search officers…" />
          <CommandList>
            <CommandEmpty>No officers found.</CommandEmpty>
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
              {roUsers.map((ro) => (
                <CommandItem
                  key={ro.id}
                  value={ro.name}
                  onSelect={() => {
                    onChange(ro.id, ro.name);
                    setOpen(false);
                  }}
                >
                  {ro.name}
                  {value === ro.id && (
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
  const [roUsers, setRoUsers] = useState<ROUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Election edit state ──────────────────────────────────────────────────
  const [editingInfo, setEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Election>>({});
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Add constituency state ───────────────────────────────────────────────
  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newRoId, setNewRoId] = useState<string | null>(null);
  const [addingConstituency, setAddingConstituency] = useState(false);

  // ── Edit constituency state ──────────────────────────────────────────────
  const [editingCId, setEditingCId] = useState<number | null>(null);
  const [editCForm, setEditCForm] = useState<{
    name: string;
    region: string;
    ro_id: string | null;
  }>({ name: '', region: '', ro_id: null });
  const [savingConstituency, setSavingConstituency] = useState(false);

  // ── Delete election state ────────────────────────────────────────────────
  const [deletingElection, setDeletingElection] = useState(false);

  // ── Processing set for constituency deletes ──────────────────────────────
  const [processingCIds, setProcessingCIds] = useState<Set<number>>(new Set());

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchElection = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/election/${id}`);
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
      const res = await fetch(`${API}/constituency/election/${id}`);
      if (!res.ok) throw new Error('Failed to fetch constituencies');
      const data = await res.json();
      setConstituencies(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load constituencies');
    }
  }, [id]);

  const fetchRoUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users/ro`);
      if (!res.ok) throw new Error('Failed to fetch ROs');
      const data = await res.json();
      setRoUsers(data);
    } catch {
      // Non-critical — RO dropdown will just be empty
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchElection(), fetchConstituencies(), fetchRoUsers()]);
      setLoading(false);
    })();
  }, [fetchElection, fetchConstituencies, fetchRoUsers]);

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

      const res = await fetch(`${API}/election/${election.election_id}`, {
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
      const res = await fetch(`${API}/election/${election.election_id}`, {
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
  const addConstituency = async () => {
    if (!newName.trim() || !newRegion.trim()) {
      toast.error('Name and region are required');
      return;
    }
    setAddingConstituency(true);
    try {
      const res = await fetch(`${API}/constituency/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          region: newRegion,
          election_id: Number(id),
          ro_id: newRoId,
        }),
      });
      if (!res.ok) throw new Error('Failed to add');
      const created = await res.json();
      setConstituencies((prev) => [...prev, created]);
      setNewName('');
      setNewRegion('');
      setNewRoId(null);
      setShowAddRow(false);
      toast.success('Constituency added');
    } catch {
      toast.error('Failed to add constituency');
    } finally {
      setAddingConstituency(false);
    }
  };

  const startEditConstituency = (c: Constituency) => {
    setEditingCId(c.constituency_id);
    setEditCForm({
      name: c.name,
      region: c.region,
      ro_id: c.ro_id,
    });
  };

  const cancelEditConstituency = () => {
    setEditingCId(null);
  };

  const saveConstituency = async () => {
    if (editingCId === null) return;
    setSavingConstituency(true);
    try {
      const res = await fetch(`${API}/constituency/${editingCId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCForm),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setConstituencies((prev) =>
        prev.map((c) => (c.constituency_id === editingCId ? updated : c))
      );
      setEditingCId(null);
      toast.success('Constituency updated');
    } catch {
      toast.error('Failed to update constituency');
    } finally {
      setSavingConstituency(false);
    }
  };

  const deleteConstituency = async (cId: number) => {
    setProcessingCIds((prev) => new Set(prev).add(cId));
    try {
      const res = await fetch(`${API}/constituency/${cId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setConstituencies((prev) =>
        prev.filter((c) => c.constituency_id !== cId)
      );
      toast.success('Constituency deleted');
    } catch {
      toast.error('Failed to delete constituency');
    } finally {
      setProcessingCIds((prev) => {
        const next = new Set(prev);
        next.delete(cId);
        return next;
      });
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

      {/* ── Constituencies ─────────────────────────────────────────────── */}
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
          {!showAddRow && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddRow(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Constituency
            </Button>
          )}
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
            {/* Add constituency row */}
            {showAddRow && (
              <TableRow className="bg-primary/5">
                <TableCell className="px-6 py-3">
                  <Input
                    placeholder="Constituency name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="px-6 py-3">
                  <Input
                    placeholder="Region"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="px-6 py-3">
                  <ROCombobox
                    value={newRoId}
                    onChange={(id) => setNewRoId(id)}
                    roUsers={roUsers}
                  />
                </TableCell>
                <TableCell className="px-6 py-3 text-right">
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      size="sm"
                      onClick={addConstituency}
                      disabled={addingConstituency}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {addingConstituency ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAddRow(false);
                        setNewName('');
                        setNewRegion('');
                        setNewRoId(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Constituency rows */}
            {constituencies.length === 0 && !showAddRow ? (
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
              constituencies.map((c) => {
                const isEditing = editingCId === c.constituency_id;
                const isProcessing = processingCIds.has(c.constituency_id);

                if (isEditing) {
                  return (
                    <TableRow
                      key={c.constituency_id}
                      className="bg-primary/5"
                    >
                      <TableCell className="px-6 py-3">
                        <Input
                          value={editCForm.name}
                          onChange={(e) =>
                            setEditCForm((f) => ({
                              ...f,
                              name: e.target.value,
                            }))
                          }
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="px-6 py-3">
                        <Input
                          value={editCForm.region}
                          onChange={(e) =>
                            setEditCForm((f) => ({
                              ...f,
                              region: e.target.value,
                            }))
                          }
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="px-6 py-3">
                        <ROCombobox
                          value={editCForm.ro_id}
                          onChange={(id) =>
                            setEditCForm((f) => ({
                              ...f,
                              ro_id: id,
                            }))
                          }
                          roUsers={roUsers}
                        />
                      </TableCell>
                      <TableCell className="px-6 py-3 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <Button
                            size="sm"
                            onClick={saveConstituency}
                            disabled={savingConstituency}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {savingConstituency ? (
                              <Spinner className="size-3.5" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditConstituency}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow
                    key={c.constituency_id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="px-6 py-4">
                      <p className="text-sm font-medium">
                        {c.name}
                      </p>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.region}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {c.ro_name ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.ro_name}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            startEditConstituency(c)
                          }
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              disabled={isProcessing}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete "{c.name}"?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently
                                remove this constituency
                                from the election.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteConstituency(
                                    c.constituency_id
                                  )
                                }
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

export default ElectionDetailsAD;