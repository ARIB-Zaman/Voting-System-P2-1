import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Loader2,
  PartyPopper,
  ShieldCheck,
  User,
  Vote,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  candidate_id: number;
  name: string;
  party: string;
  coe_id: number;
}

type Stage = 'otp' | 'vote' | 'done';

const API = 'http://localhost:3001/api';

// ─── OTP Input (individual digit boxes) ──────────────────────────────────────

const OtpInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Ensure we always have exactly 6 elements to map over
  const digits = [...value.split(''), '', '', '', '', '', ''].slice(0, 6);

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    // Take the last entered numeric character
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, idx) => (idx === i ? digit : d)).join('');
    onChange(next);
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[i] && i > 0) {
        e.preventDefault();
        const next = digits.map((d, idx) => (idx === i - 1 ? '' : d)).join('');
        onChange(next);
        inputs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          value={digits[i] || ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={`w-12 h-14 text-center text-xl font-black border-2 rounded-xl bg-background transition-all duration-150 outline-none
            ${digits[i] ? 'border-primary text-primary' : 'border-muted-foreground/30'}
            focus:border-primary focus:ring-2 focus:ring-primary/20
            disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      ))}
    </div>
  );
};


// ─── Main Component ───────────────────────────────────────────────────────────

const KioskVoting: React.FC = () => {
  const { electionId, constituencyId, centerId, boothId } = useParams<{
    electionId: string;
    constituencyId: string;
    centerId: string;
    boothId: string;
  }>();
  const navigate = useNavigate();

  // ── Stage state ─────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>('otp');

  // ── OTP stage ───────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [voterOfElectionId, setVoterOfElectionId] = useState<number | null>(null);

  // ── Vote stage ──────────────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // ── Done stage ──────────────────────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(null);

  // ── Fetch candidates when entering vote stage ────────────────────────────────
  useEffect(() => {
    if (stage !== 'vote' || !electionId || !constituencyId) return;
    setCandidatesLoading(true);
    fetch(`${API}/kiosk/candidates?election_id=${electionId}&constituency_id=${constituencyId}`)
      .then((r) => r.json())
      .then((data) => setCandidates(data))
      .catch(() => setCandidates([]))
      .finally(() => setCandidatesLoading(false));
  }, [stage, electionId, constituencyId]);

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch(`${API}/kiosk/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booth_id: boothId, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setOtpError(data.message ?? 'Invalid or expired OTP. Please try again.');
        setOtp('');
      } else {
        setVoterOfElectionId(data.voter_of_election_id);
        setStage('vote');
      }
    } catch {
      setOtpError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // ── Submit vote ─────────────────────────────────────────────────────────────
  const handleSubmitVote = async () => {
    if (!selectedCandidateId || !voterOfElectionId) return;
    setSubmitting(true);
    setVoteError(null);
    try {
      const res = await fetch(`${API}/kiosk/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voter_of_election_id: voterOfElectionId,
          candidate_id: selectedCandidateId,
          election_id: electionId,
          constituency_id: constituencyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Vote submission failed');
      setToken(data.token);
      setStage('done');
    } catch (err: any) {
      setVoteError(err.message ?? 'Failed to submit vote. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset all state back to OTP stage for the next voter
  const resetForNextVoter = () => {
    setStage('otp');
    setOtp('');
    setOtpError(null);
    setVoterOfElectionId(null);
    setSelectedCandidateId(null);
    setVoteError(null);
    setToken(null);
  };

  // ─── Stage: OTP ──────────────────────────────────────────────────────────────
  if (stage === 'otp') {
    return (
      <div className="max-w-lg mx-auto px-6 py-12">
        <Button
          variant="ghost" size="sm" className="mb-8 -ml-2 text-muted-foreground"
          onClick={() => navigate(`/kiosk/election/${electionId}/constituency/${constituencyId}/center/${centerId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Booths
        </Button>

        <div className="bg-card border rounded-2xl shadow-sm p-8 space-y-8">
          {/* Icon + heading */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Enter Your OTP</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Enter the 6-digit OTP sent to you by the Polling Officer.
            </p>
          </div>

          {/* Digit boxes */}
          <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError(null); }} disabled={verifying} />

          {/* Error */}
          {otpError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <XCircle className="h-4 w-4 shrink-0" />
              {otpError}
            </div>
          )}

          {/* Verify button */}
          <Button
            className="w-full h-12 text-base font-bold"
            disabled={otp.length !== 6 || verifying}
            onClick={handleVerifyOtp}
          >
            {verifying ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</>
            ) : (
              <><ShieldCheck className="h-4 w-4 mr-2" /> Verify OTP</>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Booth #{boothId} · If you have not received an OTP, please speak to a Polling Officer.
          </p>
        </div>
      </div>
    );
  }

  // ─── Stage: Vote ─────────────────────────────────────────────────────────────
  if (stage === 'vote') {
    const selected = candidates.find((c) => c.candidate_id === selectedCandidateId);

    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-emerald-600">OTP Verified</span>
        </div>

        <h1 className="text-3xl font-black tracking-tight mb-1">Choose Your Candidate</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Select one candidate below. Your vote is final once submitted.
        </p>

        {/* Candidates */}
        {candidatesLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground gap-2">
            <Spinner className="size-5" /> Loading candidates…
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Vote className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold">No approved candidates found for this constituency.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {candidates.map((c) => {
              const isSelected = selectedCandidateId === c.candidate_id;
              return (
                <button
                  key={c.candidate_id}
                  onClick={() => { setSelectedCandidateId(c.candidate_id); setVoteError(null); }}
                  disabled={submitting}
                  className={`w-full text-left rounded-xl border-2 p-5 transition-all duration-150 flex items-center justify-between gap-4 group
                    ${isSelected
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border bg-card hover:border-primary/50 hover:bg-muted/40 shadow-sm'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-base">{c.name}</p>
                      <p className="text-sm text-muted-foreground">{c.party}</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                    ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {voteError && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
            <XCircle className="h-4 w-4 shrink-0" />
            {voteError}
          </div>
        )}

        {/* Confirm */}
        {selectedCandidateId && (
          <div className="bg-muted/40 border rounded-xl p-4 mb-4 flex items-center gap-3">
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm">
              You are voting for <span className="font-bold">{selected?.name}</span>{' '}
              <span className="text-muted-foreground">({selected?.party})</span>
            </p>
          </div>
        )}

        <Button
          className="w-full h-12 text-base font-bold"
          disabled={!selectedCandidateId || submitting}
          onClick={handleSubmitVote}
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting Vote…</>
          ) : (
            <><Vote className="h-4 w-4 mr-2" /> Submit Vote</>
          )}
        </Button>
      </div>
    );
  }

  // ─── Stage: Done ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <div className="bg-card border rounded-2xl shadow-sm p-8 space-y-8 text-center">
        {/* Success icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
            <PartyPopper className="h-10 w-10" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight">Vote Recorded!</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your vote has been successfully recorded. Please keep your token for reference.
          </p>
        </div>

        {/* Token display */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Voter Token</p>
          <div className="bg-muted border-2 border-dashed border-muted-foreground/30 rounded-xl px-6 py-5">
            <p className="font-black text-2xl tracking-widest break-all text-primary">{token}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Write this down or take a photo. You may use this token to verify your vote.
          </p>
        </div>

        {/* Return to kiosk home */}
        <Button
          variant="outline"
          className="w-full"
          onClick={resetForNextVoter}
        >
          Vote Another Voter (Same Booth)
        </Button>
      </div>
    </div>
  );
};

export default KioskVoting;
