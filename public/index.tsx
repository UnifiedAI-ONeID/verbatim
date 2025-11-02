
console.log('[index.tsx] Module start.');
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, ErrorBoundary } from './components.tsx';
import { ThemeProvider, LanguageProvider } from './contexts.tsx';
import { injectGlobalStyles } from './styles.ts';

// --- Inject global styles and render the app ---
try {
    console.log('[index.tsx] Injecting global styles.');
    injectGlobalStyles();
    
    const rootElement = document.getElementById('root');
    if (rootElement) {
        console.log('[index.tsx] Found #root element. Creating React root.');
        const root = createRoot(rootElement);
        
        console.log('[index.tsx] Rendering <App /> component.');
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
        console.log('[index.tsx] React render command issued.');
    } else {
        console.error('[index.tsx] Fatal Error: #root element not found in DOM.');
        document.body.innerHTML = '<div style="color:red; text-align:center; padding: 20px;"><strong>Fatal Error:</strong> Application could not start because the root DOM element was not found.</div>';
    }
} catch (error) {
    console.error('[index.tsx] Fatal Error during initialization:', error);
    document.body.innerHTML = `<div style="color:red; padding: 20px;"><strong>Fatal Error:</strong> An uncaught exception occurred during app initialization. Check the console for details.</div>`;
}
