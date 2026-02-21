import React, { useState } from 'react';
import { useLogin, useGetIdentity } from '@refinedev/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Origami, Loader2 } from 'lucide-react';

interface Identity {
    role?: string;
}

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { mutate: login, isPending: isLoading } = useLogin<{ email: string; password: string }>();
    const { data: identity } = useGetIdentity<Identity>();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        login(
            { email, password },
            {
                onError: (error) => {
                    setErrorMsg(error?.message ?? 'Login failed. Check your credentials.');
                },
            }
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8 gap-2">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Origami className="w-7 h-7" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Election System</h1>
                        <p className="text-sm text-muted-foreground">Sign in to your account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@election.dev"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {errorMsg && (
                            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                                {errorMsg}
                            </p>
                        )}

                        <Button type="submit" disabled={isLoading} className="w-full mt-1">
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

                    {/* Dev hint */}
                    <div className="mt-6 pt-5 border-t border-border">
                        <p className="text-xs text-center text-muted-foreground font-medium mb-3">
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
                                    className="text-xs rounded-lg border border-border bg-muted hover:bg-muted/70 px-2 py-1.5 transition-colors"
                                >
                                    {acc.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            All dev accounts use password: <code className="font-mono">password123</code>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
