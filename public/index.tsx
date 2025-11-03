import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { ThemeProvider, LanguageProvider } from './contexts.tsx';
import { injectGlobalStyles } from './styles.ts';

// --- Inject global styles and render the app ---
try {
    injectGlobalStyles();
    
    const rootElement = document.getElementById('root');
    if (rootElement) {
        const root = createRoot(rootElement);
        
        root.render(
            <React.StrictMode>
                <ErrorBoundary>
                    <ThemeProvider>
                        <LanguageProvider>
                            <App />
                        </LanguageProvider>
                    </ThemeProvider>
                </ErrorBoundary>
            </React.StrictMode>
        );
    } else {
        console.error('Fatal Error: #root element not found in DOM.');
        document.body.innerHTML = '<div style="color:red; text-align:center; padding: 20px;"><strong>Fatal Error:</strong> Application could not start because the root DOM element was not found.</div>';
    }
} catch (error) {
    console.error('Fatal Error during initialization:', error);
    document.body.innerHTML = `<div style="color:red; padding: 20px;"><strong>Fatal Error:</strong> An uncaught exception occurred during app initialization. Check the console for details.</div>`;
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}