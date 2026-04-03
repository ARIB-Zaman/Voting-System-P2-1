import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Edit3, MapPin, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/auth-client';

const API = '/api';
const PAGE_SIZE = 20;

interface PollingCenter {
  id: number;
  name: string;
  address: string;
  constituency_id: number;
  constituency_name: string;
  lat: number | null;
  lng: number | null;
}

interface Constituency {
  id: number;
  name: string;
}

const ManagePollingCenters: React.FC = () => {
  const [centers, setCenters] = useState<PollingCenter[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterConstituency, setFilterConstituency] = useState('all');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editCenter, setEditCenter] = useState<PollingCenter | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', address: '', constituency_id: '', lat: '', lng: '',
  });
  const [saving, setSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCenters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterConstituency !== 'all') params.set('constituency_id', filterConstituency);
      if (search.trim()) params.set('q', search.trim());
      const res = await apiFetch(`${API}/admin-polling-centers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch polling centers');
      setCenters(await res.json());
      setPage(1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, filterConstituency]);

  useEffect(() => {
    apiFetch(`${API}/constituency`).then((r) => r.json()).then(setConstituencies).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchCenters, 300);
    return () => clearTimeout(timer);
  }, [fetchCenters]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await apiFetch(`${API}/admin-polling-centers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success(data.message);
      setCenters((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = (center: PollingCenter) => {
    setEditCenter(center);
    setEditForm({
      name: center.name,
      address: center.address,
      constituency_id: String(center.constituency_id),
      lat: center.lat != null ? String(center.lat) : '',
      lng: center.lng != null ? String(center.lng) : '',
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editCenter) return;
    if (!editForm.name || !editForm.address || !editForm.constituency_id) {
      toast.error('Name, Address, and Constituency are required');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`${API}/admin-polling-centers/${editCenter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          address: editForm.address,
          constituency_id: Number(editForm.constituency_id),
          lat: editForm.lat ? parseFloat(editForm.lat) : null,
          lng: editForm.lng ? parseFloat(editForm.lng) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success('Polling center updated');
      setEditOpen(false);
      fetchCenters();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(centers.length / PAGE_SIZE));
  const paginated = centers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Manage Polling Centers</h1>
          <p className="text-sm text-muted-foreground">View, edit, and delete polling centers from the master list</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or address…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterConstituency} onValueChange={setFilterConstituency}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="All Constituencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Constituencies</SelectItem>
            {constituencies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Polling Centers
          </h2>
          <Badge variant="secondary" className="text-xs">{centers.length}</Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner className="size-5" /> Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase">Name</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase">Address</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase">Constituency</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase">Coordinates</TableHead>
                  <TableHead className="px-6 py-3 text-xs font-bold uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 className="h-10 w-10 opacity-20" />
                        <p className="font-medium">No polling centers found</p>
                        <p className="text-xs">Try adjusting your search or filter</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="px-6 py-4 font-semibold">{c.name}</TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground max-w-[220px] truncate">
                        {c.address}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant="outline" className="text-xs">
                          {c.constituency_name ?? `#${c.constituency_id}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        {c.lat != null && c.lng != null ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {Number(c.lat).toFixed(4)}, {Number(c.lng).toFixed(4)}
                          </span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm" variant="ghost" className="h-8 w-8 p-0"
                            onClick={() => openEdit(c)} title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm" variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{c.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this polling center from the master list.
                                  This action cannot be undone.
                                  <br /><br />
                                  <strong>Note:</strong> If this center is assigned to an active election,
                                  deletion will be blocked.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(c.id)}
                                  disabled={deletingId === c.id}
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                  {deletingId === c.id ? 'Deleting…' : 'Delete'}
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
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, centers.length)} of {centers.length}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Polling Center</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Address *</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Constituency *</Label>
              <Select
                value={editForm.constituency_id}
                onValueChange={(v) => setEditForm(f => ({ ...f, constituency_id: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {constituencies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Latitude</Label>
                <Input
                  type="number" step="any"
                  value={editForm.lat}
                  onChange={(e) => setEditForm(f => ({ ...f, lat: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Longitude</Label>
                <Input
                  type="number" step="any"
                  value={editForm.lng}
                  onChange={(e) => setEditForm(f => ({ ...f, lng: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <><Spinner className="size-4 mr-1" /> Saving…</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagePollingCenters;
