
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const MainApp = lazy(() => import('./MainApp'));

const queryClient = new QueryClient();

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div className="loading-indicator"></div>}>
                <MainApp user={user} loading={loading} />
            </Suspense>
        </QueryClientProvider>
    );
};

export default App;
