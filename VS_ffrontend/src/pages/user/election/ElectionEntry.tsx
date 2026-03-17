import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useGetIdentity } from '@refinedev/core';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';
import RODashboard from './RODashboard';
import PRODashboard from './PRODashboard';
import PODashboard from './PODashboard';

interface ElectionAssignment {
  election_id: string | number;
  election_name: string;
  status: string;
  start_date: string;
  end_date: string;
  role: 'RO' | 'PRO' | 'PO';
  location_label: string | null;
  /** PK of constituency_of_election — present only when role === 'RO' */
  coe_id: string | number | null;
  /** Constituency display name — present only when role === 'RO' */
  constituency_name: string | null;
}

/**
 * Loads the user's assignment for the given election and renders
 * the appropriate role dashboard (RO / PRO / PO).
 */
const ElectionEntry: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: identity } = useGetIdentity<{ id: string; name?: string }>();

  const [assignment, setAssignment] = useState<ElectionAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity?.id) return;

    fetch(`http://localhost:3001/api/users/my-elections?userId=${identity.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch assignments');
        return res.json() as Promise<ElectionAssignment[]>;
      })
      .then((rows) => {
        const match = rows.find(
          (r) => String(r.election_id) === String(id)
        );
        if (!match) {
          setError('You are not assigned to this election, or it is no longer active.');
        } else {
          setAssignment(match);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [identity?.id, id]);

  if (loading || !identity) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3 text-muted-foreground">
        <Spinner className="size-5" /> Loading election…
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="p-8 max-w-md mx-auto mt-16 bg-card border rounded-xl text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold mb-1">Not Found</h2>
        <p className="text-sm text-muted-foreground">{error ?? 'Assignment not found.'}</p>
      </div>
    );
  }

  const sharedProps = {
    electionName: assignment.election_name,
    locationLabel: assignment.location_label,
    startDate: assignment.start_date,
    endDate: assignment.end_date,
  };

  if (assignment.role === 'RO') {
    return (
      <RODashboard
        {...sharedProps}
        electionId={assignment.election_id}
        coeId={assignment.coe_id!}
        constituencyName={assignment.constituency_name ?? assignment.location_label ?? ''}
      />
    );
  }

  if (assignment.role === 'PRO') return <PRODashboard {...sharedProps} />;
  return <PODashboard {...sharedProps} />;
};

export default ElectionEntry;
