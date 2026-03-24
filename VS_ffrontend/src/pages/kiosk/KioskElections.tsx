import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarDays, ChevronRight, Radio, Vote } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface Election {
  election_id: string | number;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  description?: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  });

const KioskElections: React.FC = () => {
  const navigate = useNavigate();
  const [elections, setElections] = useState<Election[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/election')
      .then((r) => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then((data: Election[]) => setElections(data.filter((e) => e.status === 'LIVE')))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Heading */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Vote className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">Active Elections</h1>
        <p className="text-muted-foreground mt-2">Select the election you are here to vote in.</p>
      </div>

      {/* States */}
      {!elections && !error && (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Spinner className="size-5" /> Loading…
        </div>
      )}
      {error && (
        <p className="text-center text-destructive py-16">{error}</p>
      )}
      {elections?.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Radio className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold text-lg">No active elections right now</p>
          <p className="text-sm mt-1">Please check back later or contact your election officer.</p>
        </div>
      )}

      {/* Cards */}
      {elections && elections.length > 0 && (
        <div className="space-y-4">
          {elections.map((e) => (
            <button
              key={e.election_id}
              onClick={() => navigate(`/kiosk/election/${e.election_id}`)}
              className="w-full text-left bg-card border rounded-xl p-6 shadow-sm hover:shadow-md hover:border-primary/50 hover:bg-primary/5 transition-all duration-150 flex items-center justify-between gap-4 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
                  <Vote className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-lg">{e.name}</p>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(e.start_date)} — {formatDate(e.end_date)}
                  </div>
                  {e.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-tight">
                  LIVE
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default KioskElections;
