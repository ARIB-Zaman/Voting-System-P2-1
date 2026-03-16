import React from 'react';
import { useGetIdentity } from '@refinedev/core';
import { Wrench, Shield } from 'lucide-react';

const UserDashboard: React.FC = () => {
    const { data: user } = useGetIdentity<{ name?: string }>();

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto h-[80vh] flex items-center justify-center">
            <div className="bg-card border rounded-2xl p-10 max-w-md w-full text-center shadow-sm">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Shield className="w-8 h-8 text-primary" />
                </div>
                
                <h1 className="text-3xl font-black tracking-tight mb-2">
                    Welcome, {user?.name || 'User'}!
                </h1>
                
                <p className="text-muted-foreground mb-8">
                    You have successfully logged into the election management system.
                </p>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                    <div className="flex items-center justify-center mb-3 text-amber-600 dark:text-amber-500">
                        <Wrench className="w-6 h-6 mr-2" />
                        <h2 className="font-bold">Under Construction</h2>
                    </div>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                        The user dashboard is currently being built. Please check back later for updates.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
