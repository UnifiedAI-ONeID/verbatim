
import React from 'react';
import { FirebaseDataConnect, getFirebaseDataConnect } from '@dataconnect/generated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDataConnectProvider } from '@tanstack-query-firebase/react';
import { app } from '../firebase';

const DataConnectProvider = ({ children }: { children: React.ReactNode }) => {
    const dataConnect: FirebaseDataConnect = getFirebaseDataConnect(app);
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <ReactQueryDataConnectProvider dataConnect={dataConnect}>
                {children}
            </ReactQueryDataConnectProvider>
        </QueryClientProvider>
    );
};

export default DataConnectProvider;
