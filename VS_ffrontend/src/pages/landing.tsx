import React, { Suspense, lazy, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLogin } from '@refinedev/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LogIn, UserPlus, Loader2, CheckCircle2, X } from 'lucide-react';
import type { Application } from '@splinetool/runtime';

const Spline = lazy(() => import('@splinetool/react-spline'));

type Panel = null | 'login' | 'signup';

// ── Landing Page ──────────────────────────────────────────────────────────────

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [panel, setPanel] = useState<Panel>(null);

    const handleSplineLoad = useCallback((splineApp: Application) => {
        const w = window.innerWidth;
        const zoom = w <= 1920 ? 1.0 : w >= 2560 ? 1.4 : 1.0 + ((w - 1920) / (2560 - 1920)) * 0.4;
        splineApp.setZoom(zoom);
    }, []);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0f]">
            {/* ── Spline 3D Scene ───────────────────────────────────────────── */}
            <div className="absolute inset-0 z-0">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center h-full">
                            <Spinner className="size-8 text-white/30" />
                        </div>
                    }
                >
                    <Spline
                        scene="https://prod.spline.design/Br4QaL992SH0JNzu/scene.splinecode"
                        onLoad={handleSplineLoad}
                    />
                </Suspense>
            </div>

            {/* ── Gradient overlays ─────────────────────────────────────────── */}
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60" />
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-r from-black/30 via-transparent to-transparent" />

            {/* ── Content (pointer-events-none, auto on buttons) ────────────── */}
            <div className="relative z-20 flex flex-col justify-between h-full px-8 md:px-16 py-10 pointer-events-none">
                {/* Top nav */}
                <nav className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                            <span className="text-white font-black text-sm">W</span>
                        </div>
                        <span className="text-white font-black text-xl tracking-tight">
                            Welec
                        </span>
                    </div>

                    <div className="flex items-center gap-3 pointer-events-auto">
                        <Button
                            variant="ghost"
                            className="text-white/80 hover:text-white hover:bg-white/10 font-medium"
                            onClick={() => setPanel('login')}
                        >
                            <LogIn className="h-4 w-4 mr-2" />
                            Sign In
                        </Button>
                        <Button
                            className="bg-white text-black hover:bg-white/90 font-bold px-5 shadow-lg shadow-white/10"
                            onClick={() => setPanel('signup')}
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Sign Up
                        </Button>
                    </div>
                </nav>

                {/* Hero text */}
                <div className="max-w-xl mb-8">
                    <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[0.95] mb-4">
                        <span className="bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
                            Welec
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-white/60 font-medium leading-relaxed max-w-md">
                        Next-generation election management platform.
                        Secure, transparent, and built for scale.
                    </p>

                    <div className="flex items-center gap-4 mt-8 pointer-events-auto">
                        <Button
                            size="lg"
                            className="bg-white text-black hover:bg-white/90 font-bold px-8 h-12 text-base shadow-xl shadow-white/10"
                            onClick={() => setPanel('signup')}
                        >
                            Get Started
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-white/20 text-white hover:bg-white/10 font-medium px-8 h-12 text-base"
                            onClick={() => setPanel('login')}
                        >
                            Sign In
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Auth Overlay ──────────────────────────────────────────────── */}
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-30 transition-all duration-500 ease-out ${panel
                        ? 'bg-black/50 backdrop-blur-md pointer-events-auto'
                        : 'bg-transparent pointer-events-none'
                    }`}
                onClick={() => setPanel(null)}
            />

            {/* Panel */}
            <div
                className={`fixed inset-y-0 right-0 z-40 w-full max-w-md transition-transform duration-500 ease-out pointer-events-auto ${panel ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="h-full bg-[#0d0d14]/90 backdrop-blur-2xl border-l border-white/10 shadow-2xl shadow-black/50 overflow-y-auto">
                    {/* Close button */}
                    <div className="flex justify-end p-5">
                        <button
                            onClick={() => setPanel(null)}
                            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="px-8 pb-10">
                        {panel === 'login' && (
                            <LoginForm
                                onSwitch={() => setPanel('signup')}
                                onClose={() => setPanel(null)}
                            />
                        )}
                        {panel === 'signup' && (
                            <SignupForm
                                onSwitch={() => setPanel('login')}
                                onClose={() => setPanel(null)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Login Form ────────────────────────────────────────────────────────────────

const LoginForm: React.FC<{ onSwitch: () => void; onClose: () => void }> = ({
    onSwitch,
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { mutate: login, isPending: isLoading } = useLogin<{
        email: string;
        password: string;
    }>();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        login(
            { email, password },
            {
                onError: (error) => {
                    setErrorMsg(
                        error?.message ?? 'Login failed. Check your credentials.'
                    );
                },
            }
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight">
                    Welcome back
                </h2>
                <p className="text-sm text-white/50 mt-1">
                    Sign in to your Welec account
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email" className="text-white/70 text-sm">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@election.dev"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password" className="text-white/70 text-sm">
                        Password
                    </Label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
                    />
                </div>

                {errorMsg && (
                    <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                        {errorMsg}
                    </p>
                )}

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-1 bg-white text-black hover:bg-white/90 font-bold h-11"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in…
                        </>
                    ) : (
                        'Sign in'
                    )}
                </Button>
            </form>

            {/* Dev accounts */}
            <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-xs text-center text-white/40 font-medium mb-3">
                    Development Accounts
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                        { label: 'Admin', email: 'admin@election.dev' },
                        { label: 'RO', email: 'ro@election.dev' },
                        { label: 'PO', email: 'po@election.dev' },
                    ].map((acc) => (
                        <button
                            key={acc.email}
                            type="button"
                            onClick={() => {
                                setEmail(acc.email);
                                setPassword('password123');
                            }}
                            className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-2 py-1.5 transition-colors"
                        >
                            {acc.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-center text-white/30 mt-2">
                    All use password: <code className="font-mono">password123</code>
                </p>
            </div>

            {/* Switch to signup */}
            <div className="mt-6 text-center">
                <p className="text-sm text-white/40">
                    Don't have an account?{' '}
                    <button
                        onClick={onSwitch}
                        className="text-white font-medium hover:underline"
                    >
                        Create an account
                    </button>
                </p>
            </div>
        </div>
    );
};

// ── Signup Form ───────────────────────────────────────────────────────────────

const SignupForm: React.FC<{ onSwitch: () => void; onClose: () => void }> = ({
    onSwitch,
    onClose,
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match.');
            return;
        }
        if (!role) {
            setErrorMsg('Please select a role.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorMsg(data.error ?? 'Sign-up failed. Please try again.');
                return;
            }
            setSuccess(true);
        } catch {
            setErrorMsg('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Success state
    if (success) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center text-center gap-4 mt-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-white">
                        Account Created!
                    </h2>
                    <p className="text-sm text-white/50 leading-relaxed">
                        Your account has been submitted for review.
                        <br />
                        An administrator will approve your access shortly.
                    </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-6 mb-6">
                    <p className="text-sm text-amber-300 font-medium">
                        ⏳ Waiting for admin approval
                    </p>
                    <p className="text-xs text-amber-300/60 mt-1">
                        You will be able to log in once approved.
                    </p>
                </div>

                <Button
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/10"
                    onClick={onSwitch}
                >
                    Back to Sign In
                </Button>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-2xl font-black text-white tracking-tight">
                    Create Account
                </h2>
                <p className="text-sm text-white/50 mt-1">
                    Request access to the Welec platform
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name" className="text-white/70 text-sm">
                        Full Name
                    </Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoComplete="name"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="signup-email" className="text-white/70 text-sm">
                        Email
                    </Label>
                    <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="signup-password" className="text-white/70 text-sm">
                        Password
                    </Label>
                    <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirm-password" className="text-white/70 text-sm">
                        Confirm Password
                    </Label>
                    <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="role" className="text-white/70 text-sm">
                        Requested Role
                    </Label>
                    <Select value={role} onValueChange={setRole}>
                        <SelectTrigger
                            id="role"
                            className="bg-white/5 border-white/10 text-white [&>span]:text-white/30 focus:ring-white/20"
                        >
                            <SelectValue placeholder="Select a role…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="RO">
                                Returning Officer (RO)
                            </SelectItem>
                            <SelectItem value="PO">
                                Polling Officer (PO)
                            </SelectItem>
                            <SelectItem value="PRO">
                                Presiding Officer (PRO)
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {errorMsg && (
                    <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                        {errorMsg}
                    </p>
                )}

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-1 bg-white text-black hover:bg-white/90 font-bold h-11"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account…
                        </>
                    ) : (
                        'Create Account'
                    )}
                </Button>
            </form>

            {/* Switch to login */}
            <div className="mt-6 pt-5 border-t border-white/10 text-center">
                <p className="text-sm text-white/40">
                    Already have an account?{' '}
                    <button
                        onClick={onSwitch}
                        className="text-white font-medium hover:underline"
                    >
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LandingPage;
