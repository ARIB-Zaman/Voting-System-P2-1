import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UploadCloud, FileText, Download, Earth, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/auth-client';

const API = '/api';

interface CSVRow {
  name: string;
  region: string;
  latitude: string;
  longitude: string;
}

const EXPECTED_HEADERS = ['name', 'region', 'latitude', 'longitude'];

const BulkUploadConstituencies: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + EXPECTED_HEADERS.join(",") + "\n"
      + "Dhaka-10,Dhaka Metro,23.7465,90.3740\n"
      + "Chittagong-1,Chittagong North,22.3569,91.7832";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_constituencies.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const headers = results.meta.fields || [];
        const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          toast.error(`Invalid CSV format. Missing headers: ${missingHeaders.join(', ')}`);
          return;
        }

        setFile(file);
        setPreviewData(results.data as CSVRow[]);
        setUploadResults(null);
      },
      error: (error: any) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files[0].type === "text/csv" || e.dataTransfer.files[0].name.endsWith('.csv')) {
        processFile(e.dataTransfer.files[0]);
      } else {
        toast.error("Please drop a valid .csv file");
      }
    }
  };

  const handleUpload = async () => {
    if (previewData.length === 0) return;
    
    setIsUploading(true);
    setUploadResults(null);

    try {
      const res = await apiFetch(`${API}/constituency/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ constituencies: previewData }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload bulk data');
      }

      setUploadResults(data.results);
      
      if (data.results.failed === 0) {
        toast.success(`Successfully registered all ${data.results.inserted} constituencies!`);
        setFile(null);
        setPreviewData([]);
      } else {
        toast.warning(`Partial success: ${data.results.inserted} inserted, ${data.results.failed} failed.`);
      }

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewData([]);
    setUploadResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Earth className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Bulk Upload Constituencies</h1>
          <p className="text-sm text-muted-foreground">Import multiple defined electoral zones using a CSV file</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Upload Area */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
            
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => e.target.files && processFile(e.target.files[0])}
            />

            {!file ? (
              <div 
                className="w-full border-2 border-dashed rounded-lg p-8 hover:bg-muted/30 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <UploadCloud className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Click or drag CSV here</h3>
                <p className="text-xs text-muted-foreground">Maximum file size: 5MB</p>
              </div>
            ) : (
              <div className="w-full border rounded-lg p-6 flex flex-col items-center justify-center gap-3 bg-muted/20">
                <FileText className="h-10 w-10 text-primary" />
                <div>
                  <h3 className="font-semibold text-sm truncate max-w-[200px]">{file.name}</h3>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB • {previewData.length} rows</p>
                </div>
                <div className="flex gap-2 mt-2 w-full">
                  <Button variant="outline" size="sm" className="flex-1" onClick={clearFile} disabled={isUploading}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1" onClick={handleUpload} disabled={isUploading || previewData.length === 0}>
                    {isUploading ? <Spinner className="size-4" /> : 'Import'}
                  </Button>
                </div>
              </div>
            )}

            <div className="w-full border-t pt-4 mt-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={downloadSampleCSV}>
                <Download className="mr-2 h-4 w-4" /> Download Sample CSV
              </Button>
            </div>
          </div>

          {/* Results Summary Box */}
          {uploadResults && (
            <div className={`border rounded-xl p-5 ${uploadResults.failed > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                {uploadResults.failed > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                <h3 className="font-bold text-sm">Upload Summary</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div className="bg-background rounded-md p-2 border">
                  <span className="block text-xs text-muted-foreground uppercase">Inserted</span>
                  <span className="font-mono font-bold text-emerald-600 text-lg">{uploadResults.inserted}</span>
                </div>
                <div className="bg-background rounded-md p-2 border">
                  <span className="block text-xs text-muted-foreground uppercase">Failed</span>
                  <span className="font-mono font-bold text-destructive text-lg">{uploadResults.failed}</span>
                </div>
              </div>

              {uploadResults.errors && uploadResults.errors.length > 0 && (
                <div className="space-y-1 mt-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Error Details</p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs font-mono text-destructive bg-background/50 border rounded p-2">
                    {uploadResults.errors.map((err: string, i: number) => (
                      <div key={i} className="pb-1 border-b border-destructive/10 last:border-0 last:pb-0">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Preview Table */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-6 py-4 border-b bg-muted/30 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Data Preview
              </h2>
              {previewData.length > 0 && <span className="text-xs font-mono bg-background border px-2 py-0.5 rounded">{previewData.length} records</span>}
            </div>
            
            <div className="flex-1 overflow-auto min-h-[400px]">
              {previewData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12">
                  <FileText className="h-12 w-12 opacity-20 mb-4" />
                  <p className="font-medium">No data to preview</p>
                  <p className="text-xs mt-1">Upload a CSV file to see its contents here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-bold uppercase px-4 py-3">Name</TableHead>
                      <TableHead className="text-xs font-bold uppercase px-4 py-3">Region</TableHead>
                      <TableHead className="text-xs font-bold uppercase px-4 py-3 text-right">Lat / Lng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 100).map((row, i) => (
                      <TableRow key={i} className="text-sm">
                        <TableCell className="px-4 py-2 font-medium">{row.name || <span className="text-destructive text-xs italic">Missing</span>}</TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground">
                          {row.region || <span className="text-destructive text-xs italic">Missing</span>}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                          {row.latitude || '-'} , {row.longitude || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {previewData.length > 100 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t bg-muted/10">
                  Showing first 100 rows. Total rows: {previewData.length}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BulkUploadConstituencies;
