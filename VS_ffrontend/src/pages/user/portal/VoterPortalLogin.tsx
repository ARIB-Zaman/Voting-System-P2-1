import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Fingerprint, Search, ShieldAlert, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

const VoterPortalLogin: React.FC = () => {
  const [nid, setNid] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nid.trim()) return toast.warning('Please enter your National ID (NID)');

    setLoading(true);
    try {
      // Check if the NID exists / has assignments
      const res = await fetch(`http://localhost:3001/api/voter-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nid: nid.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('voterNid', nid.trim());
        sessionStorage.setItem('voterName', data.name);
        toast.success('Access granted to Voter Portal');
        navigate('/voter-portal/dashboard');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Invalid NID or no records found.');
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-neutral-100/50 dark:bg-neutral-950/20">
      <Card className="w-full max-w-md border-none shadow-premium-lg overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="h-2 bg-primary w-full" />
        <CardHeader className="text-center pt-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary shadow-inner">
            <Fingerprint className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight">Identity Verification</CardTitle>
          <CardDescription className="text-sm font-medium">Enter your National Identity Number (NID) to access the voter dashboard.</CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          <form onSubmit={handleEnter} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">National ID (NID)</label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="e.g. 192837465"
                  className="pl-11 h-12 text-lg font-black tracking-widest border-2 focus-visible:ring-primary shadow-sm"
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-black tracking-tight gap-2" 
              disabled={loading}
            >
              {loading ? <Spinner className="h-5 w-5" /> : (
                <>
                  ENTER PORTAL
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] font-medium text-amber-800 leading-tight">
              <strong>SECURITY NOTICE:</strong> This portal provides access to electoral assignment and result data. Please ensure you are entering your own NID. Multiple failed attempts may result in temporary lockout.
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/30 border-t justify-center py-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Official Election Commission Portal</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VoterPortalLogin;
