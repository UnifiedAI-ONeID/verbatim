
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { auth } from '../firebase';
import Login from './Login';
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

    if (loading) {
        return <p>Loading...</p>; // Or a loading spinner
    }

    return (
        <ApolloProvider client={client}>
            {user ? (
                <Suspense fallback={<p>Loading...</p>}>
                    <MainApp user={user} />
                </Suspense>
            ) : (
                <Login />
            )}
        </ApolloProvider>
    );
};

export default App;
