
import React from 'react';

// --- Type Definitions ---
export type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
export type Theme = 'light' | 'dark';
export type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'unknown';
export type MeetingResults = { transcript: string; summary: string; actionItems: string[] };
export type MeetingMetadata = { title: string; date: string; location: string; mapUrl: string; };
export type Session = { id: string; metadata: MeetingMetadata; results: MeetingResults; speakers: Record<string, string>; status: 'processing' | 'completed' | 'error'; error?: string; };
export type ActionModalData = { type: string; args?: any; sourceItem?: string; };
export type EditingSpeaker = { sessionId: string; speakerId: string };
export type ActiveTab = 'record' | 'sessions';
export type AccordionProps = { title: string; children?: React.Node; defaultOpen?: boolean; };
export type ModalProps = { children?: React.Node; onClose: () => void; title: string; };
