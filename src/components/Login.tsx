
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                setError(error.message);
            });
    };

    const handleSignUp = () => {
        createUserWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                setError(error.message);
            });
    };

    return (
        <div>
            <h2>Login or Sign Up</h2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            <button onClick={handleLogin}>Log In</button>
            <button onClick={handleSignUp}>Sign Up</button>
            {error && <p>{error}</p>}
        </div>
    );
};

export default Login;
