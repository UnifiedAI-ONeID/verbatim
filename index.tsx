
import React, { useState, useRef, CSSProperties, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { marked } from 'marked';

// --- Firebase Integration (Modern Modular SDK) ---
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, deleteObject } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";


// --- Gemini API Initialization (CLIENT-SIDE - FOR 'takeAction' ONLY) ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Firebase Configuration ---
// TODO: Replace with your own Firebase project configuration.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const functions = getFunctions(firebaseApp);

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'unknown';
type MeetingResults = { transcript: string; summary: string; actionItems: string[] };
type MeetingMetadata = { title: string; date: string; location: string; mapUrl: string; };
type Session = { id: string; metadata: MeetingMetadata; results: MeetingResults; speakers: Record<string, string>; status: 'processing' | 'completed' | 'error'; error?: string; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };
type ActiveTab = 'record' | 'sessions';

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

// --- i18n Translations ---
const translations = {
    en: {
        title: 'Verbatim',
        subtitle: 'Your intelligent meeting dashboard.',
        welcomeUser: 'Welcome, {name}',
        startRecording: '🎤 New Session',
        stopRecording: '⏹️ Stop',
        analyzing: 'Analyzing...',
        processing: 'Processing...',
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
        consentTitle: 'Important Notice',
        consentInternalUse: 'I acknowledge this application is for internal Impactory Institute use only.',
        consentNoCopy: 'I agree not to copy or distribute this application without permission.',
        consentContinue: 'Accept & Continue',
        loginTitle: 'Welcome to Verbatim',
        loginSubtitle: 'Sign in to save and manage your sessions.',
        nameLabel: 'Full Name',
        emailLabel: 'Email',
        continueButton: 'Continue',
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
                a: 'From the "Record" tab, tap the large microphone button. If it\'s your first time, you\'ll be asked to create an account. Then, you\'ll be prompted to select your preferred microphone. Once you click "Start," the recording will begin immediately.',
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
                a: 'Your sessions are securely stored in the cloud using Firebase and are linked to your account. This means you can access your recordings from any device. Your audio files are stored in Firebase Storage, and the analysis results are kept in a secure Firestore database.',
            },
        ],
        sessions: 'Sessions',
        record: 'Record',
        recording: 'Recording...',
        tapToRecord: 'Tap to start recording',
        signIn: 'Sign In with Google',
        signOut: 'Sign Out',
        signInToRecord: 'Sign in to start recording',
        signInToView: 'Sign in to view sessions',
        signInError: 'Failed to sign in with Google. Please try again.',
        signInPopupBlockedError: 'Sign-in popup was blocked by the browser. Please allow popups for this site.',
    },
    es: {
        title: 'Verbatim',
        subtitle: 'Tu panel de reuniones inteligente.',
        welcomeUser: 'Bienvenido, {name}',
        startRecording: '🎤 Nueva Sesión',
        stopRecording: '⏹️ Detener',
        analyzing: 'Analizando...',
        processing: 'Procesando...',
        micPermissionError: 'No se pudo iniciar la grabación. Por favor, concede permisos para el micrófono.',
        processingError: 'No se pudo procesar el audio. Esto puede ocurrir por una mala conexión de red, una grabación muy corta o si el audio está en silencio. Por favor, inténtalo de nuevo.',
        offlineError: 'El análisis requiere una conexión a internet. Por favor, conéctate y vuelve a intentarlo.',
        recordingTooShortError: 'La grabación es demasiado corta para analizar. Por favor, graba durante al menos 2 segundos.',
        transcriptHeader: '📋 Transcripción',
        summaryHeader: '✨ Resumen Clave',
        actionItemsHeader: '📌 Puntos de Acción',
        noTranscript: 'No se pudo extraer la transcripción.',
        noSummary: 'No se pudo extraer el resumen.',
        takeAction: 'Tomar Acción ✨',
        noActionDetermined: 'No se pudo determinar una acción específica para este ítem. Puedes gestionarlo manually.',
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
        openInEmailApp: 'Abrir en Correo',
        draftInvoiceEmail: 'Redactar Correo de Factura',
        recipientNameLabel: 'Nombre del Destinatario:',
        amountLabel: 'Monto:',
        invoiceEmailBody: 'Hola {recipientName},\n\nEsta es una factura para el siguiente artículo:\n- {itemDescription}\n\nMonto a pagar: {currencySymbol}{amount}\n\nSi tienes alguna pregunta, no dudes en contactarme.\n\nAtentamente,\n{userName}',
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
        renameSpeakerPrompt: 'Ingrese el nuevo nombre para',
        footerText: 'Para Uso Exclusivo del Impactory Institute',
        recentSessions: 'Sesiones Recientes',
        welcomeMessage: 'Bienvenido a Verbatim',
        welcomeSubtext: 'Tus sesiones grabadas aparecerán aquí. Toca el micrófono para empezar.',
        deleteSession: '¿Eliminar Sesión?',
        deleteConfirmation: '¿Estás seguro de que quieres eliminar esta sesión? Esta acción no se puede deshacer.',
        searchPlaceholder: 'Buscar sesiones...',
        toggleMiniView: 'Picture-in-Picture',
        keepAwake: 'Mantener Pantalla Encendida',
        keepAwakeInfo: 'Evita que la pantalla se apague durante una sesión de grabación.',
        backToList: 'Volver a Sesiones',
        recordPhoneCallTitle: '¿Grabando una llamada telefónica?',
        recordPhoneCallInstruction: 'Para la mejor calidad, conecta tus auriculares. También puedes usar el altavoz de tu teléfono. Toca el botón de grabar para comenzar.',
        selectAudioDeviceTitle: 'Seleccionar Fuente de Audio',
        selectAudioDeviceInstruction: 'Elige el micrófono que deseas utilizar para la grabación.',
        start: 'Comenzar',
        cancel: 'Cancelar',
        analysisPrompt: 'Eres un experto asistente de reuniones multilingüe. El idioma preferido del usuario es español. Analiza el siguiente audio de la reunión, que puede contener varios idiomas hablados. Tu tarea es procesar este audio multilingüe y generar todo el resultado exclusivamente en español. Proporciona un resumen conciso, una lista de puntos de acción y una transcripción completa con etiquetas de orador (p. ej., Orador 1, Orador 2). En el resumen, presta especial atención y enumera claramente cualquier cifra financiera, presupuesto o costo mencionado. Identifica a todos los oradores únicos. Todo el texto de salida (resumen, puntos de acción, transcripción) DEBE ser traducido y escrito en español. Formatea la salida como un objeto JSON con las claves: "summary", "actionItems" (un array de strings), "transcript" (un string con saltos de línea y etiquetas de orador), y "speakers" (un array de etiquetas de orador identificadas como ["Orador 1", "Orador 2"]). No incluyas el envoltorio de markdown para JSON.',
        actionPrompt: 'Eres un asistente inteligente. Basado en el contexto completo de una reunión y un punto de acción específico, llama a la herramienta más apropiada para ayudar al usuario a completarlo. El idioma del usuario es español. Título de la reunión: "{meetingTitle}". Fecha de la reunión: "{meetingDate}". Resumen de la reunión: "{meetingSummary}". Punto de acción: "{actionItemText}". Asegúrate de que todo el contenido generado, como asuntos de correo o descripciones de eventos, sea relevante para el contexto de la reunión.',
        featureShowcase: 'Funcionalidades de Verbatim',
        createdBy: 'Creado por',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: 'Dedicado con amor a mi familia, a todas las mamás ocupadas y al creador. ❤️',
        featureList: [
            'Análisis IA Multilingüe',
            'Resumen y Acciones Automáticas',
            'Transcripción Completa con Oradores',
            'Acciones en Un Clic (Calendar, Gmail, Docs)',
            'Exportar y Copiar en Markdown',
            'Mini Vista Picture-in-Picture',
            'Funcionalidad PWA Offline',
            'Selección de Fuente de Audio',
        ],
        consentTitle: 'Aviso Importante',
        consentInternalUse: 'Reconozco que esta aplicación es para uso interno exclusivo del Impactory Institute.',
        consentNoCopy: 'Acepto no copiar ni distribuir esta aplicación sin permiso.',
        consentContinue: 'Aceptar y Continuar',
        loginTitle: 'Bienvenido a Verbatim',
        loginSubtitle: 'Inicia sesión para guardar y gestionar tus sesiones.',
        nameLabel: 'Nombre Completo',
        emailLabel: 'Correo Electrónico',
        continueButton: 'Continuar',
        faqLink: 'FAQ',
        faqTitle: 'Preguntas Frecuentes',
        logout: 'Cerrar Sesión',
        faq: [
             {
                q: '¿Qué hay de nuevo en esta versión (Beta v1.3)?',
                a: 'Esta versión mejora la inteligencia de la IA, especialmente en temas financieros. La IA ahora identifica y resalta mejor las cifras monetarias en el resumen. También introduce una nueva acción de un solo clic "Redactar Factura" para tareas relevantes, agilizando y facilitando los seguimientos financieros.',
            },
            {
                q: '¿Cómo maneja la aplicación las discusiones sobre dinero?',
                a: 'La IA está entrenada para reconocer conversaciones que involucran finanzas. Resaltará automáticamente cualquier cifra específica, presupuesto o costo mencionado durante la reunión en la sección "Resumen Clave". Si un punto de acción implica facturar a un cliente (p. ej., "Enviar una factura al Cliente X por $500"), el botón "Tomar Acción" ofrecerá redactar un correo de factura por ti, rellenando previamente el destinatario, el monto y la descripción.',
            },
            {
                q: '¿Cómo inicio una nueva grabación?',
                a: 'Desde la pestaña "Grabar", toca el botón grande del micrófono. Si es tu primera vez, se te pedirá que crees una cuenta. Luego, se te pedirá que selecciones tu micrófono preferido. Una vez que hagas clic en "Comenzar", la grabación se iniciará de inmediato.',
            },
            {
                q: '¿Puede Verbatim entender diferentes idiomas en la misma reunión?',
                a: '¡Sí! Verbatim cuenta con una IA multilingüe que puede procesar audio que contenga varios idiomas. Todos los resultados finales, incluyendo el resumen, los puntos de acción y la transcripción, se traducirán y presentarán en el idioma predeterminado de tu navegador (inglés, español o chino).',
            },
            {
                q: '¿Cómo se identifican los oradores y puedo cambiar sus nombres?',
                a: 'La IA distingue automáticamente entre diferentes oradores y los etiqueta como "Orador 1", etc. Después del análisis, haz clic en el ícono de lápiz (✏️) junto al nombre de un orador. El nombre se convertirá en un campo editable. Escribe el nuevo nombre y presiona Enter o haz clic fuera para guardar. Esto actualizará el nombre en toda la transcripción.',
            },
            {
                q: '¿Qué son las "Acciones en Un Clic"?',
                a: 'Para cada punto de acción identificado por la IA, puedes hacer clic en el botón "Tomar Acción ✨". La IA determinará la mejor herramienta para la tarea (como crear un evento de calendario, redactar un correo electrónico o iniciar un documento) y rellenará previamente la información necesaria por ti.',
            },
            {
                q: '¿Cómo puedo usar los controles de grabación mientras estoy en otra ventana?',
                a: 'Mientras grabas en un navegador de escritorio, haz clic en el botón "Alternar Mini Vista". Esto abrirá una pequeña ventana Picture-in-Picture con un temporizador y un botón de "Detener", que permanecerá encima de tus otras ventanas para que puedas controlar fácilmente la grabación.',
            },
            {
                q: '¿La aplicación funciona sin conexión?',
                a: 'Sí. Verbatim es una Aplicación Web Progresiva (PWA). Después de tu primera visita, puedes instalarla en tu dispositivo para una experiencia similar a la de una aplicación. Puedes ver las sesiones pasadas incluso sin conexión a internet. Sin embargo, analizar una nueva grabación requiere una conexión a internet para comunicarse con la IA.',
            },
            {
                q: '¿Dónde se almacenan mis datos?',
                a: 'Tus sesiones se almacenan de forma segura en la nube utilizando Firebase y están vinculadas a tu cuenta. Esto significa que puedes acceder a tus grabaciones desde cualquier dispositivo. Tus archivos de audio se almacenan en Firebase Storage y los resultados del análisis se guardan en una base de datos segura de Firestore.',
            },
        ],
        sessions: 'Sesiones',
        record: 'Grabar',
        recording: 'Grabando...',
        tapToRecord: 'Toca para empezar a grabar',
        signIn: 'Iniciar Sesión con Google',
        signOut: 'Cerrar Sesión',
        signInToRecord: 'Inicia sesión para grabar',
        signInToView: 'Inicia sesión para ver sesiones',
        signInError: 'Error al iniciar sesión con Google. Por favor, inténtelo de nuevo.',
        signInPopupBlockedError: 'El navegador bloqueó la ventana de inicio de sesión. Por favor, permita las ventanas emergentes para este sitio.',
    },
    'zh-CN': {
        title: 'Verbatim',
        subtitle: '您的智能会议仪表板。',
        welcomeUser: '欢迎，{name}',
        startRecording: '🎤 新建会话',
        stopRecording: '⏹️ 停止',
        analyzing: '正在分析...',
        processing: '处理中...',
        micPermissionError: '无法开始录音。请授予麦克风权限。',
        processingError: '处理音频失败。这可能是由于网络连接不佳、录音时间过短或音频无声。请重试。',
        offlineError: '分析需要网络连接。请连接网络后重试。',
        recordingTooShortError: '录音时间太短，无法分析。请至少录制2秒。',
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
        draftEmail: '草拟邮件',
        toLabel: '收件人:',
        subjectLabel: '主题:',
        bodyLabel: '正文:',
        openInEmailApp: '在邮件应用中打开',
        draftInvoiceEmail: '草拟发票邮件',
        recipientNameLabel: '收件人姓名:',
        amountLabel: '金额:',
        invoiceEmailBody: '您好 {recipientName}，\n\n这是关于以下项目的发票：\n- {itemDescription}\n\n应付金额：{currencySymbol}{amount}\n\n如果您有任何问题，请随时与我联系。\n\n此致，\n{userName}',
        initiatePhoneCall: '拨打电话',
        phoneNumberLabel: '电话号码:',
        reasonLabel: '呼叫原因:',
        callNow: '立即呼叫',
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
        welcomeSubtext: '您录制的会话将显示在此处。点击麦克风即可开始。',
        deleteSession: '删除会话？',
        deleteConfirmation: '您确定要删除此会话吗？此操作无法撤销。',
        searchPlaceholder: '搜索会话...',
        toggleMiniView: '画中画',
        keepAwake: '保持屏幕常亮',
        keepAwakeInfo: '在录音期间防止屏幕关闭。',
        backToList: '返回会话列表',
        recordPhoneCallTitle: '正在录制电话通话？',
        recordPhoneCallInstruction: '为获得最佳音质，请连接您的耳机。您也可以使用手机的扬声器。点击录音按钮开始。',
        selectAudioDeviceTitle: '选择音频源',
        selectAudioDeviceInstruction: '请选择您要用于录音的麦克风。',
        start: '开始',
        cancel: '取消',
        analysisPrompt: '你是一位专业的多语言会议助理。用户的首选语言是简体中文。请分析接下来的会议音频，其中可能包含多种口语语言。你的任务是处理这段多语言音频，并仅以简体中文生成所有输出。请提供简明的摘要、行动项列表，以及带有发言人标签（例如，发言人1，发言人2）的完整文字记录。在摘要中，请特别注意并清晰地列出任何提及的财务数据、预算或成本。识别所有独立发言人。所有输出文本（摘要、行动项、文字记录）必须翻译成并以简体中文书写。将输出格式化为 JSON 对象，键为："summary"、"actionItems"（字符串数组）、"transcript"（带换行符和发言人标签的字符串），以及 "speakers"（已识别的发言人标签数组，如 ["发言人 1", "发言人 2"]）。不要包含 JSON 的 markdown 包装。',
        actionPrompt: '你是一个智能助理。请根据会议的完整背景和具体的行动项，调用最合适的工具来帮助用户完成它。用户的语言是简体中文。会议标题：“{meetingTitle}”。会议日期：“{meetingDate}”。会议摘要：“{meetingSummary}”。行动项：“{actionItemText}”。确保所有生成的内容（如邮件主题或活动描述）都与会议背景相关。',
        featureShowcase: 'Verbatim 功能',
        createdBy: '创建者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: '深深地献给我的家人、所有忙碌的妈妈们以及造物主。 ❤️',
        featureList: [
            '多语言AI分析',
            '自动摘要和行动项',
            '带发言人标签的完整文字记录',
            '一键操作（日历、Gmail、文档）',
            'Markdown 导出和复制',
            '画中画迷你视图',
            '离线 PWA 功能',
            '音频源选择',
        ],
        consentTitle: '重要通知',
        consentInternalUse: '我确认此应用程序仅供 Impactory Institute 内部使用。',
        consentNoCopy: '我同意未经许可不复制或分发此应用程序。',
        consentContinue: '接受并继续',
        loginTitle: '欢迎使用 Verbatim',
        loginSubtitle: '登录以保存和管理您的会话。',
        nameLabel: '全名',
        emailLabel: '电子邮件',
        continueButton: '继续',
        faqLink: '常见问题',
        faqTitle: '常见问题解答',
        logout: '登出',
        faq: [
             {
                q: '这个版本（Beta v1.3）有什么新功能？',
                a: '此版本增强了 AI 的智能，特别是在财务主题方面。AI 现在能更好地识别和突出摘要中的货币数字。它还为相关任务引入了新的一键操作“草拟发票邮件”，使财务跟进更快、更容易。',
            },
            {
                q: '应用如何处理关于金钱的讨论？',
                a: 'AI 经过训练，可以识别涉及财务的对话。它会自动在“核心摘要”部分突出显示会议期间提到的任何具体数字、预算或成本。如果行动项涉及向客户开具账单（例如，“向客户 X 发送 500 美元的发票”），“执行操作”按钮将提供为您草拟发票邮件的选项，并预先填写收件人、金额和描述。',
            },
            {
                q: '如何开始新的录音？',
                a: '在“录音”选项卡中，点击大的麦克风按钮。如果是您第一次使用，系统会要求您创建一个帐户。然后，您将被提示选择您偏好的麦克风。点击“开始”后，录音将立即开始。',
            },
            {
                q: 'Verbatim 能否在同一次会议中理解不同的语言？',
                a: '是的！Verbatim 是由一个多语言人工智能驱动，可以处理包含多种语言的音频。所有最终输出，包括摘要、行动项和文字记录，都将被翻译并以您浏览器的默认语言（英语、西班牙语或中文）呈现。',
            },
            {
                q: '发言人是如何被识别的？我可以更改他们的名字吗？',
                a: '人工智能会自动区分不同的发言人，并将他们标记为“发言人 1”等。分析后，点击发言人姓名旁边的铅笔图标（✏️）。姓名将变为可编辑字段。输入新名称后按 Enter 键或点击其他地方即可保存。这将在整个文字记录中更新该姓名。',
            },
            {
                q: '什么是“一键操作”？',
                a: '对于人工智能识别的每个行动项，您可以点击“执行操作 ✨”按钮。人工智能将确定最适合该任务的工具（例如创建日历活动、草拟电子邮件或启动文档），并为您预填必要的信息。',
            },
            {
                q: '在另一个窗口时，如何使用录音控制？',
                a: '在桌面浏览器上录音时，点击“切换迷你视图”按钮。这将打开一个小的画中画窗口，其中包含一个计时器和一个“停止”按钮，该窗口会保持在其他窗口的顶部，方便您轻松控制录音。',
            },
            {
                q: '这个应用可以离线工作吗？',
                a: '是的。Verbatim 是一个渐进式网络应用（PWA）。首次访问后，您可以将其安装在您的设备上，以获得类似应用的体验。即使没有网络连接，您也可以查看过去的会话。但是，分析新的录音需要网络连接才能与人工智能通信。',
            },
            {
                q: '我的数据存储在哪里？',
                a: '您的会话使用 Firebase 安全地存储在云端，并与您的帐户关联。这意味着您可以从任何设备访问您的录音。您的音频文件存储在 Firebase Storage 中，分析结果保存在安全的 Firestore 数据库中。',
            },
        ],
        sessions: '会话',
        record: '录音',
        recording: '录音中...',
        tapToRecord: '点击开始录音',
        signIn: '使用 Google 登录',
        signOut: '登出',
        signInToRecord: '登录以开始录音',
        signInToView: '登录以查看会话',
        signInError: 'Google 登录失败，请重试。',
        signInPopupBlockedError: '登录弹出窗口被浏览器阻止。请允许此站点的弹出窗口。',
    },
     'zh-TW': {
        title: 'Verbatim',
        subtitle: '您的智慧會議儀表板。',
        welcomeUser: '歡迎，{name}',
        startRecording: '🎤 新增會話',
        stopRecording: '⏹️ 停止',
        analyzing: '分析中...',
        processing: '處理中...',
        micPermissionError: '無法開始錄音。請授予麥克風權限。',
        processingError: '處理音訊失敗。這可能是由於網路連線不佳、錄音時間過短或音訊無聲。請重試。',
        offlineError: '分析需要網路連線。請連線後重試。',
        recordingTooShortError: '錄音時間太短，無法分析。請至少錄製2秒。',
        transcriptHeader: '📋 文字記錄',
        summaryHeader: '✨ 核心摘要',
        actionItemsHeader: '📌 行動項',
        noTranscript: '無法擷取文字記錄。',
        noSummary: '無法擷取摘要。',
        takeAction: '執行操作 ✨',
        noActionDetermined: '無法為此項目確定具體操作。請手動處理。',
        createCalendarEvent: '建立 Google 日曆活動',
        titleLabel: '標題:',
        descriptionLabel: '描述:',
        dateLabel: '日期:',
        timeLabel: '時間:',
        openInCalendar: '在 Google 日曆中開啟',
        draftEmail: '草擬郵件',
        toLabel: '收件人:',
        subjectLabel: '主旨:',
        bodyLabel: '內文:',
        openInEmailApp: '在郵件應用程式中開啟',
        draftInvoiceEmail: '草擬發票郵件',
        recipientNameLabel: '收件人姓名:',
        amountLabel: '金額:',
        invoiceEmailBody: '您好 {recipientName}，\n\n這是關於以下項目的發票：\n- {itemDescription}\n\n應付金額：{currencySymbol}{amount}\n\n如果您有任何問題，請隨時与我聯繫。\n\n此致，\n{userName}',
        initiatePhoneCall: '撥打電話',
        phoneNumberLabel: '電話號碼:',
        reasonLabel: '通話原因:',
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
        downloadMarkdown: '下載為 .md 檔案',
        copiedSuccess: '已複製到剪貼簿！',
        meetingTitle: '會議記錄',
        meetingLocation: '地點:',
        locationUnavailable: '地點不可用',
        gettingLocation: '正在取得地點...',
        speakersHeader: '🗣️ 發言人',
        renameSpeakerPrompt: '輸入新名稱',
        footerText: '僅供 Impactory Institute 使用',
        recentSessions: '最近的會話',
        welcomeMessage: '歡迎使用 Verbatim',
        welcomeSubtext: '您錄製的會話將顯示在此處。點擊麥克風即可開始。',
        deleteSession: '刪除會話？',
        deleteConfirmation: '您確定要刪除此會話嗎？此操作無法撤銷。',
        searchPlaceholder: '搜尋會話...',
        toggleMiniView: '子母畫面',
        keepAwake: '保持螢幕常亮',
        keepAwakeInfo: '在錄音期間防止螢幕關閉。',
        backToList: '返回會話列表',
        recordPhoneCallTitle: '正在錄製電話通話？',
        recordPhoneCallInstruction: '為獲得最佳音質，請連接您的耳機。您也可以使用手機的揚声器。點擊錄音按鈕開始。',
        selectAudioDeviceTitle: '選取音訊來源',
        selectAudioDeviceInstruction: '請選擇您要用於錄音的麥克風。',
        start: '開始',
        cancel: '取消',
        analysisPrompt: '你是一位專業的多語言會議助理。使用者的首選語言是繁體中文。請分析接下來的會議音訊，其中可能包含多種口語語言。你的任務是處理這段多語言音訊，並僅以繁體中文產生所有輸出。請提供簡明的摘要、行動項列表，以及帶有發言人標籤（例如，發言人1，發言人2）的完整文字記錄。在摘要中，請特別注意並清晰地列出任何提及的財務數據、預算或成本。識別所有獨立發言人。所有輸出文字（摘要、行動項、文字記錄）必須翻譯成並以繁體中文書寫。將輸出格式化為 JSON 物件，鍵為："summary"、"actionItems"（字串陣列）、"transcript"（帶換行符和發言人標籤的字串），以及 "speakers"（已識別的發言人標籤陣列，如 ["發言人 1", "發言人 2"]）。不要包含 JSON 的 markdown 包裝。',
        actionPrompt: '你是一個智慧助理。請根據會議的完整背景和具體的行動項，呼叫最合適的工具來幫助使用者完成它。使用者的語言是繁體中文。會議標題：「{meetingTitle}」。會議日期：「{meetingDate}」。會議摘要：「{meetingSummary}」。行動項：「{actionItemText}」。確保所有生成的內容（如郵件主旨或活動描述）都与會議背景相關。',
        featureShowcase: 'Verbatim 功能',
        createdBy: '建立者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: '深深地獻給我的家人、所有忙碌的媽媽們以及造物主。 ❤️',
        featureList: [
            '多語言AI分析',
            '自動摘要與行動項目',
            '完整逐字稿與發言人標示',
            '一鍵操作（日曆、Gmail、文件）',
            'Markdown 匯出與複製',
            '子母畫面迷你檢視',
            '離線 PWA 功能',
            '音訊来源選擇',
        ],
        consentTitle: '重要通知',
        consentInternalUse: '我確認此應用程式僅供 Impactory Institute 內部使用。',
        consentNoCopy: '我同意未經許可不複製或散佈此應用程式。',
        consentContinue: '接受並繼續',
        loginTitle: '歡迎使用 Verbatim',
        loginSubtitle: '登入以儲存和管理您的會話。',
        nameLabel: '全名',
        emailLabel: '電子郵件',
        continueButton: '繼續',
        faqLink: '常見問題',
        faqTitle: '常見問題解答',
        logout: '登出',
        faq: [
             {
                q: '這個版本（Beta v1.3）有什麼新功能？',
                a: '此版本增強了 AI 的智慧，特別是在財務主題方面。AI 現在能更好地識別和突顯摘要中的貨幣數字。它還為相關任務引入了新的一鍵操作「草擬發票郵件」，使財務追蹤更快、更容易。',
            },
            {
                q: '應用程式如何處理關於金錢的討論？',
                a: 'AI 經過訓練，可以識別涉及財務的對話。它會自動在「核心摘要」部分突顯會議期間提到的任何具體數字、預算或成本。如果行動項涉及向客戶開具帳單（例如，「向客戶 X 發送 500 美元的發票」），「執行操作」按鈕將提供為您草擬發票郵件的選項，並預先填寫收件人、金額和描述。',
            },
            {
                q: '如何開始新的錄音？',
                a: '在「錄製」選項卡中，點擊大的麥克風按鈕。如果是您第一次使用，系統會要求您建立一個帳戶。然後，您將被提示選擇您偏好的麥克風。點擊「開始」後，錄音將立即開始。',
            },
            {
                q: 'Verbatim 能否在同一次會議中理解不同的語言？',
                a: '是的！Verbatim 由一個多語言人工智慧驅動，可以處理包含多種語言的音訊。所有最終輸出，包括摘要、行動項和文字記錄，都將被翻譯並以您瀏覽器的預設語言（英語、西班牙語或中文）呈現。',
            },
            {
                q: '發言人是如何被識別的？我可以更改他們的名字嗎？',
                a: '人工智慧會自動區分不同的發言人，並將他們標記為「發言人 1」等。分析後，點擊發言人姓名旁邊的鉛筆圖示（✏️）。姓名將變為可編輯欄位。輸入新名稱後按 Enter 鍵或點擊其他地方即可儲存。這將在整個文字記錄中更新該姓名。',
            },
            {
                q: '什麼是「一鍵操作」？',
                a: '對於人工智慧識別的每个行動項，您可以點擊「執行操作 ✨」按鈕。人工智慧將確定最適合該任務的工具（例如建立日曆活動、草擬電子郵件或啟動文件），並為您預填必要的資訊。',
            },
            {
                q: '在另一個視窗時，如何使用錄音控制？',
                a: '在桌面瀏覽器上錄音時，點擊「切換迷你視圖」按鈕。這將開啟一個小的子母畫面視窗，其中包含一個計時器和一個「停止」按鈕，該視窗會保持在其他視窗的頂部，方便您輕鬆控制錄音。',
            },
            {
                q: '這個應用程式可以離線工作嗎？',
                a: '是的。Verbatim 是一個漸進式網路應用程式（PWA）。首次造訪後，您可以將其安裝在您的裝置上，以獲得類似應用程式的體驗。即使沒有網路連線，您也可以查看過去的會話。但是，分析新的錄音需要網路連線才能与人工智慧通訊。',
            },
            {
                q: '我的資料儲存在哪裡？',
                a: '您的會話使用 Firebase 安全地儲存在雲端，并与您的帳戶關聯。這意味著您可以從任何裝置存取您的錄音。您的音訊檔案儲存在 Firebase Storage 中，分析結果保存在安全的 Firestore 資料庫中。',
            },
        ],
        sessions: '會話',
        record: '錄製',
        recording: '錄製中...',
        tapToRecord: '點擊以開始錄製',
        signIn: '使用 Google 登入',
        signOut: '登出',
        signInToRecord: '登入以開始錄製',
        signInToView: '登入以查看會話',
        signInError: 'Google 登入失敗，請重試。',
        signInPopupBlockedError: '登入彈出視窗被瀏覽器封鎖。請允許此網站的彈出視窗。',
    },
};

// --- Helper Functions ---
const getLanguage = (): Language => {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('zh-cn')) return 'zh-CN';
    if (lang.startsWith('zh')) return 'zh-TW';
    return 'en';
};

const getPlatform = (): Platform => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
    if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(ua)) return 'macos';
    if (/Win32|Win64|Windows|WinCE/.test(ua)) return 'windows';
    return 'unknown';
};

const t = translations[getLanguage()];

// --- Gemini Function Calling Tool Definitions ---
const tools: FunctionDeclaration[] = [
    {
        name: 'create_calendar_event',
        description: 'Creates a Google Calendar event.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: 'The title of the event.' },
                description: { type: Type.STRING, description: 'The description or agenda for the event.' },
                date: { type: Type.STRING, description: 'The date of the event in YYYY-MM-DD format.' },
                time: { type: Type.STRING, description: 'The time of the event in HH:MM format (24-hour).' },
            },
            required: ['title', 'date', 'time'],
        },
    },
    {
        name: 'draft_email',
        description: 'Drafts an email to a recipient.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                to: { type: Type.STRING, description: 'The recipient\'s email address.' },
                subject: { type: Type.STRING, description: 'The subject line of the email.' },
                body: { type: Type.STRING, description: 'The body content of the email.' },
            },
            required: ['to', 'subject', 'body'],
        },
    },
    {
        name: 'draft_invoice_email',
        description: 'Drafts an email with an invoice for a client.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                recipient_name: { type: Type.STRING, description: 'The name of the person or company receiving the invoice.' },
                item_description: { type: Type.STRING, description: 'A description of the product or service being invoiced.' },
                amount: { type: Type.NUMBER, description: 'The total amount due.' },
            },
            required: ['recipient_name', 'item_description', 'amount'],
        },
    },
    {
        name: 'initiate_phone_call',
        description: 'Initiates a phone call.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                phone_number: { type: Type.STRING, description: 'The phone number to call.' },
                reason: { type: Type.STRING, description: 'A brief summary of why the call is being made.' },
            },
            required: ['phone_number'],
        },
    },
    {
        name: 'create_google_doc',
        description: 'Creates a new Google Document with specified content.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: 'The title of the document.' },
                content: { type: Type.STRING, description: 'The initial content to be placed in the document.' },
            },
            required: ['title', 'content'],
        },
    }
];


// --- Main App Component ---
const App = () => {
    // --- State Management ---
    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showActionModal, setShowActionModal] = useState<ActionModalData | null>(null);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [showDeviceSelector, setShowDeviceSelector] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [showFaq, setShowFaq] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [keepAwake, setKeepAwake] = useState(() => JSON.parse(localStorage.getItem('verbatim_keepAwake') || 'false'));


    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<number | null>(null);
    const pipWindowRef = useRef<Window | null>(null);
    const pipChannelRef = useRef(new BroadcastChannel('verbatim_pip_channel'));
    const wakeLockRef = useRef<any>(null);


    // --- Authentication and Data Fetching ---
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                await setDoc(userDocRef, {
                    name: firebaseUser.displayName,
                    email: firebaseUser.email
                }, { merge: true });
            } else {
                setUser(null);
                setSessions([]);
            }
            setIsLoading(false);
        });

        return () => unsubscribeAuth();
    }, []);

    // --- Session listener ---
    useEffect(() => {
        if (!user) return;

        const sessionsColRef = collection(db, 'users', user.uid, 'sessions');
        const q = query(sessionsColRef, orderBy('metadata.date', 'desc'));

        const unsubscribeSessions = onSnapshot(q, (snapshot) => {
            const userSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(userSessions);
        }, (err) => {
            console.error("Error fetching sessions:", err);
            setError("Could not load sessions.");
        });

        return () => unsubscribeSessions();
    }, [user]);


    // --- User Preference Persistence ---
    useEffect(() => {
        localStorage.setItem('verbatim_keepAwake', JSON.stringify(keepAwake));
    }, [keepAwake]);

    // --- Geolocation ---
    const getGeolocation = (): Promise<GeolocationPosition | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve(position),
                    () => resolve(null),
                    { timeout: 5000, enableHighAccuracy: false }
                );
            }
        });
    };

    const fetchLocationName = async (lat: number, lon: number): Promise<string> => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            if (!response.ok) throw new Error('Failed to fetch location name');
            const data = await response.json();
            return data.display_name || t.locationUnavailable;
        } catch (error) {
            console.error("Error fetching location name:", error);
            return t.locationUnavailable;
        }
    };

    // --- Auth Functions ---
    const signInWithGoogle = async (): Promise<User | null> => {
        const provider = new GoogleAuthProvider();
        try {
            setError(null);
            const result = await signInWithPopup(auth, provider);
            return result.user;
        } catch (error: any) {
            console.error("Authentication error:", error.code, error.message);
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                case 'auth/cancelled-popup-request':
                    // Not an error to display to the user.
                    break;
                case 'auth/popup-blocked':
                    setError(t.signInPopupBlockedError);
                    break;
                default:
                    setError(t.signInError);
                    break;
            }
            return null;
        }
    };

    const handleSignOut = async () => {
        try {
            await firebaseSignOut(auth);
            setSelectedSession(null);
            setActiveTab('record');
        } catch (error) {
            console.error("Sign out error:", error);
        }
    };

    // --- Recording Logic ---
    const handleStartRecordingClick = async () => {
        if (isRecording) {
            handleStopRecording();
            return;
        }

        if (!user) {
            const signedInUser = await signInWithGoogle();
            if (signedInUser) {
                await startRecordingContinuation();
            }
        } else {
            await startRecordingContinuation();
        }
    };

    const startRecordingContinuation = async () => {
        setError(null);
        try {
            // Request permission first to enumerate devices with labels
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
            setAvailableDevices(audioInputDevices);
            setShowDeviceSelector(true);
            // Stop the temporary stream used for permission request
            stream.getTracks().forEach(track => track.stop());
        } catch (err) {
            console.error("Microphone access error:", err);
            setError(t.micPermissionError);
        }
    };

    const handleDeviceSelected = async (deviceId: string) => {
        if (!auth.currentUser) return; // Should not happen if logic is correct
        const currentUser = auth.currentUser;
        setShowDeviceSelector(false);
        audioChunksRef.current = [];

        // Create a preliminary session document in Firestore
        const newSessionId = `session_${Date.now()}`;
        const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', newSessionId);

        try {
             const location = await getGeolocation();
             let locationName = t.locationUnavailable;
             let mapUrl = '';
             if (location) {
                 locationName = await fetchLocationName(location.coords.latitude, location.coords.longitude);
                 mapUrl = `https://www.google.com/maps?q=${location.coords.latitude},${location.coords.longitude}`;
             }

             // Create a preliminary session object to show in the UI immediately
             const preliminarySession: Omit<Session, 'id' | 'results' | 'speakers'> = {
                 metadata: {
                     title: `Meeting - ${new Date().toLocaleString()}`,
                     date: new Date().toISOString(),
                     location: locationName,
                     mapUrl: mapUrl
                 },
                 status: 'processing',
             };
            await setDoc(sessionDocRef, preliminarySession);
            // Add the new session to the local state to make it appear instantly
            const newSessionData = { ...preliminarySession, id: newSessionId, results: { transcript: '', summary: '', actionItems: [] }, speakers: {} };
            setSelectedSession(newSessionData);
            setSessions(prev => [newSessionData, ...prev]);
            setActiveTab('sessions');

        } catch (e) {
             console.error("Error creating preliminary session:", e);
             setError("Could not create a new session document.");
             return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: deviceId ? { exact: deviceId } : undefined }
            });

            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                setIsSaving(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                if (audioBlob.size === 0 || recordingTime < 2) {
                    setError(t.recordingTooShortError);
                    await deleteDoc(sessionDocRef); // Clean up failed session
                    setIsSaving(false);
                    return;
                }

                if (!navigator.onLine) {
                    setError(t.offlineError);
                    await updateDoc(sessionDocRef, { status: 'error', error: t.offlineError });
                    setIsSaving(false);
                    return;
                }

                try {
                    // Upload to Firebase Storage
                    const storageRef = ref(storage, `recordings/${currentUser.uid}/${newSessionId}.webm`);
                    await uploadBytes(storageRef, audioBlob);

                    // Trigger Cloud Function
                    const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                    await analyzeAudio({ sessionId: newSessionId });
                    // The onSnapshot listener will handle the UI update when processing is complete

                } catch (e) {
                    console.error("Error saving or processing session:", e);
                    setError(t.processingError);
                    await updateDoc(sessionDocRef, { status: 'error', error: t.processingError });
                } finally {
                    setIsSaving(false);
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            if(recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prevTime => prevTime + 1);
            }, 1000);

            // Handle Screen Wake Lock
            if (keepAwake && 'wakeLock' in navigator) {
                try {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                } catch (err: any) {
                    console.error(`${err.name}, ${err.message}`);
                }
            }
        } catch (err) {
            console.error("Error starting recording with device:", err);
            setError(t.micPermissionError);
            await deleteDoc(sessionDocRef); // Clean up failed session
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
            if (pipWindowRef.current) {
                pipWindowRef.current.close();
                pipWindowRef.current = null;
            }
            if (wakeLockRef.current) {
                wakeLockRef.current.release().then(() => {
                    wakeLockRef.current = null;
                });
            }
        }
    };

    // --- Session Management ---
    const handleDeleteSession = async (sessionId: string) => {
        if (!user || !window.confirm(t.deleteConfirmation)) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
            await deleteObject(ref(storage, `recordings/${user.uid}/${sessionId}.webm`));
            setSelectedSession(null);
            setActiveTab('sessions');
        } catch (error) {
            console.error("Error deleting session:", error);
            setError("Failed to delete session.");
        }
    };

    const handleUpdateSpeakerName = async (sessionId: string, speakerId: string, newName: string) => {
        if (!user || !newName.trim()) return;
        const sessionDocRef = doc(db, 'users', user.uid, 'sessions', sessionId);
        try {
            await updateDoc(sessionDocRef, {
                [`speakers.${speakerId}`]: newName.trim()
            });
            setEditingSpeaker(null);
        } catch (error) {
            console.error("Error updating speaker name:", error);
            setError("Failed to update speaker name.");
        }
    };

    // --- Gemini Actions ---
    const handleTakeAction = async (item: string, session: Session) => {
        try {
            const prompt = t.actionPrompt
                .replace('{meetingTitle}', session.metadata.title)
                .replace('{meetingDate}', new Date(session.metadata.date).toLocaleDateString())
                .replace('{meetingSummary}', session.results.summary)
                .replace('{actionItemText}', item);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: prompt }] }],
                config: { tools: [{ functionDeclarations: tools }] },
            });

            const functionCalls = response.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                setShowActionModal({ type: call.name, args: call.args, sourceItem: item });
            } else {
                setShowActionModal({ type: 'unknown', sourceItem: item });
            }
        } catch (err) {
            console.error("Error in handleTakeAction:", err);
            setShowActionModal({ type: 'error' });
        }
    };


    // --- PiP Window Logic ---
    useEffect(() => {
        const channel = pipChannelRef.current;
        const handlePipMessage = (event: MessageEvent) => {
            if (event.data.type === 'stop_recording') {
                handleStopRecording();
            } else if (event.data.type === 'pip_ready') {
                // When PiP window says it's ready, send it the current state
                channel.postMessage({ type: 'state_update', isRecording, recordingTime });
            }
        };
        channel.addEventListener('message', handlePipMessage);
        return () => channel.removeEventListener('message', handlePipMessage);
    }, [isRecording, recordingTime]); // Re-bind if these state vars change

    useEffect(() => {
        // Send time updates to the PiP window continuously
        if (isRecording) {
            pipChannelRef.current.postMessage({ type: 'time_update', time: recordingTime });
        }
    }, [recordingTime, isRecording]);

    const togglePip = async () => {
        if (pipWindowRef.current) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
        } else if (isRecording) {
            const pip = await window.open('/pip.html', 'VerbatimPIP', 'width=350,height=80,popup');
            pipWindowRef.current = pip;
            // Clear the reference when the user closes the window
            pipWindowRef.current?.addEventListener('beforeunload', () => {
                pipWindowRef.current = null;
            });
        }
    };

    // --- RENDER LOGIC ---

    if (isLoading) {
        return <div style={styles.loadingContainer}>Loading...</div>;
    }

    const renderContent = () => {
      if (selectedSession) {
        return <SessionDetailView
                    session={selectedSession}
                    onBack={() => setSelectedSession(null)}
                    onDelete={handleDeleteSession}
                    onTakeAction={handleTakeAction}
                    onUpdateSpeakerName={handleUpdateSpeakerName}
                    editingSpeaker={editingSpeaker}
                    setEditingSpeaker={setEditingSpeaker}
                />;
      }
      switch (activeTab) {
        case 'sessions':
           if (!user) {
                return <LoginView prompt={t.signInToView} onSignIn={signInWithGoogle} />;
           }
           return <SessionsListView sessions={sessions} onSelectSession={setSelectedSession} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />;
        case 'record':
        default:
          return <RecordView />;
      }
    };

    const renderBottomNav = () => (
      <nav style={styles.bottomNav}>
        <button
          style={{...styles.navButton, ...(activeTab === 'record' ? styles.navButtonActive : {})}}
          onClick={() => { setSelectedSession(null); setActiveTab('record'); }}
          aria-current={activeTab === 'record'}
        >
          {t.record}
        </button>
        <button
          style={{...styles.navButton, ...(activeTab === 'sessions' ? styles.navButtonActive : {})}}
          onClick={() => { setSelectedSession(null); setActiveTab('sessions'); }}
          aria-current={activeTab === 'sessions'}
        >
          {t.sessions}
        </button>
      </nav>
    );

    // --- SUB-COMPONENTS ---

    const LoginView = ({ prompt, onSignIn }: { prompt: string, onSignIn: () => void }) => (
        <div style={styles.loginView}>
            <div style={styles.logo}>
                <svg width="48" height="48" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="192" height="192" rx="48" fill="#181818"/><path d="M48 68L80 124L112 68" stroke="#00DAC6" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/><path d="M112 124V68" stroke="#00DAC6" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/><path d="M144 68L144 124" stroke="white" strokeOpacity="0.6" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/><path d="M128 80L128 112" stroke="white" strokeOpacity="0.6" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <h1>{t.title}</h1>
            </div>
            <p>{prompt}</p>
            <button onClick={onSignIn} style={styles.signInButton}>{t.signIn}</button>
        </div>
    );

    const RecordView = () => {
        const formatTime = (seconds: number) => {
          const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
          const secs = (seconds % 60).toString().padStart(2, '0');
          return `${mins}:${secs}`;
        };

        return (
            <div style={styles.recordView}>
              <div style={styles.recordHeader}>
                 <div style={styles.logo}>
                    <svg width="32" height="32" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="192" height="192" rx="48" fill="#181818"/><path d="M48 68L80 124L112 68" stroke="#00DAC6" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/><path d="M112 124V68" stroke="#00DAC6" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/><path d="M144 68L144 124" stroke="white" strokeOpacity="0.6" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/><path d="M128 80L128 112" stroke="white" strokeOpacity="0.6" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span>{t.title}</span>
                 </div>
                 {user ?
                    <button onClick={handleSignOut} style={styles.logoutButton}>{t.signOut}</button> :
                    <button onClick={signInWithGoogle} style={styles.logoutButton}>{t.signIn}</button>
                 }
              </div>
              <div style={styles.recordButtonContainer}>
                  <button
                      style={{...styles.recordButton, ...(isRecording ? styles.recordButtonRecording : {})}}
                      onClick={handleStartRecordingClick}
                      aria-label={isRecording ? t.stopRecording : t.startRecording}
                  >
                      {isRecording ? '⏹️' : '🎤'}
                  </button>
                  <p style={styles.recordButtonText}>
                      {isRecording ? formatTime(recordingTime) : (user ? t.tapToRecord : t.signInToRecord)}
                  </p>
                   <div style={styles.statusContainer}>
                     {isSaving && <p>{t.processing}</p>}
                     {error && <p style={styles.errorText}>{error}</p>}
                   </div>
              </div>
               <div style={styles.recordFooter}>
                  <div style={styles.settingsContainer}>
                      <label style={styles.toggleSwitchLabel}>
                          <span>{t.keepAwake}</span>
                          <div style={styles.toggleSwitch}>
                              <input
                                  type="checkbox"
                                  checked={keepAwake}
                                  onChange={() => setKeepAwake(!keepAwake)}
                                  style={styles.toggleSwitchInput}
                                  aria-label={t.keepAwake}
                              />
                              <span className="toggle-switch-slider"></span>
                          </div>
                      </label>
                      <p style={styles.settingInfoText}>{t.keepAwakeInfo}</p>
                  </div>
                  {isRecording && getPlatform() === 'macos' && <button style={styles.secondaryButton} onClick={togglePip}>{t.toggleMiniView}</button>}
              </div>
            </div>
        );
    };

    const SessionsListView = ({sessions, onSelectSession, searchQuery, setSearchQuery}: {sessions: Session[], onSelectSession: (session: Session) => void, searchQuery: string, setSearchQuery: (q: string) => void}) => {
        const filteredSessions = sessions.filter(s =>
            s.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.results?.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.results?.transcript?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (!user) return null;

        return (
            <div style={styles.sessionsView}>
                <div style={styles.sessionsHeader}>
                    <h2>{t.recentSessions}</h2>
                    <input
                        type="search"
                        placeholder={t.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
                {filteredSessions.length > 0 ? (
                    <ul style={styles.sessionsList}>
                        {filteredSessions.map(session => (
                            <li key={session.id} style={styles.sessionItem} onClick={() => onSelectSession(session)} role="button" tabIndex={0}>
                                <div style={styles.sessionItemInfo}>
                                    <strong style={styles.sessionItemTitle}>{session.metadata.title}</strong>
                                    <span style={styles.sessionItemDate}>{new Date(session.metadata.date).toLocaleDateString()}</span>
                                </div>
                                <div style={styles.sessionItemStatus}>
                                    {session.status === 'processing' && <span style={styles.processingChip}>{t.processing}</span>}
                                    {session.status === 'error' && <span style={styles.errorChip}>Error</span>}
                                    <span>&gt;</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div style={styles.welcomeContainer}>
                        <h3>{t.welcomeMessage}</h3>
                        <p>{t.welcomeSubtext}</p>
                    </div>
                )}
            </div>
        );
    };

    const SessionDetailView = ({session, onBack, onDelete, onTakeAction, onUpdateSpeakerName, editingSpeaker, setEditingSpeaker}:
        {session: Session, onBack: () => void, onDelete: (id: string) => void, onTakeAction: (item: string, session: Session) => void,
         onUpdateSpeakerName: (sessionId: string, speakerId: string, newName: string) => void,
         editingSpeaker: EditingSpeaker | null, setEditingSpeaker: (speaker: EditingSpeaker | null) => void}) => {

        const renderTranscript = () => {
            if (!session.results?.transcript) return t.noTranscript;
            let displayTranscript = session.results.transcript;
            // Replace speaker labels with custom names if they exist
            if (session.speakers) {
                for (const [originalLabel, customName] of Object.entries(session.speakers)) {
                    if (originalLabel !== customName) {
                        // Use a regex to replace all occurrences of the speaker label
                        displayTranscript = displayTranscript.replace(new RegExp(`<strong>${originalLabel}:</strong>`, 'g'), `<strong>${customName}:</strong>`);
                    }
                }
            }
            return <div dangerouslySetInnerHTML={{ __html: marked.parse(displayTranscript) }} />;
        };
        
        const handleSpeakerNameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).elements.namedItem('speakerName') as HTMLInputElement;
            if (editingSpeaker && input) {
                onUpdateSpeakerName(editingSpeaker.sessionId, editingSpeaker.speakerId, input.value);
            }
        };

        return (
            <div style={styles.detailView}>
                <div style={styles.detailHeader}>
                    <button onClick={onBack} style={styles.backButton}>&lt; {t.backToList}</button>
                    <button onClick={() => onDelete(session.id)} style={styles.deleteButton}>{t.deleteSession}</button>
                </div>
                 <h2>{session.metadata.title}</h2>
                 <p style={styles.detailMeta}>{new Date(session.metadata.date).toLocaleString()}</p>
                 <p style={styles.detailMeta}>{t.meetingLocation} <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer">{session.metadata.location}</a></p>
                 
                 {session.status === 'completed' && session.results ? (
                     <div>
                         <Accordion title={t.summaryHeader} defaultOpen>
                            <div style={styles.contentBlock} dangerouslySetInnerHTML={{ __html: marked.parse(session.results.summary || t.noSummary) }}></div>
                         </Accordion>
                         <Accordion title={t.actionItemsHeader} defaultOpen>
                            <ul style={styles.actionItemsList}>
                            {session.results.actionItems.length > 0 ? session.results.actionItems.map((item, index) => (
                                <li key={index} style={styles.actionItem}>
                                  <span>{item}</span>
                                  <button style={styles.takeActionButton} onClick={() => onTakeAction(item, session)}>{t.takeAction}</button>
                                </li>
                            )) : <li>No action items identified.</li>}
                            </ul>
                         </Accordion>
                         <Accordion title={t.speakersHeader}>
                             <ul style={styles.speakersList}>
                                {Object.entries(session.speakers || {}).map(([id, name]) => (
                                    <li key={id} style={styles.speakerItem}>
                                        {editingSpeaker?.speakerId === id ? (
                                            <form onSubmit={handleSpeakerNameSubmit}>
                                                <input
                                                    name="speakerName"
                                                    type="text"
                                                    defaultValue={name}
                                                    onBlur={(e) => onUpdateSpeakerName(session.id, id, e.target.value)}
                                                    autoFocus
                                                    style={styles.speakerInput}
                                                />
                                            </form>
                                        ) : (
                                            <>
                                             <span>{name}</span>
                                             <button onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })} style={styles.editSpeakerButton}>✏️</button>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                         </Accordion>
                         <Accordion title={t.transcriptHeader}>
                             <div style={styles.transcriptContainer}>{renderTranscript()}</div>
                         </Accordion>
                     </div>
                 ) : session.status === 'processing' ? (
                     <p>{t.processing}</p>
                 ) : (
                     <p style={styles.errorText}>{session.error || t.processingError}</p>
                 )
                }
            </div>
        );
    };
    
    // --- FINAL RENDER ---
    return (
        <div style={styles.appContainer}>
            <main style={styles.mainContent}>
              {renderContent()}
            </main>
            {!selectedSession && renderBottomNav()}
            {showDeviceSelector && (
                 <Modal title={t.selectAudioDeviceTitle} onClose={() => setShowDeviceSelector(false)}>
                    <div style={styles.modalContent}>
                       <p>{t.selectAudioDeviceInstruction}</p>
                       <ul style={styles.deviceList}>
                            {availableDevices.map(device => (
                                <li key={device.deviceId} style={styles.deviceItem} onClick={() => handleDeviceSelected(device.deviceId)}>
                                    {device.label || `Microphone ${availableDevices.indexOf(device) + 1}`}
                                </li>
                            ))}
                       </ul>
                    </div>
                </Modal>
            )}
            {showActionModal && <ActionModal data={showActionModal} user={user} onClose={() => setShowActionModal(null)} />}

        </div>
    );
};

// --- MODALS and OTHER SUB-COMPONENTS ---

const Modal = ({ title, onClose, children }: ModalProps) => (
    <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
                <h3>{title}</h3>
                <button style={styles.modalCloseButton} onClick={onClose}>&times;</button>
            </div>
            <div style={styles.modalBody}>
                {children}
            </div>
        </div>
    </div>
);

const ActionModal = ({ data, user, onClose }: { data: ActionModalData, user: User | null, onClose: () => void}) => {
    // This is a large component to handle the different action types.
    // In a real app, this would be broken into smaller components.
    const { type, args, sourceItem } = data;
    const [copied, setCopied] = useState(false);

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    
    const renderActionContent = () => {
        switch (type) {
            case 'create_calendar_event': {
                const { title, description, date, time } = args;
                const start = `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}00`;
                const url = new URL('https://calendar.google.com/calendar/render');
                url.searchParams.set('action', 'TEMPLATE');
                url.searchParams.set('text', title);
                url.searchParams.set('details', description);
                url.searchParams.set('dates', `${start}/${start}`);
                return (
                    <div>
                        <h4>{t.createCalendarEvent}</h4>
                        <p><strong>{t.titleLabel}</strong> {title}</p>
                        <p><strong>{t.descriptionLabel}</strong> {description}</p>
                        <p><strong>{t.dateLabel}</strong> {date} <strong>{t.timeLabel}</strong> {time}</p>
                        <a href={url.toString()} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInCalendar}</a>
                    </div>
                );
            }
            case 'draft_email': {
                const { to, subject, body } = args;
                const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                return (
                    <div>
                        <h4>{t.draftEmail}</h4>
                        <p><strong>{t.toLabel}</strong> {to}</p>
                        <p><strong>{t.subjectLabel}</strong> {subject}</p>
                        <p><strong>{t.bodyLabel}</strong> <pre style={styles.preformattedText}>{body}</pre></p>
                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInEmailApp}</a>
                    </div>
                );
            }
            case 'draft_invoice_email': {
                 const { recipient_name, item_description, amount } = args;
                 const userName = user?.displayName || '';
                 const currencySymbol = '$'; // Could be localized
                 const body = t.invoiceEmailBody
                     .replace('{recipientName}', recipient_name)
                     .replace('{itemDescription}', sourceItem || item_description)
                     .replace('{currencySymbol}', currencySymbol)
                     .replace('{amount}', amount)
                     .replace('{userName}', userName);
                 const subject = `Invoice for ${item_description}`;
                 const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                 return (
                    <div>
                        <h4>{t.draftInvoiceEmail}</h4>
                        <p><strong>{t.recipientNameLabel}</strong> {recipient_name}</p>
                        <p><strong>{t.amountLabel}</strong> {currencySymbol}{amount}</p>
                        <p><strong>{t.bodyLabel}</strong> <pre style={styles.preformattedText}>{body}</pre></p>
                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInEmailApp}</a>
                    </div>
                 );
            }
            case 'initiate_phone_call': {
                const { phone_number, reason } = args;
                return (
                    <div>
                        <h4>{t.initiatePhoneCall}</h4>
                        <p><strong>{t.phoneNumberLabel}</strong> {phone_number}</p>
                        <p><strong>{t.reasonLabel}</strong> {reason}</p>
                        <a href={`tel:${phone_number}`} style={styles.actionButton}>{t.callNow}</a>
                    </div>
                );
            }
            case 'create_google_doc': {
                 const { title, content } = args;
                 return (
                    <div>
                        <h4>{t.createDocument}</h4>
                        <p>{t.createDocInfo}</p>
                        <p><strong>{t.suggestedTitle}</strong> {title}</p>
                        <p><strong>{t.suggestedContent}</strong> <pre style={styles.preformattedText}>{content}</pre></p>
                        <button style={styles.actionButton} onClick={() => {
                            handleCopyToClipboard(content);
                            window.open(`https://docs.google.com/document/create?title=${encodeURIComponent(title)}`, '_blank');
                        }}>{copied ? t.copiedSuccess : t.openGoogleDocs}</button>
                    </div>
                 );
            }
            case 'error':
                 return <p style={styles.errorText}>{t.actionError}</p>;
            default:
                return <p>{t.noActionDetermined}</p>;
        }
    };
    
    const titleMap: Record<string, string> = {
        create_calendar_event: t.createCalendarEvent,
        draft_email: t.draftEmail,
        draft_invoice_email: t.draftInvoiceEmail,
        initiate_phone_call: t.initiatePhoneCall,
        create_google_doc: t.createDocument,
    };
    
    return (
        <Modal title={titleMap[type] || t.takeAction} onClose={onClose}>
             <div style={styles.modalContent}>
                <p style={styles.sourceItemText}><em>"{sourceItem}"</em></p>
                {renderActionContent()}
            </div>
        </Modal>
    );
};


const Accordion = ({ title, children, defaultOpen = false }: AccordionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden' }}>
            <button style={styles.accordionHeader} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
                {title}
                <span>{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
                <div style={styles.accordionContent}>
                    {children}
                </div>
            )}
        </div>
    );
};

// --- STYLES ---
const styles: { [key: string]: CSSProperties } = {
  appContainer: {
    fontFamily: "'Poppins', sans-serif",
    backgroundColor: '#0D0D0D',
    color: '#E0E0E0',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    paddingBottom: '60px', // Space for bottom nav
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#0D0D0D',
    color: '#E0E0E0',
    fontSize: '1.5rem',
  },
  loginView: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#00DAC6',
    color: '#0D0D0D',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '20px',
  },
  recordView: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    height: 'calc(100dvh - 60px)',
  },
  recordHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#00DAC6'
  },
  logoutButton: {
    background: 'none',
    border: '1px solid #444',
    color: '#E0E0E0',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  recordButtonContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  recordButton: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#00DAC6',
    color: '#0D0D0D',
    fontSize: '4rem',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.3s ease',
    boxShadow: '0 0 20px rgba(0, 218, 198, 0.4)',
  },
  recordButtonRecording: {
     backgroundColor: '#FF4136',
     boxShadow: '0 0 25px rgba(255, 65, 54, 0.6)',
     animation: 'pulse 1.5s infinite',
  },
  recordButtonText: {
    marginTop: '20px',
    fontSize: '1.2rem',
    color: '#aaa'
  },
  statusContainer: {
    minHeight: '24px',
    marginTop: '15px',
    textAlign: 'center',
  },
  recordFooter: {
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '20px',
      padding: '0 20px 20px 20px',
  },
  errorText: {
      color: '#FF4136',
  },
  bottomNav: {
    display: 'flex',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a1a',
    padding: '10px 0',
    borderTop: '1px solid #333',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  navButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '1rem',
    padding: '10px 20px',
    cursor: 'pointer',
    flex: 1,
  },
  navButtonActive: {
    color: '#00DAC6',
    fontWeight: 'bold',
  },
  sessionsView: {
    padding: '20px',
  },
  sessionsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  searchInput: {
    backgroundColor: '#222',
    border: '1px solid #444',
    color: '#eee',
    borderRadius: '8px',
    padding: '8px 12px',
  },
  sessionsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  sessionItem: {
    backgroundColor: '#1a1a1a',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '10px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionItemInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  sessionItemTitle: {
    fontSize: '1.1rem',
    marginBottom: '5px',
  },
  sessionItemDate: {
    fontSize: '0.9rem',
    color: '#999',
  },
  sessionItemStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  processingChip: {
    backgroundColor: '#333',
    color: '#ccc',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
  },
  errorChip: {
    backgroundColor: '#500',
    color: '#fcc',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.8rem',
  },
  welcomeContainer: {
    textAlign: 'center',
    padding: '50px 20px',
    color: '#888',
  },
  detailView: {
    padding: '20px',
  },
  detailHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#00DAC6',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  deleteButton: {
    background: 'none',
    border: '1px solid #900',
    color: '#f88',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  detailMeta: {
    color: '#aaa',
    fontSize: '0.9rem',
    margin: '4px 0',
  },
  contentBlock: {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
  },
  actionItemsList: {
    listStyle: 'none',
    padding: 0,
  },
  actionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #333',
  },
  takeActionButton: {
    background: '#00DAC6',
    color: '#111',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    marginLeft: '10px',
  },
  speakersList: {
    listStyle: 'none',
    padding: 0,
  },
  speakerItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 0',
  },
  editSpeakerButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  speakerInput: {
    backgroundColor: '#333',
    color: '#eee',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 8px',
  },
  transcriptContainer: {
    backgroundColor: '#1a1a1a',
    padding: '15px',
    borderRadius: '8px',
    maxHeight: '400px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
  },
  accordionHeader: {
    backgroundColor: '#1f1f1f',
    padding: '15px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    color: '#eee',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #333'
  },
  accordionContent: {
    padding: '15px',
    backgroundColor: '#1a1a1a',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  modalContainer: {
    backgroundColor: '#1E1E1E',
    padding: '20px',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #444',
    paddingBottom: '10px',
    marginBottom: '15px',
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
  modalBody: {},
  modalContent: {
    lineHeight: 1.6,
  },
  deviceList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  deviceItem: {
    padding: '12px',
    border: '1px solid #444',
    borderRadius: '8px',
    marginBottom: '10px',
    cursor: 'pointer',
    textAlign: 'center',
    backgroundColor: '#2a2a2a',
  },
  actionButton: {
      display: 'inline-block',
      marginTop: '15px',
      padding: '10px 20px',
      backgroundColor: '#00DAC6',
      color: '#111',
      textDecoration: 'none',
      borderRadius: '8px',
      fontWeight: 'bold',
  },
  preformattedText: {
    whiteSpace: 'pre-wrap',
    backgroundColor: '#2a2a2a',
    padding: '10px',
    borderRadius: '6px',
    maxHeight: '150px',
    overflowY: 'auto',
  },
  sourceItemText: {
    color: '#aaa',
    borderLeft: '3px solid #00DAC6',
    paddingLeft: '10px',
    marginBottom: '15px',
  },
  secondaryButton: {
    background: 'none',
    border: '1px solid #444',
    color: '#E0E0E0',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  settingsContainer: {
      width: '100%',
      maxWidth: '300px',
  },
  toggleSwitchLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'pointer',
      fontSize: '1rem',
      width: '100%',
  },
  toggleSwitch: {
      position: 'relative',
      display: 'inline-block',
      width: '50px',
      height: '28px',
  },
  toggleSwitchInput: {
      opacity: 0,
      width: 0,
      height: 0,
  },
  settingInfoText: {
      fontSize: '0.8rem',
      color: '#888',
      marginTop: '8px',
      textAlign: 'left',
      width: '100%'
  },
};


// Add keyframes for animation
const styleSheet = document.createElement("style")
styleSheet.type = "text/css"
styleSheet.innerText = `
  @keyframes pulse {
    0% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(255, 65, 54, 0.7);
    }
    70% {
      transform: scale(1);
      box-shadow: 0 0 0 20px rgba(255, 65, 54, 0);
    }
    100% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(255, 65, 54, 0);
    }
  }

  /* Toggle Switch Styles */
  .toggle-switch-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #444;
    -webkit-transition: .4s;
    transition: .4s;
    border-radius: 28px;
  }

  .toggle-switch-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    -webkit-transition: .4s;
    transition: .4s;
    border-radius: 50%;
  }

  input:checked + .toggle-switch-slider {
    background-color: #00DAC6;
    box-shadow: 0 0 8px rgba(0, 218, 198, 0.7);
  }

  input:focus + .toggle-switch-slider {
    box-shadow: 0 0 1px #00DAC6;
  }

  input:checked + .toggle-switch-slider:before {
    -webkit-transform: translateX(22px);
    -ms-transform: translateX(22px);
    transform: translateX(22px);
  }
`;
document.head.appendChild(styleSheet);


const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
