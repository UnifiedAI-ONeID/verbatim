
import React, { useState, useEffect, createContext, useContext, PropsWithChildren } from 'react';
import { translations } from './config.ts';
import { Language, Theme } from './types.ts';

// --- Contexts for Theme and Language ---
export const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void }>({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} });
export const LanguageContext = createContext<{ lang: Language; setLang: (lang: Language) => void; t: typeof translations.en }>({ lang: 'en', setLang: () => {}, t: translations.en });

export const ThemeProvider = ({ children }: PropsWithChildren) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const storedTheme = localStorage.getItem('verbatim_theme');
        return (storedTheme === 'light' || storedTheme === 'dark') ? storedTheme : 'dark';
    });
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('verbatim_theme', theme);
        const themeColor = theme === 'dark' ? '#0D0D0D' : '#F5F5F7';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    }, [theme]);
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
    return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const LanguageProvider = ({ children }: PropsWithChildren) => {
    const [lang, setLang] = useState<Language>(() => {
        const storedLang = localStorage.getItem('verbatim_language') as Language;
        if (storedLang && translations[storedLang]) return storedLang;
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('es')) return 'es';
        if (browserLang.startsWith('zh-cn')) return 'zh-CN';
        if (browserLang.startsWith('zh')) return 'zh-TW';
        return 'en';
    });
    useEffect(() => localStorage.setItem('verbatim_language', lang), [lang]);
    return <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>{children}</LanguageContext.Provider>;
};

// --- Custom Hooks ---
export const useTheme = () => useContext(ThemeContext);
export const useLocalization = () => useContext(LanguageContext);