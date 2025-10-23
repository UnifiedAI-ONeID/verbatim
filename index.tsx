
import React, { useState, useRef, CSSProperties, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { marked } from 'marked';

// --- Gemini API Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'unknown';
type MeetingResults = { transcript: string; summary: string; actionItems: string[] };
type MeetingMetadata = { title: string; date: string; location: string; mapUrl: string; };
type Session = { id: string; metadata: MeetingMetadata; results: MeetingResults; speakers: Record<string, string>; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };


// --- i18n Translations ---
const translations = {
    en: {
        title: 'Verbatim',
        subtitle: 'Your intelligent meeting dashboard.',
        startRecording: '🎤 New Session',
        stopRecording: '⏹️ Stop Recording',
        analyzing: 'Analyzing...',
        micPermissionError: 'Could not start recording. Please grant microphone permissions.',
        processingError: 'Failed to process audio. Please try again.',
        transcriptHeader: '📋 Transcript',
        summaryHeader: '✨ Key Summary',
        actionItemsHeader: '📌 Action Items',
        noTranscript: 'Could not extract transcript.',
        noSummary: 'Could not extract summary.',
        takeAction: 'Take Action ✨',
        noActionDetermined: 'Could not determine a specific action for this item. You can handle it manually.',
        createCalendarEvent: 'Create Google Calendar Event',
        titleLabel: 'Title:',
        descriptionLabel: 'Description:',
        dateLabel: 'Date:',
        timeLabel: 'Time:',
        openInCalendar: 'Open in Google Calendar',
        draftEmail: 'Draft Email in Gmail',
        toLabel: 'To:',
        subjectLabel: 'Subject:',
        bodyLabel: 'Body:',
        openInGmail: 'Open in Gmail',
        createDocument: 'Create Google Doc',
        createDocInfo: 'A new tab will open to create a Google Doc. The content below will be copied to your clipboard to paste.',
        suggestedTitle: 'Suggested Title:',
        suggestedContent: 'Suggested Content:',
        openGoogleDocs: 'Open Google Docs & Copy Content',
        unknownAction: 'Unknown Action',
        actionError: 'An error occurred while determining the action. Please try again.',
        exportResults: 'Export Results',
        copyMarkdown: 'Copy as Markdown',
        downloadMarkdown: 'Download as .md',
        copiedSuccess: 'Copied to clipboard!',
        meetingTitle: 'Meeting Notes',
        meetingLocation: 'Location:',
        locationUnavailable: 'Location not available',
        gettingLocation: 'Getting location...',
        speakersHeader: '🗣️ Speakers',
        renameSpeakerPrompt: 'Enter new name for',
        footerText: 'For Impactory Institute Use Only',
        recentSessions: 'Recent Sessions',
        welcomeMessage: 'Welcome to Verbatim',
        welcomeSubtext: 'Click "New Session" to record your meeting and let AI handle the notes.',
        deleteSession: 'Delete Session?',
        deleteConfirmation: 'Are you sure you want to delete this session? This action cannot be undone.',
        searchPlaceholder: 'Search sessions...',
        toggleMiniView: 'Toggle Mini View'
    },
    es: {
        title: 'Verbatim',
        subtitle: 'Tu panel de reuniones inteligente.',
        startRecording: '🎤 Nueva Sesión',
        stopRecording: '⏹️ Detener Grabación',
        analyzing: 'Analizando...',
        micPermissionError: 'No se pudo iniciar la grabación. Por favor, concede permisos para el micrófono.',
        processingError: 'No se pudo procesar el audio. Por favor, inténtalo de nuevo.',
        transcriptHeader: '📋 Transcripción',
        summaryHeader: '✨ Resumen Clave',
        actionItemsHeader: '📌 Puntos de Acción',
        noTranscript: 'No se pudo extraer la transcripción.',
        noSummary: 'No se pudo extraer el resumen.',
        takeAction: 'Tomar Acción ✨',
        noActionDetermined: 'No se pudo determinar una acción específica para este ítem. Puedes gestionarlo manualmente.',
        createCalendarEvent: 'Crear Evento en Google Calendar',
        titleLabel: 'Título:',
        descriptionLabel: 'Descripción:',
        dateLabel: 'Fecha:',
        timeLabel: 'Hora:',
        openInCalendar: 'Abrir en Google Calendar',
        draftEmail: 'Redactar Correo en Gmail',
        toLabel: 'Para:',
        subjectLabel: 'Asunto:',
        bodyLabel: 'Cuerpo:',
        openInGmail: 'Abrir en Gmail',
        createDocument: 'Crear Google Doc',
        createDocInfo: 'Se abrirá una nueva pestaña para crear un Google Doc. El contenido de abajo se copiará a tu portapapeles para que lo pegues.',
        suggestedTitle: 'Título Sugerido:',
        suggestedContent: 'Contenido Sugerido:',
        openGoogleDocs: 'Abrir Google Docs y Copiar Contenido',
        unknownAction: 'Acción Desconocida',
        actionError: 'Ocurrió un error al determinar la acción. Por favor, inténtalo de nuevo.',
        exportResults: 'Exportar Resultados',
        copyMarkdown: 'Copiar como Markdown',
        downloadMarkdown: 'Descargar como .md',
        copiedSuccess: '¡Copiado al portapapeles!',
        meetingTitle: 'Notas de la Reunión',
        meetingLocation: 'Ubicación:',
        locationUnavailable: 'Ubicación no disponible',
        gettingLocation: 'Obteniendo ubicación...',
        speakersHeader: '🗣️ Oradores',
        renameSpeakerPrompt: 'Ingrese el nuevo nombre para',
        footerText: 'Para Uso Exclusivo del Impactory Institute',
        recentSessions: 'Sesiones Recientes',
        welcomeMessage: 'Bienvenido a Verbatim',
        welcomeSubtext: 'Haz clic en "Nueva Sesión" para grabar tu reunión y deja que la IA se encargue de las notas.',
        deleteSession: '¿Eliminar Sesión?',
        deleteConfirmation: '¿Estás seguro de que quieres eliminar esta sesión? Esta acción no se puede deshacer.',
        searchPlaceholder: 'Buscar sesiones...',
        toggleMiniView: 'Alternar Mini Vista'
    },
    'zh-CN': {
        title: 'Verbatim',
        subtitle: '您的智能会议仪表板。',
        startRecording: '🎤 新建会话',
        stopRecording: '⏹️ 停止录音',
        analyzing: '正在分析...',
        micPermissionError: '无法开始录音。请授予麦克风权限。',
        processingError: '处理音频失败。请重试。',
        transcriptHeader: '📋 文字记录',
        summaryHeader: '✨ 核心摘要',
        actionItemsHeader: '📌 行动项',
        noTranscript: '无法提取文字记录。',
        noSummary: '无法提取摘要。',
        takeAction: '执行操作 ✨',
        noActionDetermined: '无法为此项目确定具体操作。请手动处理。',
        createCalendarEvent: '创建谷歌日历活动',
        titleLabel: '标题:',
        descriptionLabel: '描述:',
        dateLabel: '日期:',
        timeLabel: '时间:',
        openInCalendar: '在谷歌日历中打开',
        draftEmail: '在 Gmail 中草拟邮件',
        toLabel: '收件人:',
        subjectLabel: '主题:',
        bodyLabel: '正文:',
        openInGmail: '在 Gmail 中打开',
        createDocument: '创建谷歌文档',
        createDocInfo: '将打开一个新标签页来创建谷歌文档。下面的内容将被复制到您的剪贴板以便粘贴。',
        suggestedTitle: '建议标题:',
        suggestedContent: '建议内容:',
        openGoogleDocs: '打开谷歌文档并复制代码',
        unknownAction: '未知操作',
        actionError: '确定操作时发生错误。请重试。',
        exportResults: '导出结果',
        copyMarkdown: '复制为 Markdown',
        downloadMarkdown: '下载为 .md 文件',
        copiedSuccess: '已复制到剪贴板！',
        meetingTitle: '会议记录',
        meetingLocation: '地点:',
        locationUnavailable: '地点不可用',
        gettingLocation: '正在获取地点...',
        speakersHeader: '🗣️ 发言人',
        renameSpeakerPrompt: '输入新名称',
        footerText: '仅供 Impactory Institute 使用',
        recentSessions: '最近的会话',
        welcomeMessage: '欢迎使用 Verbatim',
        welcomeSubtext: '点击“新建会话”以录制您的会议，让人工智能来处理笔记。',
        deleteSession: '删除会话？',
        deleteConfirmation: '您确定要删除此会话吗？此操作无法撤销。',
        searchPlaceholder: '搜索会话...',
        toggleMiniView: '切换迷你视图'
    },
    'zh-TW': {
        title: 'Verbatim',
        subtitle: '您的智慧會議儀表板。',
        startRecording: '🎤 新增會議',
        stopRecording: '⏹️ 停止錄音',
        analyzing: '正在分析...',
        micPermissionError: '無法開始錄音。請授予麥克風權限。',
        processingError: '處理音訊失敗。請重試。',
        transcriptHeader: '📋 文字記錄',
        summaryHeader: '✨ 核心摘要',
        actionItemsHeader: '📌 行動項目',
        noTranscript: '無法擷取文字記錄。',
        noSummary: '無法擷取摘要。',
        takeAction: '執行操作 ✨',
        noActionDetermined: '無法為此項目確定具體操作。請手動處理。',
        createCalendarEvent: '建立 Google 日曆活動',
        titleLabel: '標題:',
        descriptionLabel: '說明:',
        dateLabel: '日期:',
        timeLabel: '時間:',
        openInCalendar: '在 Google 日曆中開啟',
        draftEmail: '在 Gmail 中草擬郵件',
        toLabel: '收件人:',
        subjectLabel: '主旨:',
        bodyLabel: '內文:',
        openInGmail: '在 Gmail 中開啟',
        createDocument: '建立 Google 文件',
        createDocInfo: '將會開啟一個新分頁來建立 Google 文件。下面的內容將被複製到您的剪貼簿以便貼上。',
        suggestedTitle: '建議標題:',
        suggestedContent: '建議內容:',
        openGoogleDocs: '開啟 Google 文件並複製內容',
        unknownAction: '未知操作',
        actionError: '確定操作時發生錯誤。請重試。',
        exportResults: '匯出結果',
        copyMarkdown: '複製為 Markdown',
        downloadMarkdown: '下載為 .md',
        copiedSuccess: '已複製到剪貼簿！',
        meetingTitle: '會議筆記',
        meetingLocation: '地點:',
        locationUnavailable: '地點不可用',
        gettingLocation: '正在取得地點...',
        speakersHeader: '🗣️ 發言者',
        renameSpeakerPrompt: '為...輸入新名稱',
        footerText: '僅供 Impactory Institute 使用',
        recentSessions: '最近的會議',
        welcomeMessage: '歡迎使用 Verbatim',
        welcomeSubtext: '點擊「新增會議」以錄製您的會議，讓 AI 處理筆記。',
        deleteSession: '刪除會議？',
        deleteConfirmation: '您確定要刪除此會議嗎？此操作無法復原。',
        searchPlaceholder: '搜尋會議...',
        toggleMiniView: '切換迷你視圖'
    }
};

// --- Helper Functions ---
const getPlatform = (): Platform => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
    if (/mac/i.test(ua)) return 'macos';
    if (/windows/i.test(ua)) return 'windows';
    return 'unknown';
};

const getLanguage = (): Language => {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('es')) return 'es';
    if (lang === 'zh-cn') return 'zh-CN';
    if (lang.startsWith('zh')) return 'zh-TW';
    return 'en';
};

const t = translations[getLanguage()];

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const generateSessionId = () => `session_${new Date().toISOString()}`;

const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// --- Gemini Tool Declarations ---
const createCalendarEventTool: FunctionDeclaration = {
  name: 'create_calendar_event',
  description: 'Creates a Google Calendar event from the provided details.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'The title of the calendar event.' },
      description: { type: Type.STRING, description: 'A detailed description for the event.' },
      date: { type: Type.STRING, description: 'The event date in YYYY-MM-DD format.' },
      time: { type: Type.STRING, description: 'The event start time in 24-hour HH:MM format.' },
    },
    required: ['title', 'date', 'time'],
  },
};

const draftEmailTool: FunctionDeclaration = {
  name: 'draft_email',
  description: 'Drafts an email in Gmail with the specified recipients, subject, and body.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: { type: Type.STRING, description: 'A comma-separated list of recipient email addresses.' },
      subject: { type: Type.STRING, description: 'The subject line of the email.' },
      body: { type: Type.STRING, description: 'The content of the email body.' },
    },
    required: ['to', 'subject', 'body'],
  },
};

const createDocumentTool: FunctionDeclaration = {
  name: 'create_document',
  description: 'Prepares content for a new Google Doc.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'The suggested title for the document.' },
      content: { type: Type.STRING, description: 'The suggested content for the document body.' },
    },
    required: ['title', 'content'],
  },
};

// --- Main App Component ---
const App: React.FC = () => {
    // --- State Management ---
    const [isRecording, setIsRecording] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pipWindow, setPipWindow] = useState<Window | null>(null);
    const [actionModalData, setActionModalData] = useState<ActionModalData | null>(null);
    const [loadingActionItem, setLoadingActionItem] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [showCopiedMessage, setShowCopiedMessage] = useState(false);


    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef(new BroadcastChannel('verbatim_pip_channel'));

    // --- Data Persistence ---
    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('verbatim_sessions');
            if (savedSessions) {
                setSessions(JSON.parse(savedSessions));
            }
        } catch (e) {
            console.error("Failed to load sessions from localStorage", e);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('verbatim_sessions', JSON.stringify(sessions));
        } catch (e) {
            console.error("Failed to save sessions to localStorage", e);
        }
    }, [sessions]);


    // --- Geolocation ---
    const [location, setLocation] = useState<{ name: string; mapUrl: string } | null>(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    const getLocation = () => {
        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported by this browser.");
            return;
        }

        setIsGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // A more robust implementation would use a reverse geocoding API.
                // For this example, we'll use a simplified name.
                const locationName = `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
                const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                setLocation({ name: locationName, mapUrl });
                setIsGettingLocation(false);
            },
            (error) => {
                console.error("Error getting location: ", error);
                setIsGettingLocation(false);
                setLocation(null); // Clear location on error
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleStopRecording = useCallback(async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsAnalyzing(true);
        setError(null);

        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        if (pipWindow) {
            pipWindow.close();
            setPipWindow(null);
        }
        channelRef.current.postMessage({ type: 'state_update', isRecording: false });

        if (audioChunksRef.current.length === 0) {
            setError(t.processingError);
            setIsAnalyzing(false);
            return;
        }

        try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            audioChunksRef.current = [];
            const base64Audio = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });
            const audioData = base64Audio.split(',')[1];
            
             const systemInstruction = `You are a meeting assistant. Analyze the following meeting transcript. Provide a concise summary, a list of action items, a full transcript with speaker labels (e.g., Speaker 1, Speaker 2), and identify all unique speakers. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.`;
            
             const response = await ai.models.generateContent({
                 model: 'gemini-2.5-flash',
                 contents: [{ parts: [
                     {text: "Analyze this meeting audio."},
                     {inlineData: { mimeType: 'audio/webm', data: audioData }}
                 ]}],
                 config: {
                    systemInstruction,
                    responseMimeType: 'application/json'
                 }
            });

            const result = JSON.parse(response.text);
            
            const newSession: Session = {
                id: generateSessionId(),
                metadata: {
                    title: result.summary?.substring(0, 40) + '...' || t.meetingTitle,
                    date: new Date().toISOString(),
                    location: location?.name || t.locationUnavailable,
                    mapUrl: location?.mapUrl || ''
                },
                results: {
                    transcript: result.transcript || t.noTranscript,
                    summary: result.summary || t.noSummary,
                    actionItems: result.actionItems || [],
                },
                speakers: (result.speakers || []).reduce((acc: Record<string, string>, speaker: string) => {
                    acc[speaker] = speaker; // Initially, label and name are the same
                    return acc;
                }, {})
            };

            setSessions(prev => [newSession, ...prev]);
            setActiveSession(newSession);

        } catch (err) {
            console.error("Error processing audio with Gemini:", err);
            setError(t.processingError);
        } finally {
            setIsAnalyzing(false);
        }
    }, [location, pipWindow]);

     // --- PiP Communication ---
    useEffect(() => {
        const channel = channelRef.current;
        const messageHandler = (event: MessageEvent) => {
            if (event.data?.type === 'stop_recording') {
                if (isRecording) {
                    handleStopRecording();
                }
            } else if (event.data?.type === 'pip_ready') {
                 channel.postMessage({
                    type: 'state_update',
                    isRecording: isRecording,
                    recordingTime: recordingTime
                });
            }
        };

        channel.addEventListener('message', messageHandler);

        return () => {
            channel.removeEventListener('message', messageHandler);
        };
    }, [isRecording, recordingTime, handleStopRecording]);


    // --- Recording Logic ---
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = handleStopRecording;

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            setError(null);
            setActiveSession(null); // Clear active session view
            getLocation(); // Get location at the start of the recording

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prevTime => {
                    const newTime = prevTime + 1;
                    channelRef.current.postMessage({ type: 'time_update', time: newTime });
                    return newTime;
                });
            }, 1000);

        } catch (err) {
            console.error("Error starting recording:", err);
            setError(t.micPermissionError);
        }
    };
    
    // --- PiP Toggle ---
    const togglePip = async () => {
        if (pipWindow) {
            pipWindow.close();
            return;
        }

        try {
            const pip = await (window as any).documentPictureInPicture.requestWindow({
                width: 380,
                height: 100,
            });
            
            const response = await fetch('/pip.html');
            if (!response.ok) throw new Error('Could not load PiP content.');
            const html = await response.text();

            const base = document.createElement('base');
            base.href = window.location.origin;
            pip.document.head.appendChild(base);

            pip.document.write(html);
            pip.document.close();

            setPipWindow(pip);

            pip.addEventListener('pagehide', () => {
                setPipWindow(null);
            }, { once: true });

        } catch (err) {
             console.error("PiP Error:", err);
             setPipWindow(null);
        }
    };

    // --- Action Handling ---
    const handleTakeAction = async (actionItemText: string) => {
        setLoadingActionItem(actionItemText);
        setActionError(null);
        setActionModalData(null);
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: `Based on the following action item, call the most appropriate tool to help the user complete it. Action item: "${actionItemText}"` }] }],
                config: {
                    tools: [{ functionDeclarations: [createCalendarEventTool, draftEmailTool, createDocumentTool] }],
                },
            });
            
            if (response.functionCalls && response.functionCalls.length > 0) {
                const functionCall = response.functionCalls[0];
                setActionModalData({
                    type: functionCall.name,
                    args: functionCall.args,
                    sourceItem: actionItemText,
                });
            } else {
                setActionModalData({ type: 'unknown_action', sourceItem: actionItemText });
            }
        } catch (err) {
            console.error("Error determining action:", err);
            setActionError(t.actionError);
        } finally {
            setLoadingActionItem(null);
        }
    };

    // --- Export Handlers ---
    const generateMarkdown = () => {
        if (!activeSession) return '';
        const { metadata, results, speakers } = activeSession;
        
        const speakerList = Object.entries(speakers)
            .map(([id, name]) => `- ${id}: ${name}`)
            .join('\n');
            
        const actionItemsList = results.actionItems
            .map(item => `- [ ] ${item}`)
            .join('\n');

        return `
# ${metadata.title}

- **Date:** ${new Date(metadata.date).toLocaleString()}
- **Location:** ${metadata.location}

---

## ✨ Key Summary

${results.summary}

---

## 📌 Action Items

${actionItemsList.length > 0 ? actionItemsList : 'No action items.'}

---

## 🗣️ Speakers

${speakerList.length > 0 ? speakerList : 'No speakers identified.'}

---

## 📋 Transcript

${results.transcript}
        `.trim();
    };

    const copyAsMarkdown = () => {
        const markdown = generateMarkdown();
        navigator.clipboard.writeText(markdown).then(() => {
            setShowCopiedMessage(true);
            setTimeout(() => setShowCopiedMessage(false), 2000);
        });
    };

    const downloadAsMarkdown = () => {
        const markdown = generateMarkdown();
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = activeSession?.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'meeting_notes';
        a.download = `${safeTitle}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    // --- UI Handlers ---
    const handleSessionSelect = (session: Session) => {
        if (isRecording) return;
        setActiveSession(session);
    };
    
     const handleRenameSpeaker = (sessionId: string, oldName: string) => {
        const newName = prompt(`${t.renameSpeakerPrompt} ${oldName}:`, oldName);
        if (newName && newName.trim() !== "") {
            setSessions(prevSessions =>
                prevSessions.map(session => {
                    if (session.id === sessionId) {
                        const newSpeakers = { ...session.speakers, [oldName]: newName };
                        // Also update the transcript
                        const newTranscript = session.results.transcript.replace(
                            new RegExp(`^${oldName}:`, 'gm'), 
                            `${newName}:`
                        );
                        const updatedSession = { 
                            ...session, 
                            speakers: newSpeakers,
                            results: { ...session.results, transcript: newTranscript }
                        };

                        if (activeSession?.id === sessionId) {
                            setActiveSession(updatedSession);
                        }
                        return updatedSession;
                    }
                    return session;
                })
            );
        }
    };

    const handleDeleteSession = (sessionId: string) => {
        if (window.confirm(t.deleteConfirmation)) {
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (activeSession?.id === sessionId) {
                setActiveSession(null);
            }
        }
    };

    const filteredSessions = sessions.filter(session =>
        session.metadata.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.results.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.results.transcript.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- Component Styles ---
    const styles: { [key: string]: CSSProperties } = {
        appContainer: {
            display: 'flex',
            height: '100vh',
            fontFamily: "'Poppins', sans-serif",
            backgroundColor: isDarkMode ? '#121212' : '#F7F7F7',
            color: isDarkMode ? '#E0E0E0' : '#333',
        },
        sidebar: {
            width: '350px',
            backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
            borderRight: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxSizing: 'border-box'
        },
        header: {
            marginBottom: '20px',
        },
        title: {
            fontSize: '2rem',
            fontWeight: 700,
            color: '#00A99D',
            margin: 0,
            textAlign: 'center'
        },
        subtitle: {
            fontSize: '0.9rem',
            textAlign: 'center',
            color: isDarkMode ? '#AAA' : '#777',
            marginTop: '4px'
        },
        recordButton: {
            width: '100%',
            padding: '15px',
            fontSize: '1.2rem',
            fontWeight: 600,
            backgroundColor: isRecording ? '#dc3545' : '#00A99D',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.3s ease',
            marginBottom: '10px'
        },
        secondaryButton: {
             width: '100%',
            padding: '10px',
            fontSize: '1rem',
            fontWeight: 600,
            backgroundColor: isDarkMode ? '#333' : '#e9ecef',
            color: isDarkMode ? '#E0E0E0' : '#495057',
            border: `1px solid ${isDarkMode ? '#444' : '#ced4da'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
        },
        recordIcon: {
            animation: isRecording ? 'pulse 2s infinite' : 'none',
        },
        searchBox: {
            width: '100%',
            padding: '10px',
            fontSize: '1rem',
            border: `1px solid ${isDarkMode ? '#444' : '#CCC'}`,
            borderRadius: '8px',
            backgroundColor: isDarkMode ? '#2C2C2C' : '#FFF',
            color: isDarkMode ? '#E0E0E0' : '#333',
            margin: '20px 0',
            boxSizing: 'border-box'
        },
        sessionListContainer: {
            flex: 1,
            overflowY: 'auto',
            paddingRight: '5px'
        },
        sessionListHeader: {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: isDarkMode ? '#CCC' : '#555',
            marginBottom: '10px',
            paddingBottom: '5px',
            borderBottom: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
        },
        sessionItem: {
            padding: '15px',
            marginBottom: '10px',
            borderRadius: '8px',
            cursor: 'pointer',
            border: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
            transition: 'all 0.2s',
        },
        sessionTitle: {
            fontWeight: 600,
            marginBottom: '5px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        },
        sessionDate: {
            fontSize: '0.8rem',
            color: isDarkMode ? '#AAA' : '#777',
        },
        footer: {
            textAlign: 'center',
            fontSize: '0.8rem',
            color: '#777',
            marginTop: '20px'
        },
        mainContent: {
            flex: 1,
            padding: '30px',
            overflowY: 'auto',
            position: 'relative',
        },
        welcomeView: {
            textAlign: 'center',
            paddingTop: '20vh',
            color: isDarkMode ? '#AAA' : '#777',
        },
        welcomeLogo: {
            fontSize: '4rem'
        },
        welcomeHeader: {
            fontSize: '2.5rem',
            fontWeight: 600,
            color: isDarkMode ? '#E0E0E0' : '#333',
        },
        welcomeSubtext: {
            fontSize: '1.2rem',
        },
        sessionView: {
            maxWidth: '800px',
            margin: '0 auto'
        },
        sessionHeader: {
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: `1px solid ${isDarkMode ? '#444' : '#DDD'}`
        },
        sessionHeaderTitle: {
            fontSize: '2rem',
            fontWeight: 700,
            margin: '0 0 10px 0'
        },
        sessionMetadata: {
            display: 'flex',
            gap: '20px',
            color: isDarkMode ? '#BBB' : '#666',
        },
        metadataItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
        },
        locationLink: {
            color: '#00A99D',
            textDecoration: 'none'
        },
        resultsGrid: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '30px',
            marginBottom: '30px'
        },
        card: {
            backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
            padding: '20px',
            borderRadius: '12px',
            border: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        },
        fullWidthCard: {
            gridColumn: '1 / -1'
        },
        cardHeader: {
            fontSize: '1.3rem',
            fontWeight: 600,
            marginBottom: '15px'
        },
        transcriptContent: {
            whiteSpace: 'pre-wrap',
            maxHeight: '400px',
            overflowY: 'auto',
            lineHeight: 1.6
        },
        actionList: {
            listStyle: 'none',
            padding: 0,
            margin: 0
        },
        actionItem: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: `1px solid ${isDarkMode ? '#333' : '#EEE'}`,
            gap: '10px',
        },
        actionButton: {
            backgroundColor: '#00A99D',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
            opacity: 1,
            transition: 'opacity 0.2s',
        },
        speakersList: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px'
        },
        speakerTag: {
             backgroundColor: isDarkMode ? '#333' : '#e9ecef',
            color: isDarkMode ? '#E0E0E0' : '#495057',
            padding: '5px 10px',
            borderRadius: '15px',
            fontSize: '0.9rem',
            cursor: 'pointer'
        },
        error: {
            color: '#dc3545',
            textAlign: 'center',
            margin: '10px 0'
        },
        loader: {
            textAlign: 'center',
            fontSize: '1.2rem',
            color: '#00A99D'
        },
        topControls: {
            position: 'absolute',
            top: '30px',
            right: '30px',
            display: 'flex',
            gap: '10px',
        },
        controlButton: {
            background: isDarkMode ? '#2C2C2C' : '#FFF',
            border: `1px solid ${isDarkMode ? '#444' : '#CCC'}`,
            color: isDarkMode ? '#E0E0E0' : '#333',
            padding: '8px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
        },
        deleteButton: {
            background: isDarkMode ? '#4a2529' : '#f8d7da',
            border: `1px solid ${isDarkMode ? '#dc3545' : '#f5c6cb'}`,
            color: isDarkMode ? '#f5c6cb' : '#721c24',
        },
        copiedPopup: {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#00A99D',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
        modalOverlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
        },
        modalContent: {
            backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
            padding: '25px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        },
        modalHeader: {
            fontSize: '1.4rem',
            fontWeight: 600,
            marginBottom: '20px',
            borderBottom: `1px solid ${isDarkMode ? '#444' : '#DDD'}`,
            paddingBottom: '15px'
        },
        modalFormLabel: {
            display: 'block',
            marginBottom: '5px',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: isDarkMode ? '#BBB' : '#666',
        },
        modalInput: {
            width: '100%',
            padding: '10px',
            fontSize: '1rem',
            border: `1px solid ${isDarkMode ? '#444' : '#CCC'}`,
            borderRadius: '8px',
            backgroundColor: isDarkMode ? '#2C2C2C' : '#FFF',
            color: isDarkMode ? '#E0E0E0' : '#333',
            marginBottom: '15px',
            boxSizing: 'border-box'
        },
        modalTextarea: {
            minHeight: '100px',
            resize: 'vertical',
        },
        modalFooter: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
        },
        modalButton: {
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
        },
        modalPrimaryButton: {
            backgroundColor: '#00A99D',
            color: 'white',
        },
        modalSecondaryButton: {
            backgroundColor: isDarkMode ? '#333' : '#e9ecef',
            color: isDarkMode ? '#E0E0E0' : '#495057',
        }
    };
    
    const activeSessionStyle = (session: Session) => ({
        ...styles.sessionItem,
        backgroundColor: activeSession?.id === session.id ? '#00A99D' : (isDarkMode ? '#2C2C2C' : '#FFF'),
        color: activeSession?.id === session.id ? 'white' : (isDarkMode ? '#E0E0E0' : '#333'),
        borderColor: activeSession?.id === session.id ? '#00A99D' : (isDarkMode ? '#444' : '#E0E0E0'),
    });

    const ActionModal = () => {
        if (!actionModalData) return null;
        
        const { type, args, sourceItem } = actionModalData;
        const [formData, setFormData] = useState(args || {});

        useEffect(() => {
            setFormData(args || {});
        }, [args]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        };
        
        const handleOpenCalendar = () => {
            const { title, date, time, description } = formData;
            const startDate = `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
            const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${startDate}&details=${encodeURIComponent(description || '')}`;
            window.open(url, '_blank');
            setActionModalData(null);
        };

        const handleOpenGmail = () => {
            const { to, subject, body } = formData;
            const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(url, '_blank');
            setActionModalData(null);
        };

        const handleOpenDocs = () => {
            const { content } = formData;
            navigator.clipboard.writeText(content);
            window.open('https://docs.google.com/create', '_blank');
            setActionModalData(null);
        };

        const renderContent = () => {
            switch (type) {
                case 'create_calendar_event':
                    return <>
                        <h3 style={styles.modalHeader}>{t.createCalendarEvent}</h3>
                        <div>
                            <label style={styles.modalFormLabel}>{t.titleLabel}</label>
                            <input type="text" name="title" value={formData.title || ''} onChange={handleChange} style={styles.modalInput} />
                            <label style={styles.modalFormLabel}>{t.dateLabel}</label>
                            <input type="date" name="date" value={formData.date || ''} onChange={handleChange} style={styles.modalInput} />
                            <label style={styles.modalFormLabel}>{t.timeLabel}</label>
                            <input type="time" name="time" value={formData.time || ''} onChange={handleChange} style={styles.modalInput} />
                            <label style={styles.modalFormLabel}>{t.descriptionLabel}</label>
                            <textarea name="description" value={formData.description || ''} onChange={handleChange} style={{...styles.modalInput, ...styles.modalTextarea}}></textarea>
                        </div>
                        <footer style={styles.modalFooter}>
                            <button onClick={() => setActionModalData(null)} style={{...styles.modalButton, ...styles.modalSecondaryButton}}>Cancel</button>
                            <button onClick={handleOpenCalendar} style={{...styles.modalButton, ...styles.modalPrimaryButton}}>{t.openInCalendar}</button>
                        </footer>
                    </>;
                case 'draft_email':
                     return <>
                        <h3 style={styles.modalHeader}>{t.draftEmail}</h3>
                        <div>
                            <label style={styles.modalFormLabel}>{t.toLabel}</label>
                            <input type="email" name="to" value={formData.to || ''} onChange={handleChange} style={styles.modalInput} />
                            <label style={styles.modalFormLabel}>{t.subjectLabel}</label>
                            <input type="text" name="subject" value={formData.subject || ''} onChange={handleChange} style={styles.modalInput} />
                             <label style={styles.modalFormLabel}>{t.bodyLabel}</label>
                            <textarea name="body" value={formData.body || ''} onChange={handleChange} style={{...styles.modalInput, ...styles.modalTextarea}}></textarea>
                        </div>
                        <footer style={styles.modalFooter}>
                            <button onClick={() => setActionModalData(null)} style={{...styles.modalButton, ...styles.modalSecondaryButton}}>Cancel</button>
                            <button onClick={handleOpenGmail} style={{...styles.modalButton, ...styles.modalPrimaryButton}}>{t.openInGmail}</button>
                        </footer>
                    </>;
                case 'create_document':
                     return <>
                        <h3 style={styles.modalHeader}>{t.createDocument}</h3>
                        <div>
                            <p>{t.createDocInfo}</p>
                            <label style={styles.modalFormLabel}>{t.suggestedTitle}</label>
                            <input type="text" name="title" value={formData.title || ''} onChange={handleChange} style={styles.modalInput} />
                             <label style={styles.modalFormLabel}>{t.suggestedContent}</label>
                            <textarea name="content" value={formData.content || ''} onChange={handleChange} style={{...styles.modalInput, ...styles.modalTextarea}}></textarea>
                        </div>
                        <footer style={styles.modalFooter}>
                            <button onClick={() => setActionModalData(null)} style={{...styles.modalButton, ...styles.modalSecondaryButton}}>Cancel</button>
                            <button onClick={handleOpenDocs} style={{...styles.modalButton, ...styles.modalPrimaryButton}}>{t.openGoogleDocs}</button>
                        </footer>
                    </>;
                case 'unknown_action':
                default:
                    return <>
                        <h3 style={styles.modalHeader}>{t.unknownAction}</h3>
                        <p>{t.noActionDetermined}</p>
                        <p><strong>Item:</strong> {sourceItem}</p>
                         <footer style={styles.modalFooter}>
                            <button onClick={() => setActionModalData(null)} style={{...styles.modalButton, ...styles.modalSecondaryButton}}>Close</button>
                        </footer>
                    </>;
            }
        };

        return (
            <div style={styles.modalOverlay} onClick={() => setActionModalData(null)}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    {renderContent()}
                </div>
            </div>
        );
    };
    

    // --- Render ---
    return (
        <div style={styles.appContainer}>
            <style>
                {`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
                }
                .sessionListContainer::-webkit-scrollbar { width: 5px; }
                .sessionListContainer::-webkit-scrollbar-track { background: transparent; }
                .sessionListContainer::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
                `}
            </style>
            <aside style={styles.sidebar}>
                <header style={styles.header}>
                    <h1 style={styles.title}>{t.title}</h1>
                    <p style={styles.subtitle}>{t.subtitle}</p>
                </header>

                 <div style={{ marginBottom: '20px' }}>
                    {!isRecording && (
                        <button onClick={handleStartRecording} style={styles.recordButton} disabled={isAnalyzing}>
                            {t.startRecording}
                        </button>
                    )}
                    {isRecording && (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            <button onClick={() => handleStopRecording()} style={styles.recordButton} disabled={isAnalyzing}>
                                <span style={styles.recordIcon}>⏹️</span> {t.stopRecording} {formatTime(recordingTime)}
                            </button>
                             {(window as any).documentPictureInPicture && (
                                <button onClick={togglePip} style={styles.secondaryButton}>
                                    {t.toggleMiniView}
                                </button>
                            )}
                        </div>

                    )}
                    {isAnalyzing && <div style={styles.loader}>{t.analyzing}</div>}
                    {error && <div style={styles.error}>{error}</div>}
                </div>

                <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    style={styles.searchBox}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isRecording}
                />

                <h2 style={styles.sessionListHeader}>{t.recentSessions}</h2>
                <div style={styles.sessionListContainer}>
                    {filteredSessions.map(session => (
                        <div key={session.id} style={activeSessionStyle(session)} onClick={() => handleSessionSelect(session)}>
                            <div style={styles.sessionTitle}>{session.metadata.title}</div>
                            <div style={styles.sessionDate}>{new Date(session.metadata.date).toLocaleString()}</div>
                        </div>
                    ))}
                </div>
                <footer style={styles.footer}>{t.footerText}</footer>
            </aside>

            <main style={styles.mainContent}>
                <ActionModal />
                {showCopiedMessage && <div style={styles.copiedPopup}>{t.copiedSuccess}</div>}

                {activeSession ? (
                    <div style={styles.sessionView}>
                        <div style={styles.topControls}>
                            <button style={styles.controlButton} onClick={copyAsMarkdown} title={t.copyMarkdown}>
                                📋 <span className="hide-mobile">{t.copyMarkdown}</span>
                            </button>
                            <button style={styles.controlButton} onClick={downloadAsMarkdown} title={t.downloadMarkdown}>
                                💾 <span className="hide-mobile">{t.downloadMarkdown}</span>
                            </button>
                            <button style={{...styles.controlButton, ...styles.deleteButton}} onClick={() => handleDeleteSession(activeSession.id)} title={t.deleteSession}>
                                🗑️
                            </button>
                        </div>
                        <header style={styles.sessionHeader}>
                            <h2 style={styles.sessionHeaderTitle}>{activeSession.metadata.title}</h2>
                            <div style={styles.sessionMetadata}>
                                <div style={styles.metadataItem}>🗓️ {new Date(activeSession.metadata.date).toLocaleString()}</div>
                                <div style={styles.metadataItem}>
                                    📍 
                                    {activeSession.metadata.mapUrl ? 
                                        <a href={activeSession.metadata.mapUrl} target="_blank" rel="noopener noreferrer" style={styles.locationLink}>{activeSession.metadata.location}</a> :
                                        activeSession.metadata.location
                                    }
                                </div>
                            </div>
                        </header>

                        <div style={styles.resultsGrid}>
                            <div style={styles.card}>
                                <h3 style={styles.cardHeader}>{t.summaryHeader}</h3>
                                <div dangerouslySetInnerHTML={{ __html: marked(activeSession.results.summary) }}></div>
                            </div>
                            <div style={styles.card}>
                                <h3 style={styles.cardHeader}>{t.actionItemsHeader}</h3>
                                {activeSession.results.actionItems.length > 0 ? (
                                    <ul style={styles.actionList}>
                                        {activeSession.results.actionItems.map((item, index) => (
                                            <li key={index} style={styles.actionItem}>
                                                <span style={{flex: 1}}>{item}</span>
                                                <button 
                                                    onClick={() => handleTakeAction(item)}
                                                    style={{...styles.actionButton, opacity: loadingActionItem === item ? 0.5 : 1}}
                                                    disabled={loadingActionItem === item}
                                                >
                                                     {loadingActionItem === item ? '...' : t.takeAction}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>{t.noActionDetermined}</p>
                                )}
                                {actionError && <div style={styles.error}>{actionError}</div>}
                            </div>
                            
                            <div style={{...styles.card, ...styles.fullWidthCard}}>
                                <h3 style={styles.cardHeader}>{t.speakersHeader}</h3>
                                <div style={styles.speakersList}>
                                    {Object.entries(activeSession.speakers).map(([id, name]) => (
                                        <span key={id} style={styles.speakerTag} onClick={() => handleRenameSpeaker(activeSession.id, id)}>
                                            {name} ✏️
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div style={{ ...styles.card, ...styles.fullWidthCard }}>
                                <h3 style={styles.cardHeader}>{t.transcriptHeader}</h3>
                                <div style={styles.transcriptContent} dangerouslySetInnerHTML={{ __html: marked(activeSession.results.transcript) }}></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={styles.welcomeView}>
                         <div style={styles.welcomeLogo}>🗒️</div>
                        <h2 style={styles.welcomeHeader}>{t.welcomeMessage}</h2>
                        <p style={styles.welcomeSubtext}>{t.welcomeSubtext}</p>
                    </div>
                )}
            </main>
        </div>
    );
};

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
