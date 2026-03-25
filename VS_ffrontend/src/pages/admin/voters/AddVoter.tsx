import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ListView } from '@/components/refine-ui/views/list-view';
import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';

interface Constituency {
    id: number;
    name: string;
}

const AddVoter = () => {
    const [constituencies, setConstituencies] = useState<Constituency[]>([]);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        nid: '',
        name: '',
        phone: '',
        email: '',
        voter_type: 'NORMAL',
        constituency_id: '',
        lat: '',
        lng: ''
    });

    useEffect(() => {
        fetch('http://localhost:3001/api/constituency')
            .then(res => res.json())
            .then(data => setConstituencies(data))
            .catch(err => console.error("Error fetching constituencies:", err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.id]: e.target.value });
    };

    const handleSelectChange = (val: string) => {
        setForm({ ...form, constituency_id: val });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('http://localhost:3001/api/voters/add-voter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                setForm({
                    nid: '',
                    name: '',
                    phone: '',
                    email: '',
                    voter_type: 'NORMAL',
                    constituency_id: '',
                    lat: '',
                    lng: ''
                });
            } else {
                toast.error(data.error || "Failed to add voter.");
            }
        } catch (err) {
            toast.error("Network error.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ListView>
            <Breadcrumb />
            <div className="flex justify-center p-6">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Add Single Voter</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="nid">NID (National ID)</Label>
                                    <Input id="nid" value={form.nid} onChange={handleChange} required placeholder="Unique NID" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" value={form.name} onChange={handleChange} required placeholder="Voter Name" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input id="phone" value={form.phone} onChange={handleChange} placeholder="Phone Number" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" value={form.email} onChange={handleChange} placeholder="Email Address" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="voter_type">Voter Type</Label>
                                    <Select 
                                        value={form.voter_type} 
                                        onValueChange={(val) => setForm({...form, voter_type: val})}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NORMAL">NORMAL</SelectItem>
                                            <SelectItem value="POSTAL">POSTAL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="constituency_id">Constituency</Label>
                                    <Select value={form.constituency_id} onValueChange={handleSelectChange} required>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select constituency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {constituencies.map((c) => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lat">Latitude</Label>
                                    <Input id="lat" value={form.lat} onChange={handleChange} placeholder="e.g. 23.8103" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lng">Longitude</Label>
                                    <Input id="lng" value={form.lng} onChange={handleChange} placeholder="e.g. 90.4125" />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={loading} className="w-full md:w-auto">
                                    {loading ? "Adding..." : "Add Voter"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </ListView>
    );
};

export default AddVoter;
