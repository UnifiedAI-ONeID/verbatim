
import React from 'react';

export const BottomNav = ({ activeTab, onTabChange, t }: any) => (
    <nav className="bottom-nav">
        <button onClick={() => onTabChange('record')} className={activeTab === 'record' ? 'active' : ''}>🎙️ {t.record}</button>
        <button onClick={() => onTabChange('sessions')} className={activeTab === 'sessions' ? 'active' : ''}>📄 {t.sessions}</button>
    </nav>
);
