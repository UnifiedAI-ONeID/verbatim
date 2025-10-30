
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import '../style.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                setError(error.message);
            });
    };

    const handleSignUp = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        createUserWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                setError(error.message);
            });
    };

    const handleGoogleSignIn = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .catch((error) => {
                setError(error.message);
            });
    };

    return (
        <div className="login-container">
            <h2>Welcome to Verbatim</h2>
            <p>Your personal AI-powered voice note summarizer.</p>
            {error && <p style={{color: 'red'}}>{error}</p>}
            
            <button onClick={handleGoogleSignIn} className="primary-button" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google logo" style={{width: '20px', height: '20px'}} />
                Continue with Google
            </button>

            <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
                <button type="submit" className="primary-button">Login</button>
                <button type="button" onClick={handleSignUp} className="secondary-button">Sign Up</button>
            </form>
        </div>
    );
};

export default Login;
