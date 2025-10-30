
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import '../style.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.MouseEvent<HTMLButtonElement>) => {
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
            <div className="google-ai-container">
                <div className="login-box">
                    <h2>Welcome to Verbatim</h2>
                    <p>Your personal AI-powered voice note summarizer.</p>
                    {error && <p className="error-message">{error}</p>}
                    <button onClick={handleGoogleSignIn} className="google-signin-button">
                        <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google logo" />
                        Continue with Google
                    </button>
                    <div className="divider">
                        <hr />
                        <span>OR</span>
                        <hr />
                    </div>
                    <form>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                        <button onClick={handleLogin} className="primary-button">Login with email</button>
                        <button onClick={handleSignUp} className="secondary-button">Sign up with email</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
