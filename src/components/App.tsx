
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { auth } from '../firebase';
const MainApp = lazy(() => import('./MainApp'));


const httpLink = createHttpLink({
    uri: `https://dataconnect.googleapis.com/v1alpha/projects/verbatim-pa-50946397-928b2/locations/us-west4/connectors/verbatim-genai`
});

const authLink = setContext(async (_, { headers }) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        return {
            headers: {
                ...headers,
                authorization: token ? `Bearer ${token}` : '',
            },
        };
    }
    return { headers };
});

const client = new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
});

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
        <ApolloProvider client={client}>
            <Suspense fallback={<div className="loading-indicator"></div>}>
                <MainApp user={user} loading={loading} />
            </Suspense>
        </ApolloProvider>
    );
};

export default App;
