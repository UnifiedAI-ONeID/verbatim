import React, { useState, useRef, CSSProperties, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { marked } from 'marked';
import { jwtDecode } from 'jwt-decode';

// --- Type Declarations ---
declare global {
  interface Window {
    google?: any;
  }
}

// --- Gemini API Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'unknown';
type MeetingResults = { transcript: string; summary: string; actionItems: string[] };
type MeetingMetadata = { title: string; date: string; location: string; mapUrl: string; };
type Session = { id: string; metadata: MeetingMetadata; results: MeetingResults; speakers: Record<string, string>; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };
type User = { id: string; name: string; email: string; picture?: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };
type ActiveTab = 'record' | 'sessions';
type PostLoginAction = 'record' | 'sessions';


// --- Component Prop Types ---
type AccordionProps = {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
};

type ModalProps = {
  children?: React.ReactNode;
  onClose: () => void;
  title: string;
};


// --- Mock Database Service ---
// This service simulates a persistent cloud database using localStorage for robustness
// and to maintain state across page reloads. It returns promises to mimic
// real async database calls.
const dbService = {
    getUser: async (): Promise<User | null> => {
        const userJson = localStorage.getItem('verbatim_user');
        return userJson ? JSON.parse(userJson) : null;
    },
    saveUser: async (user: User): Promise<User> => {
        localStorage.setItem('verbatim_user', JSON.stringify(user));
        return user;
    },
    logout: async (): Promise<void> => {
        localStorage.removeItem('verbatim_user');
    },
    getSessions: async (userId: string): Promise<Session[]> => {
        const sessionsJson = localStorage.getItem(`verbatim_sessions_${userId}`);
        return sessionsJson ? JSON.parse(sessionsJson) : [];
    },
    saveSession: async (userId: string, session: Session): Promise<void> => {
        const sessions = await dbService.getSessions(userId);
        const existingIndex = sessions.findIndex(s => s.id === session.id);
        if (existingIndex > -1) {
            sessions[existingIndex] = session;
        } else {
            sessions.unshift(session);
        }
        localStorage.setItem(`verbatim_sessions_${userId}`, JSON.stringify(sessions));
    },
    deleteSession: async (userId: string, sessionId: string): Promise<void> => {
        let sessions = await dbService.getSessions(userId);
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem(`verbatim_sessions_${userId}`, JSON.stringify(sessions));
    },
};


// --- i18n Translations ---
const translations = {
    en: {
        title: 'Verbatim',
        subtitle: 'Your intelligent meeting dashboard.',
        welcomeUser: 'Welcome, {name}',
        startRecording: '🎤 New Session',
        stopRecording: '⏹️ Stop',
        analyzing: 'Analyzing...',
        micPermissionError: 'Could not start recording. Please grant microphone permissions.',
        processingError: 'Failed to process audio. This can happen due to a poor network connection, a very short recording, or if the audio is silent. Please try again.',
        offlineError: 'Analysis requires an internet connection. Please connect and try again.',
        recordingTooShortError: 'Recording is too short to analyze. Please record for at least 2 seconds.',
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
        draftEmail: 'Draft Email',
        toLabel: 'To:',
        subjectLabel: 'Subject:',
        bodyLabel: 'Body:',
        openInEmailApp: 'Open in Email App',
        draftInvoiceEmail: 'Draft Invoice Email',
        recipientNameLabel: 'Recipient Name:',
        amountLabel: 'Amount:',
        invoiceEmailBody: 'Hello {recipientName},\n\nThis is an invoice for the following item:\n- {itemDescription}\n\nAmount Due: {currencySymbol}{amount}\n\nPlease let me know if you have any questions.\n\nBest,\n{userName}',
        initiatePhoneCall: 'Initiate Phone Call',
        phoneNumberLabel: 'Phone Number:',
        reasonLabel: 'Reason:',
        callNow: 'Call Now',
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
        welcomeSubtext: 'Your recorded sessions will appear here. Tap the microphone to get started.',
        deleteSession: 'Delete Session?',
        deleteConfirmation: 'Are you sure you want to delete this session? This action cannot be undone.',
        searchPlaceholder: 'Search sessions...',
        toggleMiniView: 'Picture-in-Picture',
        keepAwake: 'Keep Screen Awake',
        keepAwakeInfo: 'Prevents the screen from turning off during a recording session.',
        backToList: 'Back to Sessions',
        recordPhoneCallTitle: 'Recording a Phone Call?',
        recordPhoneCallInstruction: 'For best quality, connect your headset. You can also use your phone\'s speaker. Tap the record button to begin.',
        selectAudioDeviceTitle: 'Select Audio Source',
        selectAudioDeviceInstruction: 'Choose the microphone you want to use for the recording.',
        start: 'Start',
        cancel: 'Cancel',
        analysisPrompt: 'You are an expert multilingual meeting assistant. The user\'s preferred language is English. Analyze the following meeting audio, which may contain multiple spoken languages. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). In the summary, pay special attention to and clearly list any financial figures, budgets, or costs mentioned. Identify all unique speakers. All output text (summary, action items, transcript) MUST be translated to and written in English. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.',
        actionPrompt: 'You are an intelligent assistant. Based on the full context of a meeting and a specific action item, call the most appropriate tool to help the user complete it. The user\'s language is English. Meeting Title: "{meetingTitle}". Meeting Date: "{meetingDate}". Meeting Summary: "{meetingSummary}". Action Item: "{actionItemText}". Ensure all generated content like email subjects or event descriptions are relevant to the meeting context.',
        featureShowcase: 'Verbatim Features',
        createdBy: 'Created by',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: 'Lovingly dedicated to my family, all the busy moms out there, and the creator. ❤️',
        featureList: [
            'Multilingual AI Analysis',
            'Automatic Summary & Action Items',
            'Full Transcription with Speaker Labels',
            'One-Click Actions (Calendar, Gmail, Docs)',
            'Markdown Export & Copy',
            'Picture-in-Picture Mini View',
            'Offline PWA Functionality',
            'Audio Source Selection',
        ],
        loginTitle: 'Welcome to Verbatim',
        loginSubtitle: 'Sign in with Google to save and manage your sessions.',
        signIn: 'Sign In',
        faqLink: 'FAQ',
        faqTitle: 'Frequently Asked Questions',
        logout: 'Logout',
        faq: [
            {
                q: 'What\'s new in this version (Beta v1.3)?',
                a: 'This version enhances the AI\'s intelligence, particularly around financial topics. The AI now better identifies and highlights monetary figures in the summary. It also introduces a new "Draft Invoice" one-click action for relevant tasks, making financial follow-ups quicker and easier.',
            },
            {
                q: 'How does the app handle discussions about money?',
                a: 'The AI is trained to recognize conversations involving finances. It will automatically highlight any specific figures, budgets, or costs mentioned during the meeting in the "Key Summary" section. If an action item involves billing a client (e.g., "Send an invoice to Client X for $500"), the "Take Action" button will offer to draft an invoice email for you, pre-filling the recipient, amount, and description.',
            },
            {
                q: 'How do I start a new recording?',
                a: 'Tap the large microphone button on the "Record" tab. If it\'s your first time, you\'ll be prompted to sign in with Google. After signing in, choose your microphone and click "Start" to begin recording.',
            },
            {
                q: 'Can Verbatim understand different languages in the same meeting?',
                a: 'Yes! Verbatim is powered by a multilingual AI that can process audio containing multiple languages. All final outputs, including the summary, action items, and transcript, will be translated into and presented in your browser\'s default language (English, Spanish, or Chinese).',
            },
            {
                q: 'How are speakers identified and can I change their names?',
                a: 'The AI automatically distinguishes between different speakers and labels them as "Speaker 1," etc. After analysis, click the pencil icon (✏️) next to a speaker\'s name. The name becomes an editable field. Type the new name and press Enter or click away to save. This updates the name throughout the transcript.',
            },
            {
                q: 'What are "One-Click Actions"?',
                a: 'For each action item identified by the AI, you can click the "Take Action ✨" button. The AI will determine the best tool for the task (like creating a calendar event, drafting an email, or starting a document) and pre-fill the necessary information for you.',
            },
            {
                q: 'How can I use the recording controls while in another window?',
                a: 'While recording on a desktop browser, click the "Toggle Mini View" button. This will open a small Picture-in-Picture window with a timer and a "Stop" button, which stays on top of your other windows so you can easily control the recording.',
            },
            {
                q: 'Does the app work offline?',
                a: 'Yes. Verbatim is a Progressive Web App (PWA). After your first visit, you can install it on your device for an app-like experience. You can view past sessions even without an internet connection. However, analyzing a new recording requires an internet connection to communicate with the AI.',
            },
            {
                q: 'Where is my data stored?',
                a: 'Your account info and all session data is stored in a mock cloud database that uses your browser\'s local storage for persistence. This allows you to access your data across browser refreshes. No data is sent to or stored on any external server, except for the temporary processing of audio by the Gemini API during analysis.',
            },
        ],
        sessions: 'Sessions',
        record: 'Record',
        recording: 'Recording...',
        tapToRecord: 'Tap to start recording',
    },
    es: {
        title: 'Verbatim',
        subtitle: 'Tu panel de reuniones inteligente.',
        welcomeUser: 'Bienvenido, {name}',
        startRecording: '🎤 Nueva Sesión',
        stopRecording: '⏹️ Detener',
        analyzing: 'Analizando...',
        micPermissionError: 'No se pudo iniciar la grabación. Por favor, concede permisos de micrófono.',
        processingError: 'Error al procesar el audio. Esto puede ocurrir por una mala conexión de red, una grabación muy corta o si el audio está en silencio. Por favor, inténtalo de nuevo.',
        offlineError: 'El análisis requiere una conexión a internet. Por favor, conéctate e inténtalo de nuevo.',
        recordingTooShortError: 'La grabación es demasiado corta para analizar. Graba durante al menos 2 segundos.',
        transcriptHeader: '📋 Transcripción',
        summaryHeader: '✨ Resumen Clave',
        actionItemsHeader: '📌 Puntos de Acción',
        noTranscript: 'No se pudo extraer la transcripción.',
        noSummary: 'No se pudo extraer el resumen.',
        takeAction: 'Tomar Acción ✨',
        noActionDetermined: 'No se pudo determinar una acción específica para este item. Puedes gestionarlo manualmente.',
        createCalendarEvent: 'Crear Evento en Google Calendar',
        titleLabel: 'Título:',
        descriptionLabel: 'Descripción:',
        dateLabel: 'Fecha:',
        timeLabel: 'Hora:',
        openInCalendar: 'Abrir en Google Calendar',
        draftEmail: 'Redactar Correo',
        toLabel: 'Para:',
        subjectLabel: 'Asunto:',
        bodyLabel: 'Cuerpo:',
        openInEmailApp: 'Abrir en App de Correo',
        draftInvoiceEmail: 'Redactar Correo de Factura',
        recipientNameLabel: 'Nombre del Destinatario:',
        amountLabel: 'Monto:',
        invoiceEmailBody: 'Hola {recipientName},\n\nEsta es una factura por el siguiente concepto:\n- {itemDescription}\n\nMonto a pagar: {currencySymbol}{amount}\n\nPor favor, avísame si tienes alguna pregunta.\n\nSaludos,\n{userName}',
        initiatePhoneCall: 'Iniciar Llamada',
        phoneNumberLabel: 'Número de Teléfono:',
        reasonLabel: 'Motivo:',
        callNow: 'Llamar Ahora',
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
        renameSpeakerPrompt: 'Ingresa el nuevo nombre para',
        footerText: 'Para Uso Exclusivo del Impactory Institute',
        recentSessions: 'Sesiones Recientes',
        welcomeMessage: 'Bienvenido a Verbatim',
        welcomeSubtext: 'Tus sesiones grabadas aparecerán aquí. Toca el micrófono para empezar.',
        deleteSession: '¿Eliminar Sesión?',
        deleteConfirmation: '¿Estás seguro de que quieres eliminar esta sesión? Esta acción no se puede deshacer.',
        searchPlaceholder: 'Buscar sesiones...',
        toggleMiniView: 'Picture-in-Picture',
        keepAwake: 'Mantener Pantalla Activa',
        keepAwakeInfo: 'Evita que la pantalla se apague durante una sesión de grabación.',
        backToList: 'Volver a Sesiones',
        recordPhoneCallTitle: '¿Grabando una llamada?',
        recordPhoneCallInstruction: 'Para la mejor calidad, conecta tus auriculares. También puedes usar el altavoz de tu teléfono. Toca el botón de grabar para empezar.',
        selectAudioDeviceTitle: 'Seleccionar Fuente de Audio',
        selectAudioDeviceInstruction: 'Elige el micrófono que quieres usar para la grabación.',
        start: 'Iniciar',
        cancel: 'Cancelar',
        analysisPrompt: 'Eres un asistente de reuniones multilingüe experto. El idioma preferido del usuario es español. Analiza el siguiente audio de la reunión, que puede contener varios idiomas hablados. Tu tarea es procesar este audio multilingüe y generar todos los resultados exclusivamente en español. Proporciona un resumen conciso, una lista de puntos de acción y una transcripción completa con etiquetas de orador (por ejemplo, Orador 1, Orador 2). En el resumen, presta especial atención y enumera claramente cualquier cifra financiera, presupuesto o costo mencionado. Identifica a todos los oradores únicos. Todo el texto de salida (resumen, puntos de acción, transcripción) DEBE ser traducido y escrito en español. Formatea la salida como un objeto JSON con las claves: "summary", "actionItems" (un array de strings), "transcript" (un string con saltos de línea y etiquetas de orador), y "speakers" (un array de etiquetas de oradores identificados como ["Orador 1", "Orador 2"]). No incluyas el envoltorio de markdown JSON.',
        actionPrompt: 'Eres un asistente inteligente. Basado en el contexto completo de una reunión y un punto de acción específico, llama a la herramienta más apropiada para ayudar al usuario a completarlo. El idioma del usuario es español. Título de la reunión: "{meetingTitle}". Fecha de la reunión: "{meetingDate}". Resumen de la reunión: "{meetingSummary}". Punto de acción: "{actionItemText}". Asegúrate de que todo el contenido generado, como asuntos de correo o descripciones de eventos, sea relevante para el contexto de la reunión.',
        featureShowcase: 'Funcionalidades de Verbatim',
        createdBy: 'Creado por',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: 'Dedicado con amor a mi familia, a todas las mamás ocupadas y al creador. ❤️',
        featureList: [
            'Análisis IA Multilingüe',
            'Resumen y Puntos de Acción Automáticos',
            'Transcripción Completa con Oradores',
            'Acciones de Un Clic (Calendar, Gmail, Docs)',
            'Exportar y Copiar en Markdown',
            'Mini Vista Picture-in-Picture',
            'Funcionalidad PWA Offline',
            'Selección de Fuente de Audio',
        ],
        loginTitle: 'Bienvenido a Verbatim',
        loginSubtitle: 'Inicia sesión con Google para guardar y gestionar tus sesiones.',
        signIn: 'Iniciar Sesión',
        faqLink: 'Preguntas Frecuentes',
        faqTitle: 'Preguntas Frecuentes',
        logout: 'Cerrar Sesión',
        faq: [
             {
                q: '¿Qué hay de nuevo en esta versión (Beta v1.3)?',
                a: 'Esta versión mejora la inteligencia de la IA, particularly en temas financieros. La IA ahora identifica y resalta mejor las cifras monetarias en el resumen. También introduce una nueva acción de un clic "Redactar Factura" para tareas relevantes, haciendo los seguimientos financieros más rápidos y fáciles.',
            },
            {
                q: '¿Cómo maneja la aplicación las discusiones sobre dinero?',
                a: 'La IA está entrenada para reconocer conversaciones que involucran finanzas. Resaltará automáticamente cualquier cifra específica, presupuesto o costo mencionado durante la reunión en la sección "Resumen Clave". Si un punto de acción implica facturar a un cliente (por ejemplo, "Enviar una factura al Cliente X por $500"), el botón "Tomar Acción" ofrecerá redactar un correo de factura por ti, rellenando previamente el destinatario, el monto y la descripción.',
            },
            {
                q: '¿Cómo inicio una nueva grabación?',
                a: 'Toca el botón grande del micrófono en la pestaña "Grabar". Si es tu primera vez, se te pedirá que inicies sesión con Google. Después de iniciar sesión, elige tu micrófono y haz clic en "Iniciar" para comenzar a grabar.',
            },
            {
                q: '¿Puede Verbatim entender diferentes idiomas en la misma reunión?',
                a: '¡Sí! Verbatim está impulsado por una IA multilingüe que puede procesar audio que contiene múltiples idiomas. Todos los resultados finales, incluyendo el resumen, los puntos de acción y la transcripción, serán traducidos y presentados en el idioma predeterminado de tu navegador (inglés, español o chino).',
            },
            {
                q: '¿Cómo se identifican los oradores y puedo cambiar sus nombres?',
                a: 'La IA distingue automáticamente entre diferentes oradores y los etiqueta como "Orador 1", etc. Después del análisis, haz clic en el ícono del lápiz (✏️) junto al nombre de un orador. El nombre se convierte en un campo editable. Escribe el nuevo nombre y presiona Enter o haz clic fuera para guardar. Esto actualiza el nombre en toda la transcripción.',
            },
            {
                q: '¿Qué son las "Acciones de Un Clic"?',
                a: 'Para cada punto de acción identificado por la IA, puedes hacer clic en el botón "Tomar Acción ✨". La IA determinará la mejor herramienta para la tarea (como crear un evento de calendario, redactar un correo electrónico o iniciar un documento) y rellenará previamente la información necesaria por ti.',
            },
            {
                q: '¿Cómo puedo usar los controles de grabación mientras estoy en otra ventana?',
                a: 'Mientras grabas en un navegador de escritorio, haz clic en el botón "Activar Mini Vista". Esto abrirá una pequeña ventana Picture-in-Picture con un temporizador y un botón de "Detener", que permanece encima de tus otras ventanas para que puedas controlar fácilmente la grabación.',
            },
            {
                q: '¿La aplicación funciona sin conexión?',
                a: 'Sí. Verbatim es una Aplicación Web Progresiva (PWA). Después de tu primera visita, puedes instalarla en tu dispositivo para una experiencia similar a la de una aplicación. Puedes ver sesiones pasadas incluso sin conexión a internet. Sin embargo, analizar una nueva grabación requiere una conexión a internet para comunicarse con la IA.',
            },
            {
                q: '¿Dónde se almacenan mis datos?',
                a: 'La información de tu cuenta y todos los datos de la sesión se almacenan en una base de datos simulada en la nube que utiliza el almacenamiento local de tu navegador para persistencia. Esto te permite acceder a tus datos a través de las actualizaciones del navegador. Ningún dato se envía o almacena en ningún servidor externo, excepto el procesamiento temporal del audio por la API de Gemini durante el análisis.',
            },
        ],
        sessions: 'Sesiones',
        record: 'Grabar',
        recording: 'Grabando...',
        tapToRecord: 'Toca para empezar a grabar',
    },
    'zh-CN': {
        title: 'Verbatim',
        subtitle: '您的智能会议仪表板。',
        welcomeUser: '欢迎，{name}',
        startRecording: '🎤 新建会话',
        stopRecording: '⏹️ 停止',
        analyzing: '分析中...',
        micPermissionError: '无法开始录音。请授予麦克风权限。',
        processingError: '处理音频失败。这可能是由于网络连接不佳、录音时间太短或音频无声。请重试。',
        offlineError: '分析需要互联网连接。请连接后重试。',
        recordingTooShortError: '录音太短，无法分析。请录制至少2秒。',
        transcriptHeader: '📋 文本记录',
        summaryHeader: '✨ 关键摘要',
        actionItemsHeader: '📌 行动项',
        noTranscript: '无法提取文本记录。',
        noSummary: '无法提取摘要。',
        takeAction: '采取行动 ✨',
        noActionDetermined: '无法确定此项目的具体行动。您可以手动处理。',
        createCalendarEvent: '创建谷歌日历事件',
        titleLabel: '标题:',
        descriptionLabel: '描述:',
        dateLabel: '日期:',
        timeLabel: '时间:',
        openInCalendar: '在谷歌日历中打开',
        draftEmail: '起草电子邮件',
        toLabel: '收件人:',
        subjectLabel: '主题:',
        bodyLabel: '正文:',
        openInEmailApp: '在电子邮件应用中打开',
        draftInvoiceEmail: '起草发票邮件',
        recipientNameLabel: '收件人姓名:',
        amountLabel: '金额:',
        invoiceEmailBody: '您好 {recipientName}，\n\n这是一张关于以下项目的发票：\n- {itemDescription}\n\n应付金额：{currencySymbol}{amount}\n\n如果您有任何问题，请随时告诉我。\n\n顺祝商祺，\n{userName}',
        initiatePhoneCall: '发起电话呼叫',
        phoneNumberLabel: '电话号码:',
        reasonLabel: '事由:',
        callNow: '立即呼叫',
        createDocument: '创建谷歌文档',
        createDocInfo: '将打开一个新标签页来创建谷歌文档。下面的内容将被复制到您的剪贴板以便粘贴。',
        suggestedTitle: '建议标题:',
        suggestedContent: '建议内容:',
        openGoogleDocs: '打开谷歌文档并复制内容',
        unknownAction: '未知操作',
        actionError: '确定操作时发生错误。请重试。',
        exportResults: '导出结果',
        copyMarkdown: '复制为 Markdown',
        downloadMarkdown: '下载为 .md',
        copiedSuccess: '已复制到剪贴板！',
        meetingTitle: '会议纪要',
        meetingLocation: '地点:',
        locationUnavailable: '地点不可用',
        gettingLocation: '正在获取地点...',
        speakersHeader: '🗣️ 发言人',
        renameSpeakerPrompt: '为...输入新名称',
        footerText: '仅供 Impactory Institute 使用',
        recentSessions: '最近的会话',
        welcomeMessage: '欢迎使用 Verbatim',
        welcomeSubtext: '您录制的会话将出现在这里。点击麦克风开始。',
        deleteSession: '删除会话？',
        deleteConfirmation: '您确定要删除此会话吗？此操作无法撤销。',
        searchPlaceholder: '搜索会话...',
        toggleMiniView: '画中画',
        keepAwake: '保持屏幕常亮',
        keepAwakeInfo: '在录音会话期间防止屏幕关闭。',
        backToList: '返回会话列表',
        recordPhoneCallTitle: '正在录制电话通话？',
        recordPhoneCallInstruction: '为获得最佳音质，请连接耳机。您也可以使用手机的扬声器。点击录音按钮开始。',
        selectAudioDeviceTitle: '选择音频源',
        selectAudioDeviceInstruction: '选择您想用于录音的麦克风。',
        start: '开始',
        cancel: '取消',
        analysisPrompt: '你是一位专业的多语言会议助理。用户的首选语言是中文。请分析以下可能包含多种口语的会议音频。你的任务是处理这个多语言音频，并只用中文生成所有输出。提供一个简洁的摘要，一个行动项目列表，以及一个带有发言者标签（例如，发言人1，发言人2）的完整文字记录。在摘要中，要特别注意并清楚地列出任何提到的财务数字、预算或成本。识别所有独特的发言者。所有输出文本（摘要、行动项目、文字记录）必须翻译成中文书写。将输出格式化为一个JSON对象，键为："summary"、"actionItems"（字符串数组）、"transcript"（带有换行符和发言者标签的字符串）和 "speakers"（已识别的发言者标签数组，如["发言人1", "发言人2"]）。不要包含JSON markdown包装。',
        actionPrompt: '你是一个智能助理。根据会议的全部背景和一个具体的行动项目，调用最合适的工具来帮助用户完成它。用户的语言是中文。会议标题：“{meetingTitle}”。会议日期：“{meetingDate}”。会议摘要：“{meetingSummary}”。行动项目：“{actionItemText}”。确保所有生成的内容，如电子邮件主题或事件描述，都与会议背景相关。',
        featureShowcase: 'Verbatim 功能',
        createdBy: '创建者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: ' lovingly dedicated to my family, all the busy moms out there, and the creator. ❤️',
        featureList: [
            '多语言 AI 分析',
            '自动摘要和行动项',
            '带发言人标签的完整转录',
            '一键操作（日历、Gmail、文档）',
            'Markdown 导出和复制',
            '画中画迷你视图',
            '离线 PWA 功能',
            '音频源选择',
        ],
        loginTitle: '欢迎使用 Verbatim',
        loginSubtitle: '使用 Google 登录以保存和管理您的会话。',
        signIn: '登录',
        faqLink: '常见问题',
        faqTitle: '常见问题解答',
        logout: '登出',
        faq: [
             {
                q: '这个版本（Beta v1.3）有什么新功能？',
                a: '此版本增强了AI的智能，特别是在财务主题方面。AI现在能更好地识别和突出摘要中的货币数字。它还针对相关任务引入了新的“起草发票”一键操作，使财务后续工作更快更容易。',
            },
            {
                q: '该应用程序如何处理关于金钱的讨论？',
                a: 'AI经过训练，能够识别涉及财务的对话。它会自动在“关键摘要”部分突出显示会议期间提到的任何具体数字、预算或成本。如果一个行动项目涉及向客户开具账单（例如，“向客户X发送一张500美元的发票”），“采取行动”按钮将为您提供起草发票邮件的选项，预先填写收件人、金额和描述。',
            },
            {
                q: '我如何开始新的录音？',
                a: '在“录制”选项卡上点击大的麦克风按钮。如果是您第一次使用，系统会提示您使用Google登录。登录后，选择您的麦克风并点击“开始”即可开始录音。',
            },
            {
                q: 'Verbatim 能在同一次会议中理解不同的语言吗？',
                a: '是的！Verbatim 由一个多语言AI驱动，可以处理包含多种语言的音频。所有最终输出，包括摘要、行动项目和文字记录，都将被翻译并以您浏览器的默认语言（英语、西班牙语或中文）呈现。',
            },
            {
                q: '发言者是如何被识别的，我可以更改他们的名字吗？',
                a: 'AI会自动区分不同的发言者，并将他们标记为“发言人1”等。分析后，点击发言者姓名旁边的铅笔图标（✏️）。姓名将变为可编辑字段。输入新名称后按Enter键或点击别处即可保存。这会更新整个文字记录中的姓名。',
            },
            {
                q: '什么是“一键操作”？',
                a: '对于AI识别的每个行动项目，您可以点击“采取行动 ✨”按钮。AI将确定任务的最佳工具（如创建日历事件、起草电子邮件或启动文档），并为您预填必要的信息。',
            },
            {
                q: '在另一个窗口中时，我如何使用录音控制？',
                a: '在桌面浏览器上录音时，点击“切换迷你视图”按钮。这将打开一个小的画中画窗口，带有一个计时器和一个“停止”按钮，它会停留在您其他窗口的顶部，以便您可以轻松控制录音。',
            },
            {
                q: '该应用可以离线工作吗？',
                a: '是的。Verbatim 是一个渐进式网络应用（PWA）。首次访问后，您可以将其安装在您的设备上，以获得类似应用的体验。即使没有互联网连接，您也可以查看过去的会话。但是，分析新的录音需要互联网连接才能与AI通信。',
            },
            {
                q: '我的数据存储在哪里？',
                a: '您的帐户信息和所有会话数据都存储在一个模拟的云数据库中，该数据库使用您浏览器的本地存储来实现持久性。这使您可以在浏览器刷新后访问您的数据。除了在分析期间由Gemini API临时处理音频外，不会将任何数据发送到或存储在任何外部服务器上。',
            },
        ],
        sessions: '会话',
        record: '录制',
        recording: '录音中...',
        tapToRecord: '点击开始录音',
    },
    'zh-TW': {
        title: 'Verbatim',
        subtitle: '您的智能會議儀表板。',
        welcomeUser: '歡迎，{name}',
        startRecording: '🎤 新增會話',
        stopRecording: '⏹️ 停止',
        analyzing: '分析中...',
        micPermissionError: '無法開始錄音。請授予麥克風權限。',
        processingError: '處理音訊失敗。這可能是由於網路連線不佳、錄音時間太短或音訊無聲。請重試。',
        offlineError: '分析需要網路連線。請連線後重試。',
        recordingTooShortError: '錄音太短，無法分析。請錄製至少2秒。',
        transcriptHeader: '📋 文字記錄',
        summaryHeader: '✨ 關鍵摘要',
        actionItemsHeader: '📌 行動項',
        noTranscript: '無法擷取文字記錄。',
        noSummary: '無法擷取摘要。',
        takeAction: '採取行動 ✨',
        noActionDetermined: '無法確定此項目的具體行動。您可以手動處理。',
        createCalendarEvent: '建立 Google 日曆活動',
        titleLabel: '標題:',
        descriptionLabel: '描述:',
        dateLabel: '日期:',
        timeLabel: '時間:',
        openInCalendar: '在 Google 日曆中開啟',
        draftEmail: '草擬電子郵件',
        toLabel: '收件人:',
        subjectLabel: '主旨:',
        bodyLabel: '內文:',
        openInEmailApp: '在電子郵件應用程式中開啟',
        draftInvoiceEmail: '草擬發票郵件',
        recipientNameLabel: '收件人姓名:',
        amountLabel: '金額:',
        invoiceEmailBody: '您好 {recipientName}，\n\n這是一張關於以下項目的發票：\n- {itemDescription}\n\n應付金額：{currencySymbol}{amount}\n\n如果您有任何問題，請隨時告訴我。\n\n順頌商祺，\n{userName}',
        initiatePhoneCall: '發起電話通話',
        phoneNumberLabel: '電話號碼:',
        reasonLabel: '事由:',
        callNow: '立即通話',
        createDocument: '建立 Google 文件',
        createDocInfo: '將開啟一個新分頁來建立 Google 文件。下面的內容將被複製到您的剪貼簿以便貼上。',
        suggestedTitle: '建議標題:',
        suggestedContent: '建議內容:',
        openGoogleDocs: '開啟 Google 文件並複製內容',
        unknownAction: '未知操作',
        actionError: '確定操作時發生錯誤。請重試。',
        exportResults: '匯出結果',
        copyMarkdown: '複製為 Markdown',
        downloadMarkdown: '下載為 .md',
        copiedSuccess: '已複製到剪貼簿！',
        meetingTitle: '會議記錄',
        meetingLocation: '地點:',
        locationUnavailable: '地點不可用',
        gettingLocation: '正在取得地點...',
        speakersHeader: '🗣️ 發言人',
        renameSpeakerPrompt: '為...輸入新名稱',
        footerText: '僅供 Impactory Institute 使用',
        recentSessions: '最近的會話',
        welcomeMessage: '歡迎使用 Verbatim',
        welcomeSubtext: '您錄製的會話將出現在這裡。點擊麥克風開始。',
        deleteSession: '刪除會話？',
        deleteConfirmation: '您確定要刪除此會話嗎？此操作無法復原。',
        searchPlaceholder: '搜尋會話...',
        toggleMiniView: '子母畫面',
        keepAwake: '保持螢幕喚醒',
        keepAwakeInfo: '在錄音會話期間防止螢幕關閉。',
        backToList: '返回會話列表',
        recordPhoneCallTitle: '正在錄製電話通話？',
        recordPhoneCallInstruction: '為獲得最佳音質，請連接耳機。您也可以使用手機的擴音器。點擊錄音按鈕開始。',
        selectAudioDeviceTitle: '選擇音訊來源',
        selectAudioDeviceInstruction: '選擇您想用於錄音的麥克風。',
        start: '開始',
        cancel: '取消',
        analysisPrompt: '你是一位專業的多語言會議助理。使用者的首選語言是繁體中文。請分析以下可能包含多種口語的會議音訊。你的任務是處理這個多語言音訊，並只用繁體中文產生所有輸出。提供一個簡潔的摘要，一個行動項目列表，以及一個帶有發言者標籤（例如，發言人1，發言人2）的完整文字記錄。在摘要中，要特別注意並清楚地列出任何提到的財務數字、預算或成本。識別所有獨特的發言者。所有輸出文本（摘要、行動項目、文字記錄）必須翻譯成繁體中文書寫。將輸出格式化為一個JSON對象，鍵為："summary"、"actionItems"（字串陣列）、"transcript"（帶有換行符和發言者標籤的字串）和 "speakers"（已識別的發言者標籤陣列，如["發言人1", "發言人2"]）。不要包含JSON markdown包裝。',
        actionPrompt: '你是一個智能助理。根據會議的全部背景和一個具體的行動項目，呼叫最合適的工具來幫助使用者完成它。使用者的語言是繁體中文。會議標題：「{meetingTitle}」。會議日期：「{meetingDate}」。會議摘要：「{meetingSummary}」。行動項目：「{actionItemText}」。確保所有生成的內容，如電子郵件主旨或活動描述，都與會議背景相關。',
        featureShowcase: 'Verbatim 功能',
        createdBy: '建立者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: ' lovingly dedicated to my family, all the busy moms out there, and the creator. ❤️',
        featureList: [
            '多語言 AI 分析',
            '自動摘要和行動項',
            '帶發言人標籤的完整轉錄',
            '一鍵操作（日曆、Gmail、文件）',
            'Markdown 匯出和複製',
            '子母畫面迷你視圖',
            '離線 PWA 功能',
            '音訊來源選擇',
        ],
        loginTitle: '歡迎使用 Verbatim',
        loginSubtitle: '使用 Google 登入以儲存和管理您的會話。',
        signIn: '登入',
        faqLink: '常見問題',
        faqTitle: '常見問題解答',
        logout: '登出',
        faq: [
             {
                q: '這個版本（Beta v1.3）有什麼新功能？',
                a: '此版本增強了AI的智能，特別是在財務主題方面。AI現在能更好地識別和突顯摘要中的貨幣數字。它還針對相關任務引入了新的“草擬發票”一鍵操作，使財務後續工作更快更容易。',
            },
            {
                q: '該應用程式如何處理關於金錢的討論？',
                a: 'AI經過訓練，能夠識別涉及財務的對話。它會自動在“關鍵摘要”部分突顯會議期間提到的任何具體數字、預算或成本。如果一個行動項目涉及向客戶開具帳單（例如，“向客戶X發送一張500美元的發票”），“採取行動”按鈕將為您提供草擬發票郵件的選項，預先填寫收件人、金額和描述。',
            },
            {
                q: '我如何開始新的錄音？',
                a: '在“錄製”選項卡上點擊大的麥克風按鈕。如果是您第一次使用，系統會提示您使用Google登入。登入後，選擇您的麥克風並點擊“開始”即可開始錄音。',
            },
            {
                q: 'Verbatim 能在同一次會議中理解不同的語言嗎？',
                a: '是的！Verbatim 由一個多語言AI驅動，可以處理包含多種語言的音訊。所有最終輸出，包括摘要、行動項目和文字記錄，都將被翻譯並以您瀏覽器的預設語言（英語、西班牙語或中文）呈現。',
            },
            {
                q: '發言者是如何被識別的，我可以更改他們的名字嗎？',
                a: 'AI會自動區分不同的發言者，並將他們標記為“發言人1”等。分析後，點擊發言者姓名旁邊的鉛筆圖示（✏️）。姓名將變為可編輯欄位。輸入新名稱後按Enter鍵或點擊別處即可儲存。這會更新整個文字記錄中的姓名。',
            },
            {
                q: '什麼是“一鍵操作”？',
                a: '對於AI識別的每個行動項目，您可以點擊“採取行動 ✨”按鈕。AI將確定任務的最佳工具（如建立日曆活動、草擬電子郵件或啟動文件），並為您預填必要的資訊。',
            },
            {
                q: '在另一個視窗中時，我如何使用錄音控制？',
                a: '在桌面瀏覽器上錄音時，點擊“切換迷你視圖”按鈕。這將開啟一個小的子母畫面視窗，帶有一個計時器和一個“停止”按鈕，它會停留在您其他視窗的頂部，以便您可以輕鬆控制錄音。',
            },
            {
                q: '該應用程式可以離線工作嗎？',
                a: '是的。Verbatim 是一個漸進式網路應用程式（PWA）。首次造訪後，您可以將其安裝在您的裝置上，以獲得類似應用程式的體驗。即使沒有網路連線，您也可以查看過去的會話。但是，分析新的錄音需要網路連線才能與AI通訊。',
            },
            {
                q: '我的資料儲存在哪裡？',
                a: '您的帳戶資訊和所有會話資料都儲存在一個模擬的雲端資料庫中，該資料庫使用您瀏覽器的本機儲存來實現持久性。這使您可以在瀏覽器重新整理後存取您的資料。除了在分析期間由Gemini API臨時處理音訊外，不會將任何資料傳送到或儲存在任何外部伺服器上。',
            },
        ],
        sessions: '會話',
        record: '錄製',
        recording: '錄音中...',
        tapToRecord: '點擊開始錄音',
    }
};

// FIX: Add types for translations to improve type safety and inference.
type EnglishTranslations = typeof translations['en'];
type TranslationKey = keyof EnglishTranslations;

const getBrowserLanguage = (): Language => {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('zh-cn')) return 'zh-CN';
    if (lang.startsWith('zh')) return 'zh-TW';
    return 'en';
};

const language = getBrowserLanguage();
// FIX: Make the getTranslator function generic to ensure type-safe return values based on the translation key.
const getTranslator = (lang: Language) => <K extends TranslationKey>(key: K, replacements?: { [key: string]: string }): EnglishTranslations[K] => {
    const translation = (translations[lang] as any)[key] || translations.en[key];

    if (replacements && typeof translation === 'string') {
        let replaced = translation;
        Object.entries(replacements).forEach(([rKey, value]) => {
            replaced = replaced.replace(`{${rKey}}`, value);
        });
        return replaced as EnglishTranslations[K];
    }
    return translation;
};
const t = getTranslator(language);

// --- Helper Functions ---
const getPlatform = (): Platform => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
    if (/mac/i.test(ua)) return 'macos';
    if (/windows/i.test(ua)) return 'windows';
    return 'unknown';
};

const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);
    return matches;
};


const styles: { [key: string]: CSSProperties } = {
    // ... A large collection of shared styles ...
    app: {
        fontFamily: "'Poppins', sans-serif",
        backgroundColor: '#0D0D0D',
        color: '#FFFFFF',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        backgroundColor: '#1A1A1A',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #333',
    },
    logo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        textDecoration: 'none',
        color: 'white',
        transition: 'transform 0.2s ease-in-out',
    },
    logoImage: {
        height: '40px',
        width: '40px'
    },
    logoText: {
        fontSize: '1.5rem',
        fontWeight: 'bold'
    },
    userProfile: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    userImage: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
    },
    logoutButton: {
        background: 'none',
        border: '1px solid #555',
        color: '#ccc',
        padding: '8px 16px',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        transition: 'background-color 0.2s, color 0.2s',
    },
    mainContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Contain swipeable view
    },
    footer: {
        backgroundColor: '#1A1A1A',
        color: '#888',
        textAlign: 'center',
        padding: '12px',
        fontSize: '0.8rem',
        borderTop: '1px solid #333',
    },
    button: {
        backgroundColor: '#00A99D',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    // ... more styles
};

// --- Logo Component ---
const Logo = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        <defs>
            <linearGradient id="v_grad" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop stopColor="#00D9C8"/>
                <stop offset="1" stopColor="#00A99D"/>
            </linearGradient>
        </defs>
        <path d="M54 32C54 44.1503 44.1503 54 32 54C19.8497 54 10 44.1503 10 32C10 19.8497 19.8497 10 32 10C38.3995 10 44.2255 12.6106 48.4853 16.8704" stroke="url(#v_grad)" strokeWidth="8" strokeLinecap="round"/>
        <path d="M22 32L32 42L52 22" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


// --- Main Application ---
const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [postLoginAction, setPostLoginAction] = useState<PostLoginAction | null>(null);

    // States from former MainApp
    const [isRecording, setIsRecording] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [actionModalData, setActionModalData] = useState<ActionModalData | null>(null);
    const [faqModalOpen, setFaqModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [isPiP, setIsPiP] = useState(false);
    const [keepScreenAwake, setKeepScreenAwake] = useState(false);
    const [audioDeviceModalOpen, setAudioDeviceModalOpen] = useState(false);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
    const [isLogoHovered, setIsLogoHovered] = useState(false);
    const isMobile = useMediaQuery('(max-width: 768px)');


    // Swipe navigation state
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchMoveX, setTouchMoveX] = useState<number | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const pipWindowRef = useRef<Window | null>(null);
    const recordingTimerRef = useRef<number | null>(null);
    const recordingTimeRef = useRef(0);
    const wakeLockRef = useRef<any>(null);
    const channel = useRef(new BroadcastChannel('verbatim_pip_channel')).current;

    useEffect(() => {
        const checkUser = async () => {
            const existingUser = await dbService.getUser();
            setUser(existingUser);
            setIsLoading(false);
        };
        checkUser();
    }, []);

    useEffect(() => {
        if (user) {
            dbService.getSessions(user.id).then(setSessions);
        } else {
            setSessions([]);
        }
    }, [user]);

    const handleLoginSuccess = async (loggedInUser: User) => {
        await dbService.saveUser(loggedInUser);
        setUser(loggedInUser);
        setIsLoginModalOpen(false);

        if (postLoginAction === 'record') {
            openAudioDeviceModal();
        } else if (postLoginAction === 'sessions') {
            setActiveTab('sessions');
        }
        setPostLoginAction(null);
    };

    const handleLogout = async () => {
        await dbService.logout();
        setUser(null);
        setActiveSession(null);
        setActiveTab('record');
        if (window.google) {
            window.google.accounts.id.disableAutoSelect();
        }
    };
    
    const handleStartRecordingRequest = () => {
        if (user) {
            openAudioDeviceModal();
        } else {
            setPostLoginAction('record');
            setIsLoginModalOpen(true);
        }
    };
    
    const handleTabClick = (tab: ActiveTab) => {
        if (tab === 'sessions' && !user) {
            setPostLoginAction('sessions');
            setIsLoginModalOpen(true);
        } else {
            setActiveTab(tab);
        }
    };

    // Swipe navigation handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setTouchStartX(e.touches[0].clientX);
            setTouchMoveX(null);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX !== null && e.touches.length === 1) {
            setTouchMoveX(e.touches[0].clientX);
        }
    };

    const handleTouchEnd = () => {
        if (touchStartX && touchMoveX) {
            const deltaX = touchMoveX - touchStartX;
            const swipeThreshold = 50;

            if (deltaX < -swipeThreshold && activeTab === 'record') {
                handleTabClick('sessions');
            } else if (deltaX > swipeThreshold && activeTab === 'sessions') {
                handleTabClick('record');
            }
        }
        setTouchStartX(null);
        setTouchMoveX(null);
    };

    // All other functions from MainApp are moved here
    useEffect(() => {
        const handlePipMessage = (event: MessageEvent) => {
            if (event.data.type === 'stop_recording') {
                stopRecording();
            } else if (event.data.type === 'pip_ready') {
                 channel.postMessage({ type: 'state_update', isRecording: isRecording, recordingTime: recordingTimeRef.current });
            }
        };
        channel.addEventListener('message', handlePipMessage);
        return () => channel.removeEventListener('message', handlePipMessage);
    }, [isRecording]);

    useEffect(() => {
        if (isRecording) {
            recordingTimerRef.current = window.setInterval(() => {
                recordingTimeRef.current += 1;
                if (pipWindowRef.current && !pipWindowRef.current.closed) {
                     channel.postMessage({ type: 'time_update', time: recordingTimeRef.current });
                }
            }, 1000);
        } else {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
            recordingTimeRef.current = 0;
        }
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, [isRecording, channel]);

    const toggleKeepAwake = async () => {
        if (!keepScreenAwake) {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    setKeepScreenAwake(true);
                    console.log('Screen Wake Lock is active.');
                } else {
                    console.warn('Screen Wake Lock API not supported.');
                }
            } catch (err: any) {
                console.error(`${err.name}, ${err.message}`);
            }
        } else {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                setKeepScreenAwake(false);
                console.log('Screen Wake Lock released.');
            }
        }
    };

    const openAudioDeviceModal = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
            setAudioDeviceModalOpen(true);
        } catch (err) {
            console.error("Error enumerating audio devices:", err);
            setErrorMessage(t('micPermissionError'));
        }
    };

    const startRecording = async () => {
        setErrorMessage('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined } });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = processAudio;
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setAudioDeviceModalOpen(false);
            if (keepScreenAwake && !wakeLockRef.current) {
                toggleKeepAwake();
            }
        } catch (err) {
            console.error('Error starting recording:', err);
            setErrorMessage(t('micPermissionError'));
            setAudioDeviceModalOpen(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (wakeLockRef.current) {
                toggleKeepAwake();
            }
            if(pipWindowRef.current && !pipWindowRef.current.closed) {
                pipWindowRef.current.close();
                pipWindowRef.current = null;
            }
            setIsPiP(false);
        }
    };

    const processAudio = async () => {
        if (!user) return;
        if (recordingTimeRef.current < 2) {
            setErrorMessage(t('recordingTooShortError'));
            return;
        }
        setIsAnalyzing(true);
        setErrorMessage('');
        if (!navigator.onLine) {
            setErrorMessage(t('offlineError'));
            setIsAnalyzing(false);
            return;
        }
        try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                const audioPart = { inlineData: { mimeType: 'audio/webm', data: base64Audio } };
                const request = { contents: [{ parts: [audioPart, { text: t('analysisPrompt') }] }] };

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: request.contents,
                });

                const jsonString = response.text.trim();
                const result = JSON.parse(jsonString);
                const locationInfo = await getCurrentLocation();

                const newSession: Session = {
                    id: new Date().toISOString(),
                    metadata: {
                        title: `${t('meetingTitle')} - ${new Date().toLocaleDateString()}`,
                        date: new Date().toISOString(),
                        location: locationInfo.location,
                        mapUrl: locationInfo.mapUrl,
                    },
                    results: {
                        transcript: result.transcript || t('noTranscript'),
                        summary: result.summary || t('noSummary'),
                        actionItems: result.actionItems || [],
                    },
                    speakers: (result.speakers || []).reduce((acc: any, speaker: string) => {
                        acc[speaker] = speaker;
                        return acc;
                    }, {})
                };

                await dbService.saveSession(user.id, newSession);
                setSessions(prev => [newSession, ...prev]);
                setActiveSession(newSession);
                setActiveTab('sessions');
                setIsAnalyzing(false);
            };
        } catch (error) {
            console.error('Error processing audio:', error);
            setErrorMessage(t('processingError'));
            setIsAnalyzing(false);
        }
    };

    const getCurrentLocation = async (): Promise<{ location: string, mapUrl: string }> => {
        return new Promise(resolve => {
            if (!navigator.geolocation) {
                resolve({ location: t('locationUnavailable'), mapUrl: '' });
                return;
            }
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                        const data = await response.json();
                        const location = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                        resolve({ location, mapUrl });
                    } catch (error) {
                        console.error('Reverse geocoding failed:', error);
                        resolve({ location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}` });
                    }
                },
                () => resolve({ location: t('locationUnavailable'), mapUrl: '' }),
                { timeout: 5000 }
            );
        });
    };
    
     const togglePiP = async () => {
        if (isPiP && pipWindowRef.current) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
            setIsPiP(false);
        } else if (isRecording) {
            try {
                const pip = await window.open('/pip.html', 'VerbatimPIP', 'width=350,height=80,popup');
                pipWindowRef.current = pip;
                setIsPiP(true);
                 pip?.addEventListener('beforeunload', () => {
                    setIsPiP(false);
                    pipWindowRef.current = null;
                });
            } catch (error) {
                console.error('Failed to open PiP window:', error);
            }
        }
    };

    const handleRenameSpeaker = async (sessionId: string, speakerId: string, newName: string) => {
        if (!newName.trim() || !user) return;
        const sessionToUpdate = sessions.find(s => s.id === sessionId);
        if (sessionToUpdate) {
            const updatedSpeakers = { ...sessionToUpdate.speakers, [speakerId]: newName.trim() };
            const oldName = sessionToUpdate.speakers[speakerId];
            const updatedTranscript = sessionToUpdate.results.transcript.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName.trim());
            const updatedSession = {
                ...sessionToUpdate,
                speakers: updatedSpeakers,
                results: { ...sessionToUpdate.results, transcript: updatedTranscript }
            };
            await dbService.saveSession(user.id, updatedSession);
            setSessions(sessions.map(s => s.id === sessionId ? updatedSession : s));
            if (activeSession?.id === sessionId) {
                setActiveSession(updatedSession);
            }
        }
        setEditingSpeaker(null);
    };

    const filteredSessions = sessions.filter(session =>
        session.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.results.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.results.transcript.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return <div style={styles.app}><div style={{ margin: 'auto', color: '#888' }}>Loading...</div></div>;
    }

    const swipeOffset = (touchStartX && touchMoveX) ? touchMoveX - touchStartX : 0;
    let constrainedOffset = swipeOffset;

    // Add resistance when swiping beyond the boundaries
    if ((activeTab === 'record' && swipeOffset > 0) || (activeTab === 'sessions' && swipeOffset < 0)) {
        constrainedOffset = Math.tanh(swipeOffset / 300) * 100;
    }

    const isSwiping = touchStartX !== null;
    
    return (
        <div style={{...styles.app, paddingBottom: isMobile ? '80px' : '0' }}>
            <header style={{...styles.header, ...(isMobile && { padding: '12px 16px' })}}>
                <a href="#" 
                   style={{...styles.logo, ...(isLogoHovered && {transform: 'scale(1.05)'})}} 
                   onClick={(e) => { e.preventDefault(); setActiveSession(null); setActiveTab('record'); }}
                   onMouseEnter={() => setIsLogoHovered(true)}
                   onMouseLeave={() => setIsLogoHovered(false)}
                >
                    <Logo style={{...styles.logoImage, ...(isMobile && { height: '32px', width: '32px' })}} />
                    {!isMobile && <h1 style={styles.logoText}>{t('title')}</h1>}
                </a>
                <div style={styles.userProfile}>
                    {user ? (
                        <>
                            {user.picture && <img src={user.picture} alt={user.name} style={{...styles.userImage, ...(isMobile && { height: '32px', width: '32px' })}} />}
                            {!isMobile && <span>{user.name}</span>}
                            <button style={{...styles.logoutButton, ...(isMobile && { padding: '6px 12px', fontSize: '0.8rem' })}} onClick={handleLogout}>{t('logout')}</button>
                        </>
                    ) : (
                        <button style={{...styles.button, ...(isMobile ? {padding: '8px 16px', fontSize: '0.9rem'} : { padding: '10px 20px' })}} onClick={() => setIsLoginModalOpen(true)}>
                            {t('signIn')}
                        </button>
                    )}
                    <button style={{ ...styles.logoutButton, ...(isMobile ? {padding: '6px 10px', fontSize: '0.8rem'} : { padding: '8px', marginLeft: '8px' }) }} onClick={() => setFaqModalOpen(true)} title={t('faqLink')}>?
                    </button>
                </div>
            </header>

            <main style={{...styles.mainContent, padding: isMobile ? '16px' : '24px'}}>
                 {!activeSession && !isMobile && (
                    <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                         <div style={{ flexGrow: 1, maxWidth: '400px' }}>
                             {activeTab === 'sessions' && (
                                <input
                                    type="search"
                                    placeholder={t('searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '10px 16px', borderRadius: '20px', border: '1px solid #444', background: '#2C2C2C', color: 'white' }}
                                />
                             )}
                         </div>
                        <div style={{ display: 'flex', gap: '8px', padding: '4px', background: '#2C2C2C', borderRadius: '24px' }}>
                             {(['record', 'sessions'] as ActiveTab[]).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => handleTabClick(tab)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        border: 'none',
                                        background: activeTab === tab ? '#00A99D' : 'transparent',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}>
                                     {t(tab)}
                                </button>
                             ))}
                        </div>
                    </div>
                 )}
                 
                 {isMobile && !activeSession && activeTab === 'sessions' && (
                     <input
                        type="search"
                        placeholder={t('searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: '20px', border: '1px solid #444', background: '#2C2C2C', color: 'white', marginBottom: '16px', boxSizing: 'border-box' }}
                    />
                 )}
                
                 {activeSession && user ? (
                    <SessionDetail
                        session={activeSession}
                        onBack={() => setActiveSession(null)}
                        onAction={(data) => setActionModalData(data)}
                        user={user}
                        onRenameSpeaker={(speakerId, newName) => handleRenameSpeaker(activeSession.id, speakerId, newName)}
                        editingSpeaker={editingSpeaker}
                        onSetEditingSpeaker={(speakerId) => setEditingSpeaker({ sessionId: activeSession.id, speakerId })}
                        isMobile={isMobile}
                    />
                ) : (
                    <div 
                        style={{ flex: 1, overflow: 'hidden' }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div style={{
                            display: 'flex',
                            width: '200%',
                            height: '100%',
                            transform: `translateX(calc(${activeTab === 'sessions' ? '-50%' : '0%'} + ${constrainedOffset}px))`,
                            transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
                            willChange: 'transform',
                        }}>
                            <div style={{ width: '50%', height: '100%' }}>
                                <Recorder
                                    isRecording={isRecording}
                                    isAnalyzing={isAnalyzing}
                                    onStart={handleStartRecordingRequest}
                                    onStop={stopRecording}
                                    errorMessage={errorMessage}
                                    onTogglePiP={togglePiP}
                                    isPiP={isPiP}
                                    onToggleKeepAwake={toggleKeepAwake}
                                    keepScreenAwake={keepScreenAwake}
                                    isMobile={isMobile}
                                />
                            </div>
                            <div style={{ width: '50%', height: '100%' }}>
                                <SessionsList
                                    sessions={filteredSessions}
                                    onSelectSession={setActiveSession}
                                    onDeleteSession={async (sessionId) => {
                                        if (!user) return;
                                        await dbService.deleteSession(user.id, sessionId);
                                        setSessions(sessions.filter(s => s.id !== sessionId));
                                    }}
                                    isMobile={isMobile}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>
            
            {!activeSession && isMobile && <BottomNavBar activeTab={activeTab} onTabClick={handleTabClick} />}

            <footer style={{...styles.footer, display: isMobile ? 'none' : 'block' }}>
                <p>&copy; {new Date().getFullYear()} Verbatim. {t('footerText')}</p>
            </footer>
            
            {isLoginModalOpen && (
                <LoginModal 
                    onLogin={handleLoginSuccess} 
                    onClose={() => {
                        setIsLoginModalOpen(false);
                        setPostLoginAction(null);
                    }} 
                />
            )}

            {actionModalData && user && (
                <ActionHandlerModal
                    modalData={actionModalData}
                    onClose={() => setActionModalData(null)}
                    user={user}
                    activeSession={activeSession}
                />
            )}
            
            {faqModalOpen && <FAQModal onClose={() => setFaqModalOpen(false)} />}
            
            {audioDeviceModalOpen && (
                <Modal title={t('selectAudioDeviceTitle')} onClose={() => setAudioDeviceModalOpen(false)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p>{t('selectAudioDeviceInstruction')}</p>
                        <select
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            style={{ padding: '10px', borderRadius: '8px', background: '#2C2C2C', color: 'white', border: '1px solid #444' }}
                        >
                            {audioDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button style={{...styles.button, backgroundColor: '#444'}} onClick={() => setAudioDeviceModalOpen(false)}>{t('cancel')}</button>
                            <button style={styles.button} onClick={startRecording}>{t('start')}</button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
};

const LoginModal: React.FC<{ onLogin: (user: User) => void; onClose: () => void; }> = ({ onLogin, onClose }) => {
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCredentialResponse = useCallback(async (response: any) => {
        try {
            const decoded: { sub: string, name: string, email: string, picture: string } = jwtDecode(response.credential);
            const user: User = {
                id: decoded.sub,
                name: decoded.name,
                email: decoded.email,
                picture: decoded.picture,
            };
            onLogin(user);
        } catch (error) {
            console.error("Error decoding credential response:", error);
            setError("Failed to process login. Please try again.");
        }
    }, [onLogin]);


    useEffect(() => {
        const FALLBACK_CLIENT_ID = "450870631577-ecddfl5qeb8rq3bdjhbjnlmckb4tksb6.apps.googleusercontent.com";
        const clientId = process.env.GOOGLE_CLIENT_ID;
        let effectiveClientId = clientId;

        if (!clientId) {
            console.warn(
                "❗ Google Sign-In is using a fallback Client ID. For production, please set the 'GOOGLE_CLIENT_ID' secret in your project."
            );
            effectiveClientId = FALLBACK_CLIENT_ID;
        }

        const initializeGSI = () => {
             if (window.google && googleButtonRef.current) {
                try {
                    window.google.accounts.id.initialize({
                        client_id: effectiveClientId,
                        callback: handleCredentialResponse,
                    });
                    window.google.accounts.id.renderButton(
                        googleButtonRef.current,
                        { theme: 'outline', size: 'large', text: 'continue_with', width: '300' }
                    );
                } catch (e) {
                    console.error("Error initializing Google Sign-In:", e);
                    setError("Failed to initialize Google Sign-In. Please check the console for details.");
                }
            } else {
                 console.error("Google Identity Services script not loaded or button ref not ready.");
                 setError("Could not connect to Google Sign-In service. Please check your internet connection and refresh the page.");
            }
        };

        if (!window.google) {
            const timeout = setTimeout(initializeGSI, 500);
            return () => clearTimeout(timeout);
        } else {
            initializeGSI();
        }

    }, [handleCredentialResponse]);
    
    return (
        <Modal title={t('loginTitle')} onClose={onClose}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <p>{t('loginSubtitle')}</p>
                <div ref={googleButtonRef}></div>
                {error && <p style={{ color: '#ff4d4d' }}>{error}</p>}
            </div>
        </Modal>
    );
};

const BottomNavBar: React.FC<{
    activeTab: ActiveTab;
    onTabClick: (tab: ActiveTab) => void;
}> = ({ activeTab, onTabClick }) => {
    const navStyles: { [key: string]: CSSProperties } = {
        container: {
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            backgroundColor: '#1A1A1A',
            borderTop: '1px solid #333',
            zIndex: 100
        },
        button: {
            flex: 1,
            padding: '12px',
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            borderTop: '3px solid transparent',
        },
        activeButton: {
            color: '#00A99D',
            borderTop: '3px solid #00A99D'
        },
        icon: {
            fontSize: '1.5rem',
        }
    };
    return (
        <nav style={navStyles.container}>
            <button style={{...navStyles.button, ...(activeTab === 'record' && navStyles.activeButton)}} onClick={() => onTabClick('record')}>
                <span style={navStyles.icon}>🎤</span>
                <span>{t('record')}</span>
            </button>
            <button style={{...navStyles.button, ...(activeTab === 'sessions' && navStyles.activeButton)}} onClick={() => onTabClick('sessions')}>
                <span style={navStyles.icon}>📼</span>
                <span>{t('sessions')}</span>
            </button>
        </nav>
    );
};


// ... All other components (Recorder, SessionsList, etc.) go here ...
const Recorder: React.FC<{
    isRecording: boolean;
    isAnalyzing: boolean;
    onStart: () => void;
    onStop: () => void;
    errorMessage: string;
    onTogglePiP: () => void;
    isPiP: boolean;
    onToggleKeepAwake: () => void;
    keepScreenAwake: boolean;
    isMobile: boolean;
}> = ({ isRecording, isAnalyzing, onStart, onStop, errorMessage, onTogglePiP, isPiP, onToggleKeepAwake, keepScreenAwake, isMobile }) => {
    
    const recorderStyles: { [key: string]: CSSProperties } = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            flex: 1,
            gap: '24px',
            height: '100%',
        },
        recordButton: {
            width: isMobile ? '120px' : '150px',
            height: isMobile ? '120px' : '150px',
            borderRadius: '50%',
            border: '5px solid #00A99D',
            backgroundColor: isRecording ? '#dc3545' : '#1A1A1A',
            color: 'white',
            fontSize: isRecording ? '1.5rem' : '4rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: isRecording ? '0 0 20px 5px rgba(220, 53, 69, 0.5)' : '0 0 20px 5px rgba(0, 169, 157, 0.3)',
        },
        statusText: {
            fontSize: '1.2rem',
            fontWeight: 600,
            minHeight: '2rem',
        },
        errorText: {
            color: '#dc3545',
            marginTop: '16px',
        },
        controls: {
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '16px',
            marginTop: '20px',
            alignItems: 'center',
        },
        controlButton: {
            background: '#2C2C2C',
            border: '1px solid #444',
            color: '#eee',
            padding: '10px 16px',
            borderRadius: '20px',
            cursor: 'pointer'
        },
        checkboxContainer: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
        }
    };

    let status;
    if (isAnalyzing) {
        status = t('analyzing');
    } else if (isRecording) {
        status = t('recording');
    } else {
        status = t('tapToRecord');
    }

    return (
        <div style={recorderStyles.container}>
            <button style={recorderStyles.recordButton} onClick={isRecording ? onStop : onStart} disabled={isAnalyzing}>
                {isAnalyzing ? '...' : (isRecording ? '⏹️' : '🎤')}
            </button>
            <p style={recorderStyles.statusText}>{status}</p>
            {errorMessage && <p style={recorderStyles.errorText}>{errorMessage}</p>}
             <div style={recorderStyles.controls}>
                {!isMobile && (
                    <button style={recorderStyles.controlButton} onClick={onTogglePiP} disabled={!isRecording && !isPiP}>
                        {t('toggleMiniView')}
                    </button>
                )}
                 <label style={recorderStyles.checkboxContainer} title={t('keepAwakeInfo')}>
                    <input type="checkbox" checked={keepScreenAwake} onChange={onToggleKeepAwake} />
                    {t('keepAwake')}
                </label>
            </div>
            
            <Accordion title={t('recordPhoneCallTitle')}>
                <p>{t('recordPhoneCallInstruction')}</p>
            </Accordion>
        </div>
    );
};

const SessionsList: React.FC<{
    sessions: Session[];
    onSelectSession: (session: Session) => void;
    onDeleteSession: (sessionId: string) => void;
    isMobile: boolean;
}> = ({ sessions, onSelectSession, onDeleteSession, isMobile }) => {
    
    const listStyles: { [key: string]: CSSProperties } = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            height: '100%',
            overflowY: 'auto',
        },
        emptyState: {
            textAlign: 'center',
            color: '#888',
            margin: 'auto',
        }
    }

    if (sessions.length === 0) {
        return (
            <div style={listStyles.container}>
                <div style={listStyles.emptyState}>
                    <h2>{t('welcomeMessage')}</h2>
                    <p>{t('welcomeSubtext')}</p>
                </div>
            </div>
        );
    }
    
    return (
        <div style={listStyles.container}>
            {sessions.map(session => (
                <SessionItem key={session.id} session={session} onSelect={onSelectSession} onDelete={onDeleteSession} isMobile={isMobile} />
            ))}
        </div>
    );
};

const SessionItem: React.FC<{
    session: Session;
    onSelect: (session: Session) => void;
    onDelete: (sessionId: string) => void;
    isMobile: boolean;
}> = ({ session, onSelect, onDelete, isMobile }) => {
    
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirmDelete) {
            onDelete(session.id);
        } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000); // Reset after 3 seconds
        }
    };
    
    const itemStyles: { [key: string]: CSSProperties } = {
        card: {
            backgroundColor: '#1E1E1E',
            padding: isMobile ? '16px' : '20px',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            border: '1px solid #333',
        },
        title: {
            margin: '0 0 8px 0',
            fontSize: isMobile ? '1.1rem' : '1.2rem',
            fontWeight: 600,
            color: '#00A99D'
        },
        date: {
            margin: '0 0 16px 0',
            fontSize: '0.9rem',
            color: '#888'
        },
        summary: {
            margin: 0,
            color: '#ccc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            fontSize: isMobile ? '0.9rem' : '1rem',
        },
        actions: {
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'flex-end'
        },
        deleteButton: {
            background: confirmDelete ? '#dc3545' : '#444',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'pointer'
        }
    };

    return (
        <div style={itemStyles.card} onClick={() => onSelect(session)} role="button" tabIndex={0}>
            <h3 style={itemStyles.title}>{session.metadata.title}</h3>
            <p style={itemStyles.date}>{new Date(session.metadata.date).toLocaleString()}</p>
            <p style={itemStyles.summary}>{session.results.summary}</p>
             <div style={itemStyles.actions}>
                <button style={itemStyles.deleteButton} onClick={handleDelete}>
                    {confirmDelete ? 'Confirm?' : '🗑️'}
                </button>
            </div>
        </div>
    );
};

const SessionDetail: React.FC<{
    session: Session;
    onBack: () => void;
    onAction: (data: ActionModalData) => void;
    user: User;
    onRenameSpeaker: (speakerId: string, newName: string) => void;
    editingSpeaker: EditingSpeaker | null;
    onSetEditingSpeaker: (speakerId: string) => void;
    isMobile: boolean;
}> = ({ session, onBack, onAction, user, onRenameSpeaker, editingSpeaker, onSetEditingSpeaker, isMobile }) => {

    const [copied, setCopied] = useState(false);

    const formatMarkdown = () => {
        let markdown = `# ${session.metadata.title}\n\n`;
        markdown += `**Date:** ${new Date(session.metadata.date).toLocaleString()}\n`;
        if (session.metadata.location !== t('locationUnavailable')) {
            markdown += `**Location:** [${session.metadata.location}](${session.metadata.mapUrl})\n\n`;
        }
        markdown += `## ${t('summaryHeader')}\n${session.results.summary}\n\n`;
        markdown += `## ${t('actionItemsHeader')}\n`;
        session.results.actionItems.forEach(item => markdown += `- ${item}\n`);
        markdown += `\n## ${t('transcriptHeader')}\n`;
        // Replace speaker labels in transcript for markdown
        let transcriptWithNames = session.results.transcript;
        Object.entries(session.speakers).forEach(([id, name]) => {
             transcriptWithNames = transcriptWithNames.replace(new RegExp(`\\b${id}\\b`, 'g'), name);
        });
        markdown += transcriptWithNames;
        return markdown;
    };

    const copyMarkdown = () => {
        navigator.clipboard.writeText(formatMarkdown());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadMarkdown = () => {
        const blob = new Blob([formatMarkdown()], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.metadata.title.replace(/ /g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const detailStyles: { [key: string]: CSSProperties } = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
        },
        backButton: { background: 'none', border: '1px solid #444', color: 'white', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' },
        exportButtons: { display: 'flex', gap: '12px' },
        metadata: {
            background: '#1E1E1E',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #333'
        },
        speakerTag: {
             background: '#333',
             padding: '4px 8px',
             borderRadius: '4px',
             cursor: 'pointer',
             display: 'inline-flex',
             alignItems: 'center',
             gap: '6px'
        }
    };
    
    return (
        <div style={detailStyles.container}>
            <div style={detailStyles.header}>
                <button style={detailStyles.backButton} onClick={onBack}>&larr; {t('backToList')}</button>
                <div style={detailStyles.exportButtons}>
                    <button style={{...styles.button, ...(isMobile && { padding: '8px 12px', fontSize: '0.9rem' })}} onClick={copyMarkdown}>
                        {copied ? t('copiedSuccess') : t('copyMarkdown')}
                    </button>
                    <button style={{...styles.button, backgroundColor: '#444', ...(isMobile && { padding: '8px 12px', fontSize: '0.9rem' })}} onClick={downloadMarkdown}>{t('downloadMarkdown')}</button>
                </div>
            </div>
            
            <div style={detailStyles.metadata}>
                <h2>{session.metadata.title}</h2>
                <p style={{color: '#888'}}>
                    {new Date(session.metadata.date).toLocaleString()}
                    {session.metadata.location !== t('locationUnavailable') && (
                        <span> | <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer" style={{color: '#00A99D'}}>{t('meetingLocation')} {session.metadata.location}</a></span>
                    )}
                </p>
            </div>

            <Accordion title={t('summaryHeader')} defaultOpen>
                <div dangerouslySetInnerHTML={{ __html: marked(session.results.summary) }} />
            </Accordion>
            
            <Accordion title={t('actionItemsHeader')} defaultOpen>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {session.results.actionItems.map((item, index) => (
                        <li key={index} style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <span style={{flex: 1}}>- {item}</span>
                            <button style={{ ...styles.button, fontSize: '0.9rem', padding: '8px 16px', flexShrink: 0 }} onClick={() => onAction({ type: 'auto', sourceItem: item })}>
                                {t('takeAction')}
                            </button>
                        </li>
                    ))}
                </ul>
            </Accordion>
            
            <Accordion title={t('speakersHeader')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {Object.entries(session.speakers).map(([id, name]) => (
                        <div key={id}>
                            {editingSpeaker?.speakerId === id ? (
                                <input
                                    type="text"
                                    defaultValue={name}
                                    onBlur={(e) => onRenameSpeaker(id, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && onRenameSpeaker(id, (e.target as HTMLInputElement).value)}
                                    autoFocus
                                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #00A99D', background: '#1E1E1E', color: 'white' }}
                                />
                            ) : (
                                <span style={detailStyles.speakerTag} onClick={() => onSetEditingSpeaker(id)}>
                                    {name} <span style={{fontSize: '0.8em'}}>✏️</span>
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </Accordion>

            <Accordion title={t('transcriptHeader')}>
                 <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: marked(
                    Object.entries(session.speakers).reduce((text, [id, name]) => {
                        return text.replace(new RegExp(`\\b${id}\\b:`, 'g'), `**${name}:**`);
                    }, session.results.transcript)
                 )}} />
            </Accordion>
        </div>
    );
};

// ... More components: Modal, Accordion, ActionHandlerModal, FAQModal
const Modal: React.FC<ModalProps> = ({ children, onClose, title }) => {
    
    const modalStyles: { [key: string]: CSSProperties } = {
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        },
        content: {
            backgroundColor: '#1E1E1E',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid #333',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
        },
        title: {
            margin: 0,
            fontSize: '1.4rem'
        },
        closeButton: {
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer'
        }
    };
    
    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.content} onClick={e => e.stopPropagation()}>
                <div style={modalStyles.header}>
                    <h2 style={modalStyles.title}>{title}</h2>
                    <button style={modalStyles.closeButton} onClick={onClose}>&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const Accordion: React.FC<AccordionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    const accordionStyles: { [key: string]: CSSProperties } = {
        container: {
            backgroundColor: '#1E1E1E',
            borderRadius: '8px',
            border: '1px solid #333',
            marginBottom: '16px'
        },
        header: {
            padding: '16px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        title: {
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: 600
        },
        content: {
            padding: '0 16px 16px 16px',
            borderTop: isOpen ? '1px solid #333' : 'none',
        }
    };
    
    return (
        <div style={accordionStyles.container}>
            <div style={accordionStyles.header} onClick={() => setIsOpen(!isOpen)}>
                <h3 style={accordionStyles.title}>{title}</h3>
                <span>{isOpen ? '−' : '+'}</span>
            </div>
            {isOpen && <div style={accordionStyles.content}>{children}</div>}
        </div>
    );
};


const ActionHandlerModal: React.FC<{
    modalData: ActionModalData;
    onClose: () => void;
    user: User;
    activeSession: Session | null;
}> = ({ modalData, onClose, user, activeSession }) => {
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState<any>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const createCalendarEventFunctionDeclaration: FunctionDeclaration = {
        name: 'create_calendar_event',
        parameters: {
            type: Type.OBJECT,
            description: 'Creates a Google Calendar event.',
            properties: {
                title: { type: Type.STRING, description: 'The title of the event.' },
                description: { type: Type.STRING, description: 'The description for the event.' },
                date: { type: Type.STRING, description: 'The date of the event in YYYY-MM-DD format.' },
                time: { type: Type.STRING, description: 'The time of the event in 24-hour HH:MM format.' },
            },
            required: ['title', 'date', 'time'],
        },
    };
     const draftEmailFunctionDeclaration: FunctionDeclaration = {
        name: 'draft_email',
        parameters: {
            type: Type.OBJECT,
            description: 'Drafts an email.',
            properties: {
                to: { type: Type.STRING, description: 'The recipient\'s email address.' },
                subject: { type: Type.STRING, description: 'The subject of the email.' },
                body: { type: Type.STRING, description: 'The body content of the email.' },
            },
            required: ['to', 'subject', 'body'],
        },
    };
    const draftInvoiceEmailFunctionDeclaration: FunctionDeclaration = {
        name: 'draft_invoice_email',
        parameters: {
            type: Type.OBJECT,
            description: 'Drafts an email with an invoice for a client.',
            properties: {
                recipientName: { type: Type.STRING, description: 'The name of the person or company receiving the invoice.'},
                to: { type: Type.STRING, description: 'The recipient\'s email address.'},
                itemDescription: { type: Type.STRING, description: 'A brief description of the item or service being invoiced.' },
                amount: { type: Type.NUMBER, description: 'The numerical amount due.'},
                currencySymbol: { type: Type.STRING, description: 'The currency symbol, e.g., $, €, £.'}
            },
            required: ['recipientName', 'to', 'itemDescription', 'amount', 'currencySymbol'],
        },
    };
    const initiatePhoneCallFunctionDeclaration: FunctionDeclaration = {
        name: 'initiate_phone_call',
        parameters: {
            type: Type.OBJECT,
            description: 'Initiates a phone call.',
            properties: {
                phoneNumber: { type: Type.STRING, description: 'The phone number to call.' },
                reason: { type: Type.STRING, description: 'A brief summary of why the call is being made.' },
            },
            required: ['phoneNumber'],
        },
    };
    const createDocumentFunctionDeclaration: FunctionDeclaration = {
        name: 'create_document',
        parameters: {
            type: Type.OBJECT,
            description: 'Creates a new document, like a Google Doc.',
            properties: {
                title: { type: Type.STRING, description: 'The suggested title for the document.' },
                content: { type: Type.STRING, description: 'The suggested initial content for the document.' },
            },
            required: ['title', 'content'],
        },
    };

    useEffect(() => {
        const determineAction = async () => {
            if (modalData.type === 'auto' && modalData.sourceItem && activeSession) {
                setLoading(true);
                setError('');
                try {
                    const prompt = t('actionPrompt', {
                        meetingTitle: activeSession.metadata.title,
                        meetingDate: new Date(activeSession.metadata.date).toLocaleDateString(),
                        meetingSummary: activeSession.results.summary,
                        actionItemText: modalData.sourceItem,
                    });

                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
// FIX: Using a simple string for 'contents' is the correct format for single-turn requests with function calling. The 'role' is implicit.
                        contents: prompt,
                        config: {
                            tools: [{ functionDeclarations: [
                                createCalendarEventFunctionDeclaration, 
                                draftEmailFunctionDeclaration, 
                                draftInvoiceEmailFunctionDeclaration, 
                                initiatePhoneCallFunctionDeclaration, 
                                createDocumentFunctionDeclaration
                            ]}],
                        },
                    });
                    
                    if (response.functionCalls && response.functionCalls.length > 0) {
                        const functionCall = response.functionCalls[0];
                        setAction({ type: functionCall.name, args: functionCall.args });
                    } else {
                        setAction({ type: 'unknown' });
                    }
                } catch (e) {
                    console.error("Error determining action:", e);
                    setError(t('actionError'));
                } finally {
                    setLoading(false);
                }
            } else {
                setAction({ type: modalData.type, args: modalData.args });
                setLoading(false);
            }
        };

        determineAction();
    }, [modalData, activeSession]);

    const handleCopyAndOpen = (content: string, url: string) => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        window.open(url, '_blank');
        setTimeout(() => setCopied(false), 2000);
    };

    const renderAction = () => {
        if (loading) return <div>{t('analyzing')}</div>;
        if (error) return <div style={{ color: '#dc3545' }}>{error}</div>;
        if (!action) return null;

        const { type, args } = action;
        const inputStyle = { width: 'calc(100% - 20px)', padding: '10px', margin: '8px 0', borderRadius: '4px', border: '1px solid #444', background: '#2C2C2C', color: 'white' };
        const labelStyle = { fontWeight: 600, display: 'block' };
        const buttonContainerStyle = { display: 'flex', justifyContent: 'flex-end', marginTop: '20px' };

        switch (type) {
            case 'create_calendar_event':
                const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(args.title)}&dates=${args.date.replace(/-/g, '')}T${args.time.replace(':', '')}00/${args.date.replace(/-/g, '')}T${(parseInt(args.time.split(':')[0]) + 1).toString().padStart(2, '0')}${args.time.split(':')[1]}00&details=${encodeURIComponent(args.description || '')}`;
                return (
                    <div>
                        <label style={labelStyle}>{t('titleLabel')}</label> <input style={inputStyle} type="text" defaultValue={args.title} />
                        <label style={labelStyle}>{t('descriptionLabel')}</label> <textarea style={{...inputStyle, height: '80px'}} defaultValue={args.description}></textarea>
                        <label style={labelStyle}>{t('dateLabel')}</label> <input style={inputStyle} type="date" defaultValue={args.date} />
                        <label style={labelStyle}>{t('timeLabel')}</label> <input style={inputStyle} type="time" defaultValue={args.time} />
                        <div style={buttonContainerStyle}><a href={gCalUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.button, textDecoration: 'none' }}>{t('openInCalendar')}</a></div>
                    </div>
                );
            case 'draft_email':
                const mailtoUrl = `mailto:${args.to}?subject=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}`;
                return (
                    <div>
                        <label style={labelStyle}>{t('toLabel')}</label> <input style={inputStyle} type="email" defaultValue={args.to} />
                        <label style={labelStyle}>{t('subjectLabel')}</label> <input style={inputStyle} type="text" defaultValue={args.subject} />
                        <label style={labelStyle}>{t('bodyLabel')}</label> <textarea style={{...inputStyle, height: '120px'}} defaultValue={args.body}></textarea>
                        <div style={buttonContainerStyle}><a href={mailtoUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.button, textDecoration: 'none' }}>{t('openInEmailApp')}</a></div>
                    </div>
                );
             case 'draft_invoice_email':
                const invoiceBody = t('invoiceEmailBody', {
                    recipientName: args.recipientName,
                    itemDescription: args.itemDescription,
                    currencySymbol: args.currencySymbol,
                    amount: args.amount,
                    userName: user.name.split(' ')[0]
                });
                const invoiceMailtoUrl = `mailto:${args.to}?subject=${encodeURIComponent(`Invoice for ${args.itemDescription}`)}&body=${encodeURIComponent(invoiceBody)}`;
                return (
                    <div>
                        <label style={labelStyle}>{t('recipientNameLabel')}</label> <input style={inputStyle} type="text" defaultValue={args.recipientName} />
                        <label style={labelStyle}>{t('toLabel')}</label> <input style={inputStyle} type="email" defaultValue={args.to} />
                        <label style={labelStyle}>{t('amountLabel')}</label> <input style={inputStyle} type="text" defaultValue={`${args.currencySymbol}${args.amount}`} />
                        <label style={labelStyle}>{t('bodyLabel')}</label> <textarea style={{...inputStyle, height: '150px'}} defaultValue={invoiceBody}></textarea>
                        <div style={buttonContainerStyle}><a href={invoiceMailtoUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.button, textDecoration: 'none' }}>{t('openInEmailApp')}</a></div>
                    </div>
                );
            case 'initiate_phone_call':
                const telUrl = `tel:${args.phoneNumber}`;
                return (
                    <div>
                        <label style={labelStyle}>{t('phoneNumberLabel')}</label> <input style={inputStyle} type="tel" defaultValue={args.phoneNumber} />
                        <label style={labelStyle}>{t('reasonLabel')}</label> <input style={inputStyle} type="text" defaultValue={args.reason} />
                        <div style={buttonContainerStyle}><a href={telUrl} style={{ ...styles.button, textDecoration: 'none' }}>{t('callNow')}</a></div>
                    </div>
                );
            case 'create_document':
                return (
                    <div>
                        <p>{t('createDocInfo')}</p>
                        <label style={labelStyle}>{t('suggestedTitle')}</label> <input style={inputStyle} type="text" readOnly value={args.title} />
                        <label style={labelStyle}>{t('suggestedContent')}</label> <textarea style={{...inputStyle, height: '120px'}} readOnly value={args.content}></textarea>
                        <div style={buttonContainerStyle}>
                            <button style={styles.button} onClick={() => handleCopyAndOpen(args.content, 'https://docs.new')}>
                                {copied ? t('copiedSuccess') : t('openGoogleDocs')}
                            </button>
                        </div>
                    </div>
                );
            default:
                return (
                    <div>
                        <p>{t('noActionDetermined')}</p>
                        <div style={buttonContainerStyle}><button style={{...styles.button, backgroundColor: '#444'}} onClick={onClose}>{t('cancel')}</button></div>
                    </div>
                );
        }
    };

    const getTitle = () => {
        if (!action) return t('analyzing');
        switch (action.type) {
            case 'create_calendar_event': return t('createCalendarEvent');
            case 'draft_email': return t('draftEmail');
            case 'draft_invoice_email': return t('draftInvoiceEmail');
            case 'initiate_phone_call': return t('initiatePhoneCall');
            case 'create_document': return t('createDocument');
            default: return t('unknownAction');
        }
    };
    
    return <Modal title={getTitle()} onClose={onClose}>{renderAction()}</Modal>;
};

const FAQModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <Modal title={t('faqTitle')} onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {t('faq').map((item: { q: string, a: string }, index: number) => (
                    <div key={index}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#00A99D' }}>{item.q}</h4>
                        <p style={{ margin: 0, lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: item.a }}></p>
                    </div>
                ))}
                <hr style={{ border: '1px solid #333', width: '100%' }} />
                <div style={{ textAlign: 'center' }}>
                     <h4>{t('featureShowcase')}</h4>
                    <ul style={{listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center'}}>
                        {t('featureList').map((feat: string) => <li key={feat} style={{background: '#2C2C2C', padding: '6px 12px', borderRadius: '16px'}}>{feat}</li>)}
                    </ul>
                </div>
                <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                    <p>{t('createdBy')} <strong>{t('creatorName')}</strong> (<a href={`mailto:${t('creatorEmail')}`} style={{color: '#00A99D'}}>{t('creatorEmail')}</a>)</p>
                    <p><em>{t('dedication')}</em></p>
                </div>
            </div>
        </Modal>
    );
};


const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);

// --- Register Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registered: ', registration);
        }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}