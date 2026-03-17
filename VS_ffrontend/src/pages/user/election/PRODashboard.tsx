import React from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, MapPin, ClipboardList, Users, CheckSquare, AlertCircle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PRODashboardProps {
  electionName: string;
  locationLabel: string | null;
  startDate: string;
  endDate: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const PRODashboard: React.FC<PRODashboardProps> = ({
  electionName,
  locationLabel,
  startDate,
  endDate,
}) => {
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground"
          onClick={() => navigate('/homeUSER')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to My Elections
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                Presiding Officer
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">{electionName}</h1>
            {locationLabel && (
              <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {locationLabel}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatDate(startDate)} — {formatDate(endDate)}
            </p>
          </div>
        </div>
      </header>

      {/* Quick-stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {[
          { icon: <Users className="h-5 w-5" />, label: 'Polling Officers', value: '—', color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
          { icon: <ClipboardList className="h-5 w-5" />, label: 'Booths in Center', value: '—', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
          { icon: <CheckSquare className="h-5 w-5" />, label: 'Checklists Done', value: '—', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
        ].map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${s.color}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Under construction notice */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="font-bold text-lg">PRO Dashboard</h2>
          <p className="text-sm text-muted-foreground">Presiding Returning Officer workspace for this polling center</p>
        </div>
        <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 text-amber-600">
            <Wrench className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold mb-2">Under Construction</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            The Presiding Returning Officer workspace is being built. It will include booth management, PO oversight, and center-level reporting.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground border rounded-lg px-4 py-2 bg-muted/40">
            <AlertCircle className="h-3.5 w-3.5" />
            Role: Presiding Returning Officer · {electionName}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PRODashboard;
