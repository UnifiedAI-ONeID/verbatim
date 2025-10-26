
import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export const SessionList = ({ sessions, onSelectSession, onDeleteSession, user, onSignOut, searchQuery, onSearchChange, onShowFaq, isLoading, t, language, onLanguageChange, onThemeChange, theme, onShowFeedback }: any) => (
    <div className="page-container">
        <div className="page-header">
            <h1 className="page-title">{t.sessions}</h1>
            <div className="header-actions">
                <select value={language} onChange={onLanguageChange}>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="zh-CN">中文 (简体)</option>
                    <option value="zh-TW">中文 (繁體)</option>
                </select>
                <button onClick={onThemeChange} className="theme-button">
                    {theme === 'light' ? '🌞' : '🌜'}
                </button>
                {user && <button onClick={onSignOut} className="signout-button">{t.signOut}</button>}
                <button onClick={onShowFaq} className="faq-button">?</button>
                <button onClick={onShowFeedback} className="feedback-button">📣</button>
            </div>
        </div>
        <input type="search" placeholder={t.searchPlaceholder} value={searchQuery} onChange={onSearchChange} className="search-input"/>
        {isLoading ? <LoadingSpinner /> : (
            <ul className="session-list">
                {sessions.filter((s: any) => s.metadata.title.toLowerCase().includes(searchQuery.toLowerCase())).map((s: any) => (
                    <li key={s.id} className="session-item" onClick={() => onSelectSession(s)}>
                        <div className="session-item-content">
                            <h3>{s.metadata.title}</h3>
                            <p>{new Date(s.metadata.date).toLocaleString()}</p>
                            {s.status === 'completed' && <p className="summary-preview">{(s.results.summary || '').slice(0, 100)}...</p>}
                            {s.status === 'processing' && <div className="processing-indicator"><div className="spinner-small"/> {t.processing}</div>}
                        </div>
                        <button className="delete-btn" onClick={(e: any) => { e.stopPropagation(); onDeleteSession(s.id); }}>🗑️</button>
                    </li>
                ))}
            </ul>
        )}
    </div>
);
