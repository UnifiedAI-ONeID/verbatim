
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
        toggleMiniView: 'Toggle Mini View',
        keepAwake: 'Keep Screen Awake',
        keepAwakeInfo: 'Prevents the screen from turning off during a recording session.',
        backToList: 'Back to Sessions',
        recordPhoneCallTitle: 'Recording a Phone Call?',
        recordPhoneCallInstruction: 'For best quality, connect your headset. You can also use your phone\'s speaker. Tap the record button to begin.',
        selectAudioDeviceTitle: 'Select Audio Source',
        selectAudioDeviceInstruction: 'Choose the microphone you want to use for the recording.',
        start: 'Start',
        cancel: 'Cancel',
        analysisPrompt: 'You are an expert multilingual meeting assistant. The user\'s preferred language is English. Analyze the following meeting audio, which may contain multiple spoken languages. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). Identify all unique speakers. All output text (summary, action items, transcript) MUST be translated to and written in English. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.',
        actionPrompt: 'Based on the following action item, call the most appropriate tool to help the user complete it. The user\'s language is English. Action item: "{actionItemText}"',
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
        toggleMiniView: 'Alternar Mini Vista',
        keepAwake: 'Mantener Pantalla Encendida',
        keepAwakeInfo: 'Evita que la pantalla se apague durante una sesión de grabación.',
        backToList: 'Volver a Sesiones',
        recordPhoneCallTitle: '¿Grabando una llamada telefónica?',
        recordPhoneCallInstruction: 'Para la mejor calidad, conecta tus auriculares. También puedes usar el altavoz de tu teléfono. Toca el botón de grabar para comenzar.',
        selectAudioDeviceTitle: 'Seleccionar Fuente de Audio',
        selectAudioDeviceInstruction: 'Elige el micrófono que deseas utilizar para la grabación.',
        start: 'Comenzar',
        cancel: 'Cancelar',
        analysisPrompt: 'Eres un experto asistente de reuniones multilingüe. El idioma preferido del usuario es español. Analiza el siguiente audio de la reunión, que puede contener varios idiomas hablados. Tu tarea es procesar este audio multilingüe y generar todo el resultado exclusivamente en español. Proporciona un resumen conciso, una lista de puntos de acción y una transcripción completa con etiquetas de orador (p. ej., Orador 1, Orador 2). Identifica a todos los oradores únicos. Todo el texto de salida (resumen, puntos de acción, transcripción) DEBE ser traducido y escrito en español. Formatea la salida como un objeto JSON con las claves: "summary", "actionItems" (un array de strings), "transcript" (un string con saltos de línea y etiquetas de orador), y "speakers" (un array de etiquetas de orador identificadas como ["Orador 1", "Orador 2"]). No incluyas el envoltorio de markdown para JSON.',
        actionPrompt: 'Basado en el siguiente punto de acción, llama a la herramienta más apropiada para ayudar al usuario a completarlo. El idioma del usuario es español. Punto de acción: "{actionItemText}"',
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
        toggleMiniView: '切换迷你视图',
        keepAwake: '保持屏幕常亮',
        keepAwakeInfo: '在录音期间防止屏幕关闭。',
        backToList: '返回会话列表',
        recordPhoneCallTitle: '正在录制电话通话？',
        recordPhoneCallInstruction: '为获得最佳音质，请连接您的耳机。您也可以使用手机的扬声器。点击录音按钮开始。',
        selectAudioDeviceTitle: '选择音频源',
        selectAudioDeviceInstruction: '请选择您要用于录音的麦克风。',
        start: '开始',
        cancel: '取消',
        analysisPrompt: '你是一位专业的多语言会议助理。用户的首选语言是简体中文。请分析接下来的会议音频，其中可能包含多种口语语言。你的任务是处理这段多语言音频，并完全以简体中文生成所有输出。提供一份简洁的摘要、一个行动项列表和一份带有发言人标签（例如，发言人 1，发言人 2）的完整文字记录。识别所有唯一的发言人。所有输出文本（摘要、行动项、文字记录）都必须翻译成并以简体中文书写。将输出格式化为 JSON 对象，包含以下键："summary"、"actionItems"（字符串数组）、"transcript"（包含换行符和发言人标签的字符串）和 "speakers"（已识别的发言人标签数组，如 ["发言人 1", "发言人 2"]）。不要包含 JSON 的 markdown 包装器。',
        actionPrompt: '根据以下行动项，调用最合适的工具来帮助用户完成它。用户的语言是简体中文。行动项："{actionItemText}"',
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
        toggleMiniView: '切換迷你視圖',
        keepAwake: '保持螢幕喚醒',
        keepAwakeInfo: '在錄音期間防止螢幕關閉。',
        backToList: '返回會議列表',
        recordPhoneCallTitle: '正在錄製電話通話？',
        recordPhoneCallInstruction: '為獲得最佳品質，請連接您的耳機。您也可以使用手機的揚聲器。點擊錄音按鈕開始。',
        selectAudioDeviceTitle: '選擇音訊來源',
        selectAudioDeviceInstruction: '請選擇您要用於錄音的麥克風。',
        start: '開始',
        cancel: '取消',
        analysisPrompt: '你是一位專業的多語言會議助理。使用者的首選語言是繁體中文。請分析接下來的會議音訊，其中可能包含多種口語語言。你的任務是處理這段多語言音訊，並完全以繁體中文生成所有輸出。提供一份簡潔的摘要、一個行動項目清單、一份帶有發言人標籤（例如，發言人 1，發言人 2）的完整文字記錄，並識別所有唯一的發言人。所有輸出文字（摘要、行動項目、文字記錄）都必須翻譯成並以繁體中文書寫。將輸出格式化為 JSON 物件，包含以下鍵："summary"、"actionItems"（字串陣列）、"transcript"（包含換行符和發言人標籤的字串）和 "speakers"（已識別的發言人標籤陣列，如 ["發言人 1", "發言人 2"]）。不要包含 JSON 的 markdown 包裝器。',
        actionPrompt: '根據以下行動項目，呼叫最合適的工具來幫助使用者完成它。使用者的語言是繁體中文。行動項目："{actionItemText}"',
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
    const [keepAwake, setKeepAwake] = useState(false);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
    const [showDeviceSelector, setShowDeviceSelector] = useState(false);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');


    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef(new BroadcastChannel('verbatim_pip_channel'));
    const wakeLockSentinelRef = useRef<any | null>(null);


    // --- Data Persistence & Responsive View ---
    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('verbatim_sessions');
            if (savedSessions) {
                setSessions(JSON.parse(savedSessions));
            }
        } catch (e) {
            console.error("Failed to load sessions from localStorage", e);
        }

        const handleResize = () => setIsMobileView(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
    
    // --- Wake Lock ---
    const handleWakeLock = useCallback(async () => {
        if (keepAwake && isRecording) {
            try {
                if ('wakeLock' in navigator && wakeLockSentinelRef.current === null) {
                    wakeLockSentinelRef.current = await (navigator as any).wakeLock.request('screen');
                    console.log('Screen Wake Lock is active.');
                }
            } catch (err: any) {
                console.error(`Wake Lock failed: ${err.name}, ${err.message}`);
            }
        } else {
            if (wakeLockSentinelRef.current) {
                await wakeLockSentinelRef.current.release();
                wakeLockSentinelRef.current = null;
                console.log('Screen Wake Lock released.');
            }
        }
    }, [keepAwake, isRecording]);

    useEffect(() => {
        handleWakeLock();
    }, [keepAwake, isRecording, handleWakeLock]);
    
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [handleWakeLock]);


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
            
             const systemInstruction = t.analysisPrompt;
            
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
    }, [location, pipWindow, t.processingError, t.meetingTitle, t.locationUnavailable, t.noTranscript, t.noSummary, t.analysisPrompt]);

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
    const prepareRecording = async () => {
        try {
             // First, get microphone permission. This is necessary for enumerateDevices to return full device labels.
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // We don't need this stream, just the permission.

            const devices = await navigator.mediaDevices.enumerateDevices();
            const mics = devices.filter(device => device.kind === 'audioinput');
            setAudioDevices(mics);
            if (mics.length > 0) {
                setSelectedAudioDevice(mics[0].deviceId);
            }
            setShowDeviceSelector(true);
        } catch (err) {
            console.error("Error preparing recording:", err);
            setError(t.micPermissionError);
        }
    };

    const startRecordingWithDevice = async (deviceId: string) => {
        if (!deviceId) {
            setError('No audio device selected.');
            return;
        }
        setShowDeviceSelector(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: { exact: deviceId } } 
            });
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
            setActiveSession(null);
            getLocation();

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prevTime => {
                    const newTime = prevTime + 1;
                    channelRef.current.postMessage({ type: 'time_update', time: newTime });
                    return newTime;
                });
            }, 1000);

        } catch (err) {
            console.error("Error starting recording with device:", err);
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
            const promptText = t.actionPrompt.replace('{actionItemText}', actionItemText);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: promptText }] }],
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
            const updatedSessions = sessions.map(session => {
                if (session.id === sessionId) {
                    const newSpeakers = { ...session.speakers, [oldName]: newName.trim() };
                    const newTranscript = session.results.transcript.replace(
                        new RegExp(`^${oldName}:`, 'gm'), 
                        `${newName.trim()}:`
                    );
                    return { 
                        ...session, 
                        speakers: newSpeakers,
                        results: { ...session.results, transcript: newTranscript }
                    };
                }
                return session;
            });
            setSessions(updatedSessions);
            
            if(activeSession?.id === sessionId) {
                const updatedActiveSession = updatedSessions.find(s => s.id === sessionId);
                if (updatedActiveSession) setActiveSession(updatedActiveSession);
            }
        }
    };
    
    const handleDeleteSession = (sessionId: string) => {
        if (window.confirm(t.deleteConfirmation)) {
            const newSessions = sessions.filter(s => s.id !== sessionId);
            setSessions(newSessions);
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
    
    const renderDeviceSelectorModal = () => {
        if (!showDeviceSelector) return null;

        const handleConfirm = () => {
            startRecordingWithDevice(selectedAudioDevice);
        };

        const handleCancel = () => {
            setShowDeviceSelector(false);
        };

        return (
            <div style={styles.modalBackdrop} onClick={handleCancel}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <h3>{t.selectAudioDeviceTitle}</h3>
                    <p>{t.selectAudioDeviceInstruction}</p>
                    <select
                        value={selectedAudioDevice}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                        style={styles.deviceSelector}
                    >
                        {audioDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                            </option>
                        ))}
                    </select>
                    <div style={styles.modalActions}>
                        <button onClick={handleCancel} className="action-button secondary">{t.cancel}</button>
                        <button onClick={handleConfirm} className="action-button">{t.start}</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderActionModal = () => {
        if (!actionModalData) return null;

        const { type, args, sourceItem } = actionModalData;
        
        const closeModal = () => setActionModalData(null);

        const renderContent = () => {
            switch (type) {
                case 'create_calendar_event':
                    const calendarUrl = new URL('https://calendar.google.com/calendar/render');
                    calendarUrl.searchParams.set('action', 'TEMPLATE');
                    calendarUrl.searchParams.set('text', args.title || '');
                    calendarUrl.searchParams.set('details', args.description || sourceItem || '');
                    if (args.date && args.time) {
                         const startDate = new Date(`${args.date}T${args.time}`);
                         const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
                         const toIso = (d: Date) => d.toISOString().replace(/[-:.]/g, '');
                         calendarUrl.searchParams.set('dates', `${toIso(startDate)}/${toIso(endDate)}`);
                    }
                    return (
                        <>
                            <h3>{t.createCalendarEvent}</h3>
                            <p><strong>{t.titleLabel}</strong> {args.title}</p>
                            <p><strong>{t.descriptionLabel}</strong> {args.description || sourceItem}</p>
                            <p><strong>{t.dateLabel}</strong> {args.date}</p>
                            <p><strong>{t.timeLabel}</strong> {args.time}</p>
                            <a href={calendarUrl.toString()} target="_blank" rel="noopener noreferrer" className="action-button">
                                {t.openInCalendar}
                            </a>
                        </>
                    );
                case 'draft_email':
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(args.to)}&su=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}`;
                    return (
                        <>
                            <h3>{t.draftEmail}</h3>
                            <p><strong>{t.toLabel}</strong> {args.to}</p>
                            <p><strong>{t.subjectLabel}</strong> {args.subject}</p>
                            <p><strong>{t.bodyLabel}</strong></p>
                            <pre style={styles.modalPre}>{args.body}</pre>
                            <a href={gmailUrl} target="_blank" rel="noopener noreferrer" className="action-button">
                                {t.openInGmail}
                            </a>
                        </>
                    );
                case 'create_document':
                    const handleOpenDocs = () => {
                        navigator.clipboard.writeText(args.content);
                        window.open('https://docs.google.com/document/create', '_blank', 'noopener,noreferrer');
                    };
                    return (
                        <>
                            <h3>{t.createDocument}</h3>
                            <p>{t.createDocInfo}</p>
                            <p><strong>{t.suggestedTitle}</strong> {args.title}</p>
                            <p><strong>{t.suggestedContent}</strong></p>
                            <pre style={styles.modalPre}>{args.content}</pre>
                            <button onClick={handleOpenDocs} className="action-button">
                                {t.openGoogleDocs}
                            </button>
                        </>
                    );
                default:
                    return (
                        <>
                            <h3>{t.unknownAction}</h3>
                            <p>{t.noActionDetermined}</p>
                        </>
                    );
            }
        };

        return (
            <div style={styles.modalBackdrop} onClick={closeModal}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={closeModal}>&times;</button>
                    {actionError ? <p style={{color: 'red'}}>{actionError}</p> : renderContent()}
                </div>
            </div>
        );
    };
    
    const renderControls = () => (
        <div style={styles.controls}>
             {isRecording ? (
                <>
                    <button onClick={handleStopRecording} style={{...styles.button, ...styles.stopButton}}>
                        {t.stopRecording} <span style={styles.timer}>{formatTime(recordingTime)}</span>
                    </button>
                    {(window as any).documentPictureInPicture && (
                       <button onClick={togglePip} style={{...styles.button, ...styles.secondaryButton}}>
                            {t.toggleMiniView}
                        </button>
                    )}
                    {'wakeLock' in navigator && (
                       <div style={styles.keepAwakeToggle} title={t.keepAwakeInfo}>
                            <input type="checkbox" id="keepAwake" checked={keepAwake} onChange={(e) => setKeepAwake(e.target.checked)} />
                            <label htmlFor="keepAwake">{t.keepAwake}</label>
                       </div>
                    )}
                </>
            ) : (
                <button onClick={prepareRecording} style={{...styles.button, ...styles.startButton}} disabled={isAnalyzing}>
                    {isAnalyzing ? t.analyzing : t.startRecording}
                </button>
            )}
             {isAnalyzing && <div style={styles.loader}></div>}
             {error && <p style={styles.error}>{error}</p>}
        </div>
    );
    
    const renderMobileCta = () => (
        !isRecording && !isAnalyzing && (
            <div style={styles.mobileCtaCard}>
                <h3 style={styles.mobileCtaTitle}>📞 {t.recordPhoneCallTitle}</h3>
                <p style={styles.mobileCtaText}>{t.recordPhoneCallInstruction}</p>
            </div>
        )
    );

    const renderSessionList = () => (
         <div style={styles.sessionList}>
            <h2 style={styles.listHeader}>{t.recentSessions}</h2>
            <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
                disabled={isRecording}
            />
            {filteredSessions.map(session => (
                <div
                    key={session.id}
                    style={{
                        ...styles.sessionCard,
                        ...(activeSession?.id === session.id ? styles.activeSessionCard : {}),
                        ...(isRecording ? { cursor: 'not-allowed', opacity: 0.6 } : {})
                    }}
                    onClick={() => handleSessionSelect(session)}
                >
                    <div style={styles.sessionCardContent}>
                        <h3 style={styles.sessionTitle}>{session.metadata.title}</h3>
                        <p style={styles.sessionDate}>{new Date(session.metadata.date).toLocaleDateString()}</p>
                    </div>
                    <button
                        style={styles.deleteButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                        }}
                         disabled={isRecording}
                    >
                        🗑️
                    </button>
                </div>
            ))}
            {sessions.length === 0 && !isRecording && !isAnalyzing && (
                 <div style={styles.welcomeContainer}>
                    <h3>{t.welcomeMessage}</h3>
                    <p>{t.welcomeSubtext}</p>
                </div>
            )}
        </div>
    );
    
     const renderSessionDetail = () => (
        <div style={styles.sessionDetail}>
            {activeSession ? (
                <>
                    {isMobileView && (
                        <button onClick={() => setActiveSession(null)} style={styles.backButton}>
                            &larr; {t.backToList}
                        </button>
                    )}
                    <div style={styles.detailHeader}>
                        <h2 style={styles.detailTitle}>{activeSession.metadata.title}</h2>
                        <div style={styles.metadata}>
                            <span>{new Date(activeSession.metadata.date).toLocaleString()}</span>
                            {activeSession.metadata.location !== t.locationUnavailable ? (
                                <a href={activeSession.metadata.mapUrl} target="_blank" rel="noopener noreferrer">
                                    {activeSession.metadata.location}
                                </a>
                            ) : (
                                <span>{activeSession.metadata.location}</span>
                            )}
                        </div>
                         <div style={styles.exportControls}>
                            <button onClick={copyAsMarkdown} style={{...styles.button, ...styles.secondaryButton}}>
                                {showCopiedMessage ? t.copiedSuccess : t.copyMarkdown}
                            </button>
                            <button onClick={downloadAsMarkdown} style={{...styles.button, ...styles.secondaryButton}}>
                                {t.downloadMarkdown}
                            </button>
                        </div>
                    </div>
                    
                    <div style={styles.resultsGrid}>
                        <div style={styles.resultCard}>
                            <h3>{t.summaryHeader}</h3>
                            <div dangerouslySetInnerHTML={{ __html: marked(activeSession.results.summary) }} />
                        </div>
                        <div style={styles.resultCard}>
                            <h3>{t.actionItemsHeader}</h3>
                            <ul>
                                {activeSession.results.actionItems.map((item, index) => (
                                    <li key={index} style={styles.actionItem}>
                                        <span>{item}</span>
                                        <button 
                                            onClick={() => handleTakeAction(item)} 
                                            style={styles.takeActionButton}
                                            disabled={loadingActionItem === item}>
                                                {loadingActionItem === item ? '...' : t.takeAction}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                         <div style={styles.resultCard}>
                             <h3>{t.speakersHeader}</h3>
                            <ul>
                                {Object.entries(activeSession.speakers).map(([id, name]) => (
                                    <li key={id} style={styles.speakerItem}>
                                        <span>{id}: {name}</span>
                                        <button onClick={() => handleRenameSpeaker(activeSession.id, id)} style={styles.renameButton}>✏️</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{...styles.resultCard, ...styles.transcriptCard}}>
                            <h3>{t.transcriptHeader}</h3>
                            <pre style={styles.transcript}>{activeSession.results.transcript}</pre>
                        </div>
                    </div>
                </>
            ) : (
                <div style={styles.welcomeContainer}>
                    {!isMobileView && <h2>{t.welcomeMessage}</h2>}
                    {!isMobileView && <p>{t.welcomeSubtext}</p>}
                </div>
            )}
        </div>
    );


    // --- Main Render ---
    return (
        <div style={styles.appContainer}>
            <header style={styles.header}>
                <h1 style={styles.title}>{t.title}</h1>
                <p style={styles.subtitle}>{t.subtitle}</p>
            </header>

            {!isMobileView && renderControls()}
            
            <main style={{
                ...styles.mainContent,
                ...(isMobileView && {
                    display: 'block',
                    padding: '1rem',
                })
            }}>
                {isMobileView ? (
                    activeSession ? renderSessionDetail() : (
                        <>
                            {renderMobileCta()}
                            {renderSessionList()}
                        </>
                    )
                ) : (
                    <>
                        {renderSessionList()}
                        {renderSessionDetail()}
                    </>
                )}
            </main>
            
            {isMobileView && (
                <div style={styles.mobileControlsContainer}>
                    {isRecording || isAnalyzing ? renderControls() : (
                        <button onClick={prepareRecording} style={styles.fab} disabled={isAnalyzing}>
                             🎤
                        </button>
                    )}
                </div>
            )}
            
            {renderActionModal()}
            {renderDeviceSelectorModal()}

            <footer style={styles.footer}>
                <p>{t.footerText}</p>
            </footer>
        </div>
    );
};

// --- Styles ---
const styles: { [key: string]: CSSProperties } = {
    appContainer: {
        fontFamily: "'Poppins', sans-serif",
        backgroundColor: isDarkMode ? '#121212' : '#F7F9FC',
        color: isDarkMode ? '#E0E0E0' : '#202124',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        textAlign: 'center',
        padding: '2rem 1rem 1rem',
        borderBottom: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
    },
    title: {
        margin: 0,
        fontSize: '2.5rem',
        fontWeight: 700,
        color: '#00A99D',
    },
    subtitle: {
        margin: '0.25rem 0 0',
        fontSize: '1rem',
        color: isDarkMode ? '#999' : '#5F6368',
    },
    controls: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        gap: '1rem',
        flexWrap: 'wrap',
    },
    button: {
        padding: '0.75rem 1.5rem',
        fontSize: '1rem',
        fontWeight: 600,
        borderRadius: '50px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    startButton: {
        backgroundColor: '#00A99D',
        color: 'white',
        boxShadow: '0 4px 15px rgba(0, 169, 157, 0.2)',
    },
    stopButton: {
        backgroundColor: '#D9534F',
        color: 'white',
        boxShadow: '0 4px 15px rgba(217, 83, 79, 0.2)',
    },
    secondaryButton: {
        backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
        color: isDarkMode ? '#fff' : '#333',
    },
    timer: {
        fontFamily: 'monospace',
        fontSize: '1rem',
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: '0.2rem 0.5rem',
        borderRadius: '5px',
    },
    keepAwakeToggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.9rem',
        cursor: 'pointer',
    },
    error: {
        color: '#D9534F',
        textAlign: 'center',
        width: '100%',
    },
    loader: {
        border: `4px solid ${isDarkMode ? '#555' : '#f3f3f3'}`,
        borderTop: '4px solid #00A99D',
        borderRadius: '50%',
        width: '24px',
        height: '24px',
        animation: 'spin 1s linear infinite',
    },
    mainContent: {
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        gap: '1.5rem',
        padding: '1.5rem',
        overflow: 'hidden',
    },
    sessionList: {
        backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
        borderRadius: '12px',
        padding: '1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        border: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
    },
    listHeader: {
        margin: '0 0 1rem 0',
        fontSize: '1.25rem',
    },
    searchInput: {
        width: '100%',
        padding: '0.75rem',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
        backgroundColor: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#000',
        boxSizing: 'border-box',
        marginBottom: '0.5rem',
    },
    sessionCard: {
        padding: '1rem',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.2s, box-shadow 0.2s',
        border: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    activeSessionCard: {
        backgroundColor: 'rgba(0, 169, 157, 0.1)',
        borderColor: '#00A99D',
        boxShadow: '0 0 10px rgba(0, 169, 157, 0.2)',
    },
    sessionCardContent: {
        flex: 1,
    },
    sessionTitle: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: 600,
    },
    sessionDate: {
        margin: '0.25rem 0 0',
        fontSize: '0.8rem',
        color: '#999',
    },
    deleteButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1.2rem',
        padding: '0.5rem',
        borderRadius: '50%',
        transition: 'background-color 0.2s',
    },
    sessionDetail: {
        backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
        borderRadius: '12px',
        padding: '2rem',
        overflowY: 'auto',
        border: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
    },
    detailHeader: {
        borderBottom: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
        paddingBottom: '1rem',
        marginBottom: '1.5rem',
    },
    detailTitle: {
        margin: 0,
        fontSize: '1.75rem',
    },
    metadata: {
        display: 'flex',
        gap: '1rem',
        color: '#999',
        fontSize: '0.9rem',
        marginTop: '0.5rem',
        flexWrap: 'wrap',
    },
    exportControls: {
        marginTop: '1rem',
        display: 'flex',
        gap: '0.5rem',
    },
    resultsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
    },
    resultCard: {
        backgroundColor: isDarkMode ? '#252525' : '#F7F9FC',
        padding: '1.5rem',
        borderRadius: '12px',
    },
    transcriptCard: {
        gridColumn: '1 / -1',
    },
    transcript: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'monospace',
        fontSize: '0.9rem',
        lineHeight: 1.6,
        color: isDarkMode ? '#ccc' : '#333',
        maxHeight: '400px',
        overflowY: 'auto',
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
        padding: '1rem',
        borderRadius: '8px',
    },
    actionItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.5rem 0',
    },
    takeActionButton: {
        backgroundColor: '#00A99D',
        color: 'white',
        border: 'none',
        borderRadius: '20px',
        padding: '0.3rem 0.8rem',
        fontSize: '0.8rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    speakerItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.2rem 0',
    },
    renameButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
    },
    modalBackdrop: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: isDarkMode ? '#282828' : '#fff',
        padding: '2rem',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '90%',
        position: 'relative',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
    },
    modalCloseButton: {
        position: 'absolute',
        top: '10px',
        right: '15px',
        background: 'none',
        border: 'none',
        fontSize: '1.8rem',
        cursor: 'pointer',
        color: isDarkMode ? '#aaa' : '#555',
    },
    modalPre: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
        padding: '1rem',
        borderRadius: '8px',
        maxHeight: '200px',
        overflowY: 'auto',
    },
    welcomeContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        height: '100%',
        color: '#999',
    },
    footer: {
        textAlign: 'center',
        padding: '1rem',
        fontSize: '0.8rem',
        color: '#999',
        borderTop: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
    },
    mobileControlsContainer: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '1rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: `linear-gradient(to top, ${isDarkMode ? '#121212' : '#F7F9FC'} 80%, transparent)`,
    },
    fab: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#00A99D',
        color: 'white',
        border: 'none',
        fontSize: '2rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 15px rgba(0, 169, 157, 0.4)',
        cursor: 'pointer',
    },
    backButton: {
        background: 'none',
        border: 'none',
        color: '#00A99D',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
        marginBottom: '1rem',
        display: 'inline-flex',
        alignItems: 'center',
    },
    mobileCtaCard: {
        backgroundColor: isDarkMode ? '#252525' : 'rgba(0, 169, 157, 0.05)',
        border: `1px solid ${isDarkMode ? '#333' : 'rgba(0, 169, 157, 0.2)'}`,
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1rem',
    },
    mobileCtaTitle: {
        margin: '0 0 0.5rem 0',
        fontSize: '1.1rem',
        fontWeight: 600,
        color: isDarkMode ? '#E0E0E0' : '#202124',
    },
    mobileCtaText: {
        margin: 0,
        fontSize: '0.9rem',
        lineHeight: 1.5,
        color: isDarkMode ? '#bbb' : '#5F6368',
    },
    deviceSelector: {
        width: '100%',
        padding: '0.75rem',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
        backgroundColor: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#000',
        marginBottom: '1rem',
        fontSize: '1rem',
    },
    modalActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        marginTop: '1rem',
    },
};

// --- Keyframes for Loader ---
const keyframes = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = keyframes;
document.head.appendChild(styleSheet);


// --- Render App ---
const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);