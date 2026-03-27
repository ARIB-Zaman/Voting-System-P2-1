import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

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

interface EditVoterModalProps {
    voter: Voter | null;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    constituencies: { id: number; name: string }[];
}

const EditVoterModal: React.FC<EditVoterModalProps> = ({ voter, open, onClose, onSuccess, constituencies }) => {
    const [form, setForm] = useState<Voter | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (voter) {
            setForm({ ...voter });
        }
    }, [voter]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form) return;
        setLoading(true);

        try {
            const res = await fetch(`http://localhost:3001/api/voters/${form.nid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Voter updated successfully");
                onSuccess();
                onClose();
            } else {
                toast.error(data.error || "Update failed");
            }
        } catch (err) {
            toast.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    if (!form) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Voter: {form.nid}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input id="edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-phone">Phone</Label>
                            <Input id="edit-phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input id="edit-email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-type">Type</Label>
                            <Select value={form.voter_type} onValueChange={(val) => setForm({ ...form, voter_type: val })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NORMAL">NORMAL</SelectItem>
                                    <SelectItem value="POSTAL">POSTAL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Constituency</Label>
                            <Select value={form.constituency_id.toString()} onValueChange={(val) => setForm({ ...form, constituency_id: parseInt(val) })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {constituencies.map(c => (
                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-lat">Lat</Label>
                            <Input id="edit-lat" value={form.lat || ''} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-lng">Lng</Label>
                            <Input id="edit-lng" value={form.lng || ''} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EditVoterModal;
