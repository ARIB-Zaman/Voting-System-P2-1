import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ListView } from '@/components/refine-ui/views/list-view';
import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/auth-client';

interface UploadSummary {
    total: number;
    added: number;
    skipped: number;
    errors: number;
}

const BulkUploadVoters = () => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<UploadSummary | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setSummary(null);
        }
    };

    const parseCSV = (text: string) => {
        const lines = text.split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const voters = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(',').map(v => v.trim());
            const voter: any = {};
            headers.forEach((header, index) => {
                if (index < values.length) {
                    voter[header] = values[index];
                }
            });
            voters.push(voter);
        }
        return voters;
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("Please select a CSV file first.");
            return;
        }

        setLoading(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            const text = e.target?.result as string;
            const voters = parseCSV(text);

            if (voters.length === 0) {
                toast.error("No data found in the CSV file.");
                setLoading(false);
                return;
            }

            try {
                const res = await apiFetch('/api/voters/bulk-upload-voters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voters })
                });

                const data = await res.json();
                if (res.ok) {
                    toast.success("Bulk upload completed.");
                    setSummary(data.summary);
                } else {
                    toast.error(data.error || "Upload failed.");
                }
            } catch (err) {
                toast.error("Network error.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        reader.readAsText(file);
    };

    return (
        <ListView>
            <Breadcrumb />
            <div className="flex flex-col items-center p-6 gap-6">
                <Card className="w-full max-w-2xl shadow-lg border-muted/20">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <Upload className="h-6 w-6 text-primary" />
                            Bulk Upload Voters
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4 transition-colors hover:border-primary/30">
                            <div className="bg-primary/10 p-4 rounded-full text-primary">
                                <FileText className="h-10 w-10" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Choose CSV File</h3>
                                <p className="text-sm text-muted-foreground mt-1 text-balance">
                                    CSV must include headers: <code className="text-primary bg-primary/5 px-1 rounded">nid, name, phone, email, voter_type, constituency_id, lat, lng</code><br/>
                                    <span className="text-xs text-muted-foreground/80">Note: voter_type must be either <code className="font-bold">NORMAL</code> or <code className="font-bold">POSTAL</code></span>
                                </p>
                            </div>
                            <input 
                                type="file" 
                                id="csvFile" 
                                accept=".csv" 
                                onChange={handleFileChange} 
                                className="hidden" 
                            />
                            <Button asChild variant="outline" className="mt-2">
                                <label htmlFor="csvFile" className="cursor-pointer">
                                    {file ? file.name : "Select CSV File"}
                                </label>
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end border-t pt-6 bg-muted/5 rounded-b-xl">
                        <Button 
                            onClick={handleUpload} 
                            disabled={loading || !file}
                            className="w-full md:w-auto px-8"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? "Processing..." : "Start Upload"}
                        </Button>
                    </CardFooter>
                </Card>

                {summary && (
                    <Card className="w-full max-w-2xl border-primary/20 bg-primary/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CardHeader className="bg-primary/10 border-b border-primary/10">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                Process Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-background rounded-lg border shadow-sm text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total</p>
                                    <p className="text-2xl font-bold mt-1">{summary.total}</p>
                                </div>
                                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-100 dark:border-green-900 shadow-sm text-center">
                                    <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider font-semibold">Success</p>
                                    <p className="text-2xl font-bold mt-1 text-green-700 dark:text-green-300">{summary.added}</p>
                                </div>
                                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900 shadow-sm text-center">
                                    <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">Skipped</p>
                                    <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">{summary.skipped}</p>
                                </div>
                                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900 shadow-sm text-center">
                                    <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wider font-semibold">Errors</p>
                                    <p className="text-2xl font-bold mt-1 text-red-700 dark:text-red-300">{summary.errors}</p>
                                </div>
                            </div>
                            
                            {summary.skipped > 0 && (
                                <div className="mt-6 flex items-start gap-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-900">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <p>Some rows were skipped. This typically happens if the NID already exists in the master list or if required fields (NID, Name, Constituency ID) are missing.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </ListView>
    );
};

export default BulkUploadVoters;
