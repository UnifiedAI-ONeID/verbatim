import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components.tsx';
import { ThemeProvider, LanguageProvider } from './contexts.tsx';
import { injectGlobalStyles } from './styles.ts';

// --- Inject global styles and render the app ---
injectGlobalStyles();
const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </ThemeProvider>
    </React.StrictMode>
);
