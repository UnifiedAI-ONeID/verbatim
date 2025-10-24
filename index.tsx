

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
type User = { id: string; name: string; email: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };

// --- Mock Database Service ---
// This service simulates a persistent cloud database using localStorage for robustness
// and to maintain state across page reloads. It returns promises to mimic
// real async database calls.
const dbService = {
    getUser: async (): Promise<User | null> => {
        const userJson = localStorage.getItem('verbatim_user');
        return userJson ? JSON.parse(userJson) : null;
    },
    createUser: async (name: string, email: string): Promise<User> => {
        const user = { id: `user_${Date.now()}`, name, email };
        localStorage.setItem('verbatim_user', JSON.stringify(user));
        return user;
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
        stopRecording: '⏹️ Stop Recording',
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
        loginTitle: 'Create Your Account',
        loginSubtitle: 'To begin, create a free account to save and manage your sessions.',
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
                a: 'Click the "🎤 New Session" button. If it\'s your first time, you\'ll be asked to create an account. Then, you\'ll be prompted to select your preferred microphone. Once you click "Start," the recording will begin immediately.',
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
    },
    es: {
        title: 'Verbatim',
        subtitle: 'Tu panel de reuniones inteligente.',
        welcomeUser: 'Bienvenido, {name}',
        startRecording: '🎤 Nueva Sesión',
        stopRecording: '⏹️ Detener Grabación',
        analyzing: 'Analizando...',
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
        loginTitle: 'Crear Cuenta',
        loginSubtitle: 'Para comenzar, crea una cuenta gratuita para guardar y gestionar tus sesiones.',
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
                a: 'Haz clic en el botón "🎤 Nueva Sesión". Si es tu primera vez, se te pedirá que crees una cuenta. Luego, se te pedirá que selecciones tu micrófono preferido. Una vez que hagas clic en "Comenzar", la grabación se iniciará de inmediato.',
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
                a: 'La información de tu cuenta y todos los datos de la sesión se almacenan en una base de datos simulada en la nube que utiliza el almacenamiento local de tu navegador para persistencia. Esto te permite acceder a tus datos entre recargas del navegador. Ningún dato se envía o almacena en ningún servidor externo, excepto para el procesamiento temporal del audio por la API de Gemini durante el análisis.',
            },
        ],
    },
    'zh-CN': {
        title: 'Verbatim',
        subtitle: '您的智能会议仪表板。',
        welcomeUser: '欢迎，{name}',
        startRecording: '🎤 新建会话',
        stopRecording: '⏹️ 停止录音',
        analyzing: '正在分析...',
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
        analysisPrompt: '你是一位专业的多语言会议助理。用户的首选语言是简体中文。请分析接下来的会议音频，其中可能包含多种口语语言。你的任务是处理这段多语言音频，并仅以简体中文生成所有输出。请提供简明的摘要、行动项列表，以及带有发言人标签（例如，发言人1，发言人2）的完整文字记录。在摘要中，请特别注意并清晰地列出任何提及的财务数据、预算或成本。识别所有独立发言人。所有输出文本（摘要、行动项、文字记录）必须翻译成并以简体中文书写。将输出格式化为 JSON 对象，键为："summary"、"actionItems"（字符串数组）、"transcript"（带换行符和发言人标签的字符串），以及 "speakers"（已识别的发言人标签数组，如 ["发言人 1", "发言人 2"]）。不要包含 JSON 的 markdown 包装。',
        actionPrompt: '你是一个智能助理。请根据会议的完整背景和具体的行动项，调用最合适的工具来帮助用户完成它。用户的语言是简体中文。会议标题：“{meetingTitle}”。会议日期：“{meetingDate}”。会议摘要：“{meetingSummary}”。行动项：“{actionItemText}”。确保所有生成的内容（如邮件主题或活动描述）都与会议背景相关。',
        featureShowcase: 'Verbatim 功能',
        createdBy: '创建者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: ' lovingly dedicated to my family, all the busy moms out there, and the creator. ❤️',
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
        loginTitle: '创建您的账户',
        loginSubtitle: '要开始，请创建一个免费账户以保存和管理您的会话。',
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
                a: '点击“🎤 新建会话”按钮。如果是您第一次使用，系统会要求您创建一个帐户。然后，您将被提示选择您偏好的麦克风。点击“开始”后，录音将立即开始。',
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
                a: '您的帐户信息和所有会话数据都存储在一个模拟的云数据库中，该数据库使用您浏览器的本地存储来实现持久性。这使您可以在浏览器刷新后访问您的数据。除了在分析期间由 Gemini API 临时处理音频外，不会将任何数据发送到或存储在任何外部服务器上。',
            },
        ],
    },
     'zh-TW': {
        title: 'Verbatim',
        subtitle: '您的智慧會議儀表板。',
        welcomeUser: '歡迎，{name}',
        startRecording: '🎤 新增會話',
        stopRecording: '⏹️ 停止錄音',
        analyzing: '分析中...',
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
        welcomeSubtext: '點擊「新增會話」以錄製您的會議，讓人工智慧來處理筆記。',
        deleteSession: '刪除會話？',
        deleteConfirmation: '您確定要刪除此會話嗎？此操作無法撤銷。',
        searchPlaceholder: '搜尋會話...',
        toggleMiniView: '切換迷你視圖',
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
        actionPrompt: '你是一個智慧助理。請根據會議的完整背景和具體的行動項，呼叫最合適的工具來幫助使用者完成它。使用者的語言是繁體中文。會議標題：「{meetingTitle}」。會議日期：「{meetingDate}」。會議摘要：「{meetingSummary}」。行動項：「{actionItemText}」。確保所有生成的內容（如郵件主旨或活動描述）都與會議背景相關。',
        featureShowcase: 'Verbatim 功能',
        createdBy: '建立者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: ' lovingly dedicated to my family, all the busy moms out there, and the creator. ❤️',
        featureList: [
            '多語言AI分析',
            '自動摘要與行動項目',
            '完整逐字稿與發言人標示',
            '一鍵操作（日曆、Gmail、文件）',
            'Markdown 匯出與複製',
            '子母畫面迷你檢視',
            '離線 PWA 功能',
            '音訊來源選擇',
        ],
        consentTitle: '重要通知',
        consentInternalUse: '我確認此應用程式僅供 Impactory Institute 內部使用。',
        consentNoCopy: '我同意未經許可不複製或散佈此應用程式。',
        consentContinue: '接受並繼續',
        loginTitle: '建立您的帳戶',
        loginSubtitle: '要開始，請建立一個免費帳戶以儲存和管理您的會話。',
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
                a: '點擊「🎤 新增會話」按鈕。如果是您第一次使用，系統會要求您建立一個帳戶。然後，您將被提示選擇您偏好的麥克風。點擊「開始」後，錄音將立即開始。',
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
                a: '對於人工智慧識別的每個行動項，您可以點擊「執行操作 ✨」按鈕。人工智慧將確定最適合該任務的工具（例如建立日曆活動、草擬電子郵件或啟動文件），並為您預填必要的資訊。',
            },
            {
                q: '在另一個視窗時，如何使用錄音控制？',
                a: '在桌面瀏覽器上錄音時，點擊「切換迷你視圖」按鈕。這將開啟一個小的子母畫面視窗，其中包含一個計時器和一個「停止」按鈕，該視窗會保持在其他視窗的頂部，方便您輕鬆控制錄音。',
            },
            {
                q: '這個應用程式可以離線工作嗎？',
                a: '是的。Verbatim 是一個漸進式網路應用程式（PWA）。首次造訪後，您可以將其安裝在您的裝置上，以獲得類似應用程式的體驗。即使沒有網路連線，您也可以查看過去的會話。但是，分析新的錄音需要網路連線才能與人工智慧通訊。',
            },
            {
                q: '我的資料儲存在哪裡？',
                a: '您的帳戶資訊和所有會話資料都儲存在一個模擬的雲端資料庫中，該資料庫使用您瀏覽器的本機儲存體來實現持久性。這使您可以在瀏覽器重新整理後存取您的資料。除了在分析期間由 Gemini API 暫時處理音訊外，不會將任何資料傳送到或儲存在任何外部伺服器上。',
            },
        ],
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

const App = () => {
    // --- State Management ---
    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showActionModal, setShowActionModal] = useState<ActionModalData | null>(null);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [showDeviceSelector, setShowDeviceSelector] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [showFaq, setShowFaq] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);


    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<number | null>(null);
    const pipWindowRef = useRef<Window | null>(null);
    const pipChannelRef = useRef(new BroadcastChannel('verbatim_pip_channel'));
    const wakeLockRef = useRef<any>(null);


    // --- Data Fetching and Initialization ---
    useEffect(() => {
        const initializeApp = async () => {
            try {
                const existingUser = await dbService.getUser();
                if (existingUser) {
                    setUser(existingUser);
                    const userSessions = await dbService.getSessions(existingUser.id);
                    setSessions(userSessions);
                }
            } catch (err) {
                console.error("Initialization Error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        initializeApp();

        // Register service worker for PWA capabilities
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('SW registered: ', registration);
                }).catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
            });
        }
    }, []);
    
    // --- Pending Action Handler ---
    // This effect triggers the recording process after a user has been created
    // via the login modal.
    useEffect(() => {
        if (user && pendingAction === 'start_recording') {
            setPendingAction(null); // Clear the pending action
            startRecordingContinuation(); // Proceed with recording
        }
    }, [user, pendingAction]);

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
            // Using a free, no-API-key reverse geocoding service.
            // Replace with a more robust service like Google Maps Geocoding API for production.
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            if (!response.ok) throw new Error('Failed to fetch location name');
            const data = await response.json();
            return data.display_name || t.locationUnavailable;
        } catch (error) {
            console.error("Error fetching location name:", error);
            return t.locationUnavailable;
        }
    };


    // --- Recording Logic ---
    const handleStartRecordingClick = async () => {
        if (!user) {
            setPendingAction('start_recording');
            setShowLoginModal(true);
        } else {
            await startRecordingContinuation();
        }
    };

    const startRecordingContinuation = async () => {
        setError(null);
        try {
            // Check for microphone permissions
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Get available audio devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
            setAvailableDevices(audioInputDevices);
            setShowDeviceSelector(true);
            // Close the temp stream, a new one will be created with the selected device
            stream.getTracks().forEach(track => track.stop());
        } catch (err) {
            console.error("Microphone access error:", err);
            setError(t.micPermissionError);
        }
    };

    const handleDeviceSelected = async (deviceId: string) => {
        setShowDeviceSelector(false);
        audioChunksRef.current = [];
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: deviceId ? { exact: deviceId } : undefined }
            });

            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Check if recording is long enough to be meaningful
                if (audioBlob.size === 0 || recordingTime < 2) {
                    setError(t.recordingTooShortError);
                    setIsRecording(false);
                    return;
                }
                
                setIsAnalyzing(true);
                
                if (!navigator.onLine) {
                    setError(t.offlineError);
                    setIsAnalyzing(false);
                    return;
                }

                try {
                    const base64Audio = await blobToBase64(audioBlob);
                    const result = await analyzeAudio(base64Audio);

                    const location = await getGeolocation();
                    let locationName = t.locationUnavailable;
                    let mapUrl = '';
                    if (location) {
                        locationName = await fetchLocationName(location.coords.latitude, location.coords.longitude);
                        mapUrl = `https://www.google.com/maps?q=${location.coords.latitude},${location.coords.longitude}`;
                    }
                    
                    const newSession: Session = {
                        id: `session_${Date.now()}`,
                        metadata: {
                            title: `Meeting - ${new Date().toLocaleString()}`,
                            date: new Date().toISOString(),
                            location: locationName,
                            mapUrl: mapUrl
                        },
                        results: result,
                        speakers: result.speakers.reduce((acc, speaker) => ({...acc, [speaker]: speaker }), {})
                    };
                    
                    if (user) {
                        await dbService.saveSession(user.id, newSession);
                        const updatedSessions = await dbService.getSessions(user.id);
                        setSessions(updatedSessions);
                        setSelectedSession(newSession);
                    }
                } catch (e) {
                    console.error("Analysis Error:", e);
                    setError(t.processingError);
                } finally {
                    setIsAnalyzing(false);
                }

                 // Clean up stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prevTime => prevTime + 1);
            }, 1000);
            
             // Activate Wake Lock
            if ('wakeLock' in navigator) {
                try {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    console.log('Screen Wake Lock is active.');
                } catch (err: any) {
                    console.error(`${err.name}, ${err.message}`);
                }
            }

        } catch (err) {
            console.error("Error starting recording with device:", err);
            setError(t.micPermissionError);
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
            if (pipWindowRef.current) {
                pipWindowRef.current.close();
                pipWindowRef.current = null;
            }
            // Release Wake Lock
            if (wakeLockRef.current) {
                wakeLockRef.current.release().then(() => {
                    wakeLockRef.current = null;
                    console.log('Screen Wake Lock released.');
                });
            }
        }
    };
    
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = (reader.result as string).split(',')[1];
                resolve(base64data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };
    
    const analyzeAudio = async (base64Audio: string): Promise<MeetingResults & { speakers: string[] }> => {
        const audioPart = { inlineData: { mimeType: 'audio/webm', data: base64Audio } };
        const textPart = { text: t.analysisPrompt };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [audioPart, textPart] }],
        });

        const jsonString = response.text;
        const parsedResult = JSON.parse(jsonString);

        return {
            summary: parsedResult.summary || '',
            actionItems: parsedResult.actionItems || [],
            transcript: parsedResult.transcript || '',
            speakers: parsedResult.speakers || ['Speaker 1'],
        };
    };

    // --- PiP Window Logic ---
    useEffect(() => {
        const channel = pipChannelRef.current;
        const handlePipMessage = (event: MessageEvent) => {
            if (event.data.type === 'stop_recording') {
                handleStopRecording();
            } else if (event.data.type === 'pip_ready') {
                channel.postMessage({ type: 'state_update', isRecording, recordingTime });
            }
        };
        channel.addEventListener('message', handlePipMessage);
        return () => channel.removeEventListener('message', handlePipMessage);
    }, [isRecording, recordingTime]);

    useEffect(() => {
        pipChannelRef.current.postMessage({ type: 'time_update', time: recordingTime });
    }, [recordingTime]);

    const togglePip = async () => {
        if (pipWindowRef.current) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
        } else {
            const pip = await window.open('/pip.html', 'VerbatimPIP', 'width=350,height=80,popup');
            pipWindowRef.current = pip;
            pipWindowRef.current?.addEventListener('beforeunload', () => {
                pipWindowRef.current = null;
            });
        }
    };
    
     // --- UI and Data Handlers ---
    const handleSelectSession = (session: Session) => {
        setSelectedSession(session);
        setError(null);
    };

    const handleBackToList = () => {
        setSelectedSession(null);
    };
    
    const handleDeleteSession = async (sessionId: string) => {
        if (user && window.confirm(t.deleteConfirmation)) {
            await dbService.deleteSession(user.id, sessionId);
            const updatedSessions = await dbService.getSessions(user.id);
            setSessions(updatedSessions);
            if (selectedSession?.id === sessionId) {
                setSelectedSession(null);
            }
        }
    };
    
    const handleRenameSpeaker = async (sessionId: string, speakerId: string, newName: string) => {
        const sessionToUpdate = sessions.find(s => s.id === sessionId);
        if (user && sessionToUpdate && newName.trim()) {
            const updatedSpeakers = { ...sessionToUpdate.speakers, [speakerId]: newName.trim() };
            const updatedSession = { ...sessionToUpdate, speakers: updatedSpeakers };
            
            await dbService.saveSession(user.id, updatedSession);
            
            const updatedSessions = sessions.map(s => s.id === sessionId ? updatedSession : s);
            setSessions(updatedSessions);
            if (selectedSession?.id === sessionId) {
                setSelectedSession(updatedSession);
            }
        }
        setEditingSpeaker(null);
    };

    const handleCopyMarkdown = (session: Session) => {
        const markdown = generateMarkdown(session);
        navigator.clipboard.writeText(markdown).then(() => {
            alert(t.copiedSuccess);
        });
    };

    const handleDownloadMarkdown = (session: Session) => {
        const markdown = generateMarkdown(session);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const generateMarkdown = (session: Session) => {
        let transcriptText = session.results.transcript;
        Object.entries(session.speakers).forEach(([id, name]) => {
            // Use a regex to replace all occurrences of the speaker ID
            const regex = new RegExp(id, 'g');
            transcriptText = transcriptText.replace(regex, `**${name}**`);
        });

        return `
# ${session.metadata.title}
**Date:** ${new Date(session.metadata.date).toLocaleString()}
**Location:** ${session.metadata.location}

## ✨ ${t.summaryHeader}
${session.results.summary}

## 📌 ${t.actionItemsHeader}
${session.results.actionItems.map(item => `- ${item}`).join('\n')}

## 📋 ${t.transcriptHeader}
${transcriptText}
        `;
    };


    // --- Action Modal Logic ---
    const determineAction = async (actionItem: string, session: Session): Promise<ActionModalData> => {
        const createCalendarEvent: FunctionDeclaration = {
            name: 'create_calendar_event',
            description: 'Creates a Google Calendar event.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: 'The title of the event.' },
                    description: { type: Type.STRING, description: 'The description for the event.' },
                    date: { type: Type.STRING, description: 'The date of the event in YYYY-MM-DD format.' },
                    time: { type: Type.STRING, description: 'The time of the event in HH:MM format (24-hour).' },
                },
                required: ['title', 'date', 'time'],
            },
        };

        const draftEmail: FunctionDeclaration = {
            name: 'draft_email',
            description: 'Drafts an email.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    to: { type: Type.STRING, description: 'The recipient\'s email address. Can be a comma-separated list.' },
                    subject: { type: Type.STRING, description: 'The subject of the email.' },
                    body: { type: Type.STRING, description: 'The body content of the email.' },
                },
                required: ['to', 'subject', 'body'],
            },
        };
        
        const initiatePhoneCall: FunctionDeclaration = {
            name: 'initiate_phone_call',
            description: 'Initiates a phone call.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    phoneNumber: { type: Type.STRING, description: 'The phone number to call.' },
                    reason: { type: Type.STRING, description: 'A brief reason for the call.' },
                },
                required: ['phoneNumber'],
            },
        };
        
        const createDocument: FunctionDeclaration = {
            name: 'create_document',
            description: 'Creates a text document with a title and content.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: 'The suggested title for the document.' },
                    content: { type: Type.STRING, description: 'The suggested content for the document, often summarizing key points or drafting text.' },
                },
                required: ['title', 'content'],
            },
        };
        
        const draftInvoiceEmail: FunctionDeclaration = {
            name: 'draft_invoice_email',
            description: 'Drafts an email to send an invoice for a specific amount to a recipient. Use this for action items that explicitly state to send an invoice or bill someone for a service or product.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    to: { type: Type.STRING, description: "The recipient's email address." },
                    recipientName: { type: Type.STRING, description: "The recipient's full name." },
                    subject: { type: Type.STRING, description: "The subject line for the invoice email." },
                    amount: { type: Type.NUMBER, description: 'The numerical amount of money to be invoiced.' },
                    currencySymbol: { type: Type.STRING, description: 'The currency symbol for the amount, e.g., "$", "€", "¥".' },
                    itemDescription: { type: Type.STRING, description: 'A brief description of the service or item being invoiced.' },
                },
                required: ['to', 'recipientName', 'subject', 'amount', 'currencySymbol', 'itemDescription'],
            },
        };

        try {
             const prompt = t.actionPrompt
                .replace('{meetingTitle}', session.metadata.title)
                .replace('{meetingDate}', new Date(session.metadata.date).toLocaleDateString())
                .replace('{meetingSummary}', session.results.summary)
                .replace('{actionItemText}', actionItem);


            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: prompt }] }],
                config: { tools: [{ functionDeclarations: [createCalendarEvent, draftEmail, initiatePhoneCall, createDocument, draftInvoiceEmail] }] },
            });

            const fc = response.functionCalls?.[0];
            
            if (fc) {
                return { type: fc.name, args: fc.args, sourceItem: actionItem };
            } else {
                 return { type: 'no_action', sourceItem: actionItem };
            }
        } catch (error) {
            console.error("Error determining action:", error);
            setError(t.actionError);
            return { type: 'error' };
        }
    };
    
    const handleTakeAction = async (actionItem: string) => {
        if (selectedSession) {
            setIsAnalyzing(true);
            const actionData = await determineAction(actionItem, selectedSession);
            setShowActionModal(actionData);
            setIsAnalyzing(false);
        }
    };

    // --- Render Logic ---
    
    const filteredSessions = sessions.filter(session =>
        session.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.results.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.results.transcript.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderSpeaker = (sessionId: string, speakerId: string, speakers: Record<string, string>) => {
        const isEditing = editingSpeaker?.sessionId === sessionId && editingSpeaker?.speakerId === speakerId;

        if (isEditing) {
            return (
                <input
                    type="text"
                    defaultValue={speakers[speakerId]}
                    onBlur={(e) => handleRenameSpeaker(sessionId, speakerId, e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                           handleRenameSpeaker(sessionId, speakerId, (e.target as HTMLInputElement).value);
                        } else if (e.key === 'Escape') {
                            setEditingSpeaker(null);
                        }
                    }}
                    autoFocus
                    className="speaker-edit-input"
                />
            );
        }

        return (
            <span className="speaker-name">
                {speakers[speakerId]}
                <button
                    className="rename-speaker-btn"
                    onClick={() => setEditingSpeaker({ sessionId, speakerId })}
                    aria-label={`Rename ${speakers[speakerId]}`}
                >
                    ✏️
                </button>
            </span>
        );
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="app-container">
            <style>{globalStyles}</style>

            <Header user={user} onStartRecording={handleStartRecordingClick} isRecording={isRecording} onShowFaq={() => setShowFaq(true)} />
            
            <main>
                {selectedSession ? (
                    <SessionDetail
                        session={selectedSession}
                        onBack={handleBackToList}
                        onTakeAction={handleTakeAction}
                        onCopy={handleCopyMarkdown}
                        onDownload={handleDownloadMarkdown}
                        renderSpeaker={renderSpeaker}
                    />
                ) : (
                    <SessionList
                        sessions={filteredSessions}
                        onSelectSession={handleSelectSession}
                        onDeleteSession={handleDeleteSession}
                        searchQuery={searchQuery}
                        onSearchChange={(e) => setSearchQuery(e.target.value)}
                        user={user}
                    />
                )}
            </main>

            <Footer />

            {/* --- Modals --- */}
            {isAnalyzing && <LoadingModal text={t.analyzing} />}
            {error && <ErrorModal message={error} onClose={() => setError(null)} />}
            {showActionModal && <ActionModal data={showActionModal} onClose={() => setShowActionModal(null)} user={user} />}
            {showDeviceSelector && (
                <AudioDeviceSelector
                    devices={availableDevices}
                    onDeviceSelected={handleDeviceSelected}
                    onClose={() => setShowDeviceSelector(false)}
                />
            )}
             {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
             {showLoginModal && user === null && (
                 <LoginModal
                    onAccountCreated={(newUser) => {
                        setUser(newUser);
                        setShowLoginModal(false);
                    }}
                    onCancel={() => {
                        setShowLoginModal(false);
                        setPendingAction(null);
                    }}
                 />
             )}
            

            {/* --- Recording Controls --- */}
            {isRecording && (
                <RecordingControls
                    time={recordingTime}
                    onStop={handleStopRecording}
                    onTogglePip={togglePip}
                />
            )}
        </div>
    );
};

// --- Components ---

const Header = ({ user, onStartRecording, isRecording, onShowFaq }: { user: User | null; onStartRecording: () => void; isRecording: boolean; onShowFaq: () => void; }) => (
    <header className="app-header" style={{ opacity: isRecording ? 0 : 1, visibility: isRecording ? 'hidden' : 'visible' }}>
        <div className="logo-container">
            <img src="https://assets-global.website-files.com/6526ada137350b5030229339/6526b15a4606549340b6167c_II-logo-white-cropped.png" alt="Verbatim Logo" className="logo" />
            <h1>{t.title}</h1>
        </div>
        <div className="header-controls">
            {user && <span className="welcome-user">{t.welcomeUser.replace('{name}', user.name.split(' ')[0])}</span>}
            <button onClick={onStartRecording} className="start-recording-btn" aria-label={t.startRecording}>
                {t.startRecording}
            </button>
        </div>
    </header>
);

const SessionList = ({ sessions, onSelectSession, onDeleteSession, searchQuery, onSearchChange, user }: { sessions: Session[]; onSelectSession: (s: Session) => void; onDeleteSession: (id: string) => void; searchQuery: string; onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void; user: User | null }) => (
    <div className="session-list-container">
        <div className="list-header">
             <h2>{t.recentSessions}</h2>
             <input
                type="search"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={onSearchChange}
                className="search-input"
            />
        </div>
        {sessions.length > 0 ? (
            <ul className="session-list">
                {sessions.map(session => (
                    <li key={session.id} className="session-item" onClick={() => onSelectSession(session)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onSelectSession(session)}>
                        <div className="session-item-content">
                            <h3>{session.metadata.title}</h3>
                            <p>{new Date(session.metadata.date).toLocaleString()}</p>
                            <p className="summary-preview">{session.results.summary.slice(0, 100)}...</p>
                        </div>
                         <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }} aria-label={`${t.deleteSession} ${session.metadata.title}`}>
                            🗑️
                        </button>
                    </li>
                ))}
            </ul>
        ) : (
           user && <WelcomeScreen />
        )}
    </div>
);

const WelcomeScreen = () => (
    <div className="welcome-screen">
        <h2>{t.welcomeMessage}</h2>
        <p>{t.welcomeSubtext}</p>
         <div className="feature-showcase">
            <h3>{t.featureShowcase}</h3>
            <ul>
                {t.featureList.map((feature, index) => <li key={index}>{feature}</li>)}
            </ul>
        </div>
    </div>
);

// FIX: Changed renderSpeaker return type from JSX.Element to React.ReactNode to fix "Cannot find namespace 'JSX'" error.
const SessionDetail = ({ session, onBack, onTakeAction, onCopy, onDownload, renderSpeaker }: { session: Session; onBack: () => void; onTakeAction: (item: string) => void; onCopy: (s: Session) => void; onDownload: (s: Session) => void; renderSpeaker: (sessionId: string, speakerId: string, speakers: Record<string, string>) => React.ReactNode; }) => {
     const createMarkup = (htmlContent: string) => {
        return { __html: marked(htmlContent) };
    };
    
    let transcriptHtml = session.results.transcript;
    Object.entries(session.speakers).forEach(([id, name]) => {
        const regex = new RegExp(`(${id}):`, 'g');
        transcriptHtml = transcriptHtml.replace(regex, `<strong>${name}:</strong>`);
    });

    return (
        <div className="session-detail">
            <div className="detail-header">
                <button onClick={onBack} className="back-btn">&larr; {t.backToList}</button>
                 <div className="export-buttons">
                    <button onClick={() => onCopy(session)}>{t.copyMarkdown}</button>
                    <button onClick={() => onDownload(session)}>{t.downloadMarkdown}</button>
                </div>
            </div>
            <h2>{session.metadata.title}</h2>
            <p className="session-meta">
                {new Date(session.metadata.date).toLocaleString()}
                {session.metadata.location !== t.locationUnavailable && (
                    <>
                        {' | '}
                        <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer">
                           📍 {session.metadata.location}
                        </a>
                    </>
                )}
            </p>

            <div className="result-card">
                <h3>{t.summaryHeader}</h3>
                <p>{session.results.summary}</p>
            </div>
            <div className="result-card">
                <h3>{t.actionItemsHeader}</h3>
                {session.results.actionItems.length > 0 ? (
                    <ul>
                        {session.results.actionItems.map((item, index) => (
                            <li key={index}>
                                {item}
                                <button className="action-btn" onClick={() => onTakeAction(item)}>{t.takeAction}</button>
                            </li>
                        ))}
                    </ul>
                ) : <p>{t.noActionDetermined}</p>}
            </div>
            <div className="result-card">
                <h3>{t.speakersHeader}</h3>
                <div className="speaker-list">
                    {Object.keys(session.speakers).map(speakerId => (
                        <div key={speakerId} className="speaker-item">
                           {renderSpeaker(session.id, speakerId, session.speakers)}
                        </div>
                    ))}
                </div>
            </div>
            <div className="result-card">
                <h3>{t.transcriptHeader}</h3>
                <div className="transcript-content" dangerouslySetInnerHTML={{ __html: transcriptHtml.replace(/\n/g, '<br />') }}></div>
            </div>
        </div>
    );
};


const RecordingControls = ({ time, onStop, onTogglePip }: { time: number; onStop: () => void; onTogglePip: () => void; }) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };
    return (
        <div className="recording-controls">
            <div className="recording-indicator"></div>
            <span className="timer">{formatTime(time)}</span>
            <button onClick={onStop} className="stop-btn">{t.stopRecording}</button>
            {getPlatform() !== 'ios' && getPlatform() !== 'android' && (
                 <button onClick={onTogglePip} className="pip-btn" aria-label={t.toggleMiniView}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M14 3h7v7" />
                        <path d="M10 14L21 3" />
                    </svg>
                </button>
            )}
        </div>
    );
};

// FIX: Made `children` prop optional to fix "Property 'children' is missing" errors.
const Modal = ({ children, onClose, title }: { children?: React.ReactNode, onClose: () => void, title: string }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h2>{title}</h2>
                <button onClick={onClose} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
                {children}
            </div>
        </div>
    </div>
);

const LoginModal = ({ onAccountCreated, onCancel }: { onAccountCreated: (user: User) => void; onCancel: () => void; }) => {
    const [step, setStep] = useState<'consent' | 'details'>('consent');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    const handleCreateAccount = async () => {
        if (name && email) {
            const newUser = await dbService.createUser(name, email);
            onAccountCreated(newUser);
        }
    };

    return (
        <Modal onClose={onCancel} title={step === 'consent' ? t.consentTitle : t.loginTitle}>
            {step === 'consent' ? (
                <div className="login-step">
                    <p>{t.consentInternalUse}</p>
                    <p>{t.consentNoCopy}</p>
                    <button onClick={() => setStep('details')} className="modal-button">{t.consentContinue}</button>
                </div>
            ) : (
                <div className="login-step">
                    <p className="modal-subtitle">{t.loginSubtitle}</p>
                    <input
                        type="text"
                        placeholder={t.nameLabel}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="modal-input"
                    />
                    <input
                        type="email"
                        placeholder={t.emailLabel}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="modal-input"
                    />
                    <button onClick={handleCreateAccount} disabled={!name || !email} className="modal-button">
                        {t.continueButton}
                    </button>
                </div>
            )}
        </Modal>
    );
};

const ActionModal = ({ data, onClose, user }: { data: ActionModalData; onClose: () => void; user: User | null }) => {
    const { type, args } = data;

    const renderContent = () => {
        switch (type) {
            case 'create_calendar_event':
                const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(args.title)}&dates=${args.date.replace(/-/g, '')}T${args.time.replace(/:/g, '')}00/${args.date.replace(/-/g, '')}T${(parseInt(args.time.split(':')[0]) + 1).toString().padStart(2, '0')}${args.time.split(':')[1]}00&details=${encodeURIComponent(args.description)}`;
                return (
                    <div>
                        <h3>{t.createCalendarEvent}</h3>
                        <p><strong>{t.titleLabel}</strong> {args.title}</p>
                        <p><strong>{t.descriptionLabel}</strong> {args.description}</p>
                        <p><strong>{t.dateLabel}</strong> {args.date}</p>
                        <p><strong>{t.timeLabel}</strong> {args.time}</p>
                        <a href={gCalUrl} target="_blank" rel="noopener noreferrer" className="modal-button">{t.openInCalendar}</a>
                    </div>
                );
            case 'draft_email':
                const mailtoUrl = `mailto:${args.to}?subject=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(args.body)}`;
                return (
                    <div>
                        <h3>{t.draftEmail}</h3>
                        <p><strong>{t.toLabel}</strong> {args.to}</p>
                        <p><strong>{t.subjectLabel}</strong> {args.subject}</p>
                        <p><strong>{t.bodyLabel}</strong> {args.body}</p>
                        <a href={mailtoUrl} target="_blank" rel="noopener noreferrer" className="modal-button">{t.openInEmailApp}</a>
                    </div>
                );
             case 'draft_invoice_email':
                const emailBody = t.invoiceEmailBody
                    .replace('{recipientName}', args.recipientName)
                    .replace('{itemDescription}', args.itemDescription)
                    .replace('{currencySymbol}', args.currencySymbol)
                    .replace('{amount}', args.amount.toFixed(2))
                    .replace('{userName}', user?.name || '');
                const invoiceMailtoUrl = `mailto:${args.to}?subject=${encodeURIComponent(args.subject)}&body=${encodeURIComponent(emailBody)}`;
                return (
                    <div>
                        <h3>{t.draftInvoiceEmail}</h3>
                        <p><strong>{t.toLabel}</strong> {args.to}</p>
                        <p><strong>{t.recipientNameLabel}</strong> {args.recipientName}</p>
                        <p><strong>{t.subjectLabel}</strong> {args.subject}</p>
                        <p><strong>{t.amountLabel}</strong> {args.currencySymbol}{args.amount.toFixed(2)}</p>
                        <p><strong>{t.descriptionLabel}</strong> {args.itemDescription}</p>
                        <div className="code-block">{emailBody}</div>
                        <a href={invoiceMailtoUrl} target="_blank" rel="noopener noreferrer" className="modal-button">{t.openInEmailApp}</a>
                    </div>
                );
             case 'initiate_phone_call':
                const telUrl = `tel:${args.phoneNumber}`;
                return (
                    <div>
                        <h3>{t.initiatePhoneCall}</h3>
                        <p><strong>{t.phoneNumberLabel}</strong> {args.phoneNumber}</p>
                        {args.reason && <p><strong>{t.reasonLabel}</strong> {args.reason}</p>}
                        <a href={telUrl} className="modal-button">{t.callNow}</a>
                    </div>
                );
            case 'create_document':
                const handleOpenDocs = () => {
                    navigator.clipboard.writeText(args.content).then(() => {
                        window.open('https://docs.new', '_blank');
                    });
                };
                 return (
                    <div>
                        <h3>{t.createDocument}</h3>
                        <p>{t.createDocInfo}</p>
                        <p><strong>{t.suggestedTitle}</strong> {args.title}</p>
                        <div className="code-block">{args.content}</div>
                        <button onClick={handleOpenDocs} className="modal-button">{t.openGoogleDocs}</button>
                    </div>
                );
            case 'no_action':
                 return <p>{t.noActionDetermined}</p>;
            default:
                return <p>{t.unknownAction}</p>;
        }
    };
    return <Modal onClose={onClose} title="Action Details">{renderContent()}</Modal>;
};

const AudioDeviceSelector = ({ devices, onDeviceSelected, onClose }: { devices: MediaDeviceInfo[]; onDeviceSelected: (deviceId: string) => void; onClose: () => void; }) => {
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.deviceId || '');
    
    useEffect(() => {
        if(devices.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(devices[0].deviceId);
        }
    }, [devices, selectedDeviceId]);

    return (
        <Modal onClose={onClose} title={t.selectAudioDeviceTitle}>
            <div className="device-selector">
                <p>{t.recordPhoneCallInstruction}</p>
                <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="device-select-dropdown"
                >
                    {devices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${devices.indexOf(device) + 1}`}
                        </option>
                    ))}
                </select>
                <div className="modal-actions">
                    <button onClick={onClose} className="modal-button secondary">{t.cancel}</button>
                    <button onClick={() => onDeviceSelected(selectedDeviceId)} className="modal-button">{t.start}</button>
                </div>
            </div>
        </Modal>
    );
};


const FaqModal = ({ onClose }: { onClose: () => void; }) => (
    <Modal onClose={onClose} title={t.faqTitle}>
        <div className="faq-content">
            {t.faq.map((item, index) => (
                <div key={index} className="faq-item">
                    <h4>{item.q}</h4>
                    <p>{item.a}</p>
                </div>
            ))}
        </div>
    </Modal>
);

const ErrorModal = ({ message, onClose }: { message: string; onClose: () => void; }) => (
    <Modal onClose={onClose} title="Error">
        <p>{message}</p>
        <button onClick={onClose} className="modal-button">Close</button>
    </Modal>
);

const LoadingModal = ({ text }: { text: string }) => (
    <div className="modal-overlay">
        <div className="loading-content">
            <div className="spinner"></div>
            <p>{text}</p>
        </div>
    </div>
);

const LoadingSpinner = () => (
     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0D0D0D' }}>
        <div className="spinner"></div>
    </div>
);


const Footer = () => (
    <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Impactory Institute. All Rights Reserved.</p>
        <p>{t.createdBy} <a href={`mailto:${t.creatorEmail}`}>{t.creatorName}</a>. {t.dedication}</p>
    </footer>
);

// --- Global Styles ---
const globalStyles = `
    :root {
      --primary-color: #00A99D;
      --background-color: #0D0D0D;
      --surface-color: #1A1A1A;
      --text-color: #E0E0E0;
      --text-muted-color: #A0A0A0;
      --accent-color: #F5A623;
      --error-color: #D0021B;
      --font-family: 'Poppins', sans-serif;
      --border-radius: 12px;
      --box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    
    * {
      box-sizing: border-box;
    }

    html, body {
      font-family: var(--font-family);
      background-color: var(--background-color);
      color: var(--text-color);
      margin: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    #root {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    main {
      flex: 1;
      padding: 1rem;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
    }

    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background-color: rgba(13, 13, 13, 0.8);
      backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: 1000;
      transition: opacity 0.3s, visibility 0.3s;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo {
      height: 40px;
    }

    h1 {
      font-size: 1.75rem;
      margin: 0;
      color: var(--primary-color);
    }
    
    .header-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .welcome-user {
        font-size: 0.9rem;
        color: var(--text-muted-color);
    }

    .start-recording-btn {
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: var(--border-radius);
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.3s, transform 0.2s;
      box-shadow: 0 2px 8px rgba(0, 169, 157, 0.3);
    }

    .start-recording-btn:hover {
      background-color: #00C2B2;
      transform: translateY(-2px);
    }

    .session-list-container, .session-detail {
        animation: fadeIn 0.5s ease-in-out;
    }
    
    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    h2 {
      color: var(--primary-color);
    }
    
    .search-input {
        background-color: var(--surface-color);
        border: 1px solid #333;
        border-radius: var(--border-radius);
        color: var(--text-color);
        padding: 0.5rem 1rem;
        font-size: 1rem;
        width: 300px;
    }

    .session-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 1rem;
    }

    .session-item {
      background-color: var(--surface-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      border: 1px solid transparent;
      box-shadow: var(--box-shadow);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .session-item-content {
        flex-grow: 1;
    }

    .session-item:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
      border-color: var(--primary-color);
    }
    
    .session-item h3 {
        margin: 0 0 0.5rem 0;
    }
    
    .session-item p {
        margin: 0;
        color: var(--text-muted-color);
        font-size: 0.9rem;
    }
    
    .summary-preview {
        margin-top: 0.75rem !important;
        color: var(--text-color) !important;
        font-style: italic;
    }
    
    .delete-btn {
        background: none;
        border: none;
        color: var(--text-muted-color);
        cursor: pointer;
        font-size: 1.2rem;
        opacity: 0.7;
        transition: opacity 0.2s, color 0.2s;
        padding: 0.5rem;
    }

    .delete-btn:hover {
        opacity: 1;
        color: var(--error-color);
    }
    
    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .back-btn, .export-buttons button {
      background-color: var(--surface-color);
      border: 1px solid #333;
      color: var(--text-color);
      padding: 0.5rem 1rem;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .back-btn:hover, .export-buttons button:hover {
      background-color: #2a2a2a;
    }
    
    .export-buttons {
        display: flex;
        gap: 0.5rem;
    }

    .session-meta {
        color: var(--text-muted-color);
        margin-bottom: 2rem;
    }
    .session-meta a {
        color: var(--accent-color);
        text-decoration: none;
    }

    .result-card {
      background-color: var(--surface-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: var(--box-shadow);
    }
    
    .result-card h3 {
        margin-top: 0;
        color: var(--primary-color);
    }

    .result-card ul {
      list-style: none;
      padding-left: 0;
    }
    
    .result-card li {
        padding: 0.5rem 0;
        border-bottom: 1px solid #2a2a2a;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .result-card li:last-child {
        border-bottom: none;
    }
    
    .action-btn {
        background-color: var(--accent-color);
        color: var(--background-color);
        border: none;
        padding: 0.4rem 0.8rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        margin-left: 1rem;
        transition: transform 0.2s;
    }
    
    .action-btn:hover {
        transform: scale(1.05);
    }

    .transcript-content {
      line-height: 1.8;
      white-space: pre-wrap;
    }

    .recording-controls {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(30, 30, 30, 0.9);
      backdrop-filter: blur(10px);
      border-radius: var(--border-radius);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      z-index: 1001;
      animation: slideUp 0.5s ease-out;
    }
    
    .recording-indicator {
      width: 12px;
      height: 12px;
      background-color: var(--error-color);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    .timer {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
      font-family: monospace;
    }

    .stop-btn, .pip-btn {
      background-color: var(--error-color);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .pip-btn {
        background-color: var(--surface-color);
        padding: 0.75rem;
    }
    .pip-btn svg {
        display: block;
    }

    .stop-btn:hover {
      background-color: #E53935;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      animation: fadeIn 0.3s;
    }

    .modal-content {
      background-color: var(--surface-color);
      padding: 2rem;
      border-radius: var(--border-radius);
      width: 90%;
      max-width: 500px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.4s ease-out;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #333;
        padding-bottom: 1rem;
        margin-bottom: 1rem;
    }
    
    .modal-header h2 {
        margin: 0;
    }
    
    .close-btn {
        background: none;
        border: none;
        font-size: 2rem;
        color: var(--text-muted-color);
        cursor: pointer;
    }
    
    .modal-button {
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: 1rem;
        width: 100%;
        margin-top: 1rem;
        transition: background-color 0.2s;
    }
    .modal-button.secondary {
        background-color: #333;
    }
    
    .modal-button:disabled {
        background-color: #555;
        cursor: not-allowed;
    }
    
    .modal-button:not(:disabled):hover {
        background-color: #00C2B2;
    }

    .device-selector {
        text-align: center;
    }
    
    .device-select-dropdown {
        width: 100%;
        padding: 0.75rem;
        border-radius: var(--border-radius);
        background-color: #333;
        color: var(--text-color);
        border: 1px solid #444;
        font-size: 1rem;
        margin: 1rem 0;
    }
    
    .modal-actions {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
    }

    .loading-content {
      text-align: center;
      color: white;
    }
    
    .spinner {
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top: 4px solid var(--primary-color);
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }

    .welcome-screen {
        text-align: center;
        padding: 4rem 1rem;
        background-color: var(--surface-color);
        border-radius: var(--border-radius);
    }
    
    .feature-showcase {
        margin-top: 2rem;
        text-align: left;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
    }
    .feature-showcase h3 { color: var(--primary-color); }
    .feature-showcase ul { list-style: '✅ '; padding-left: 1.5rem; }
    .feature-showcase li { margin-bottom: 0.5rem; }

    
    .speaker-list {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .speaker-item {
        background-color: #2a2a2a;
        padding: 0.5rem 1rem;
        border-radius: var(--border-radius);
        display: flex;
        align-items: center;
    }

    .rename-speaker-btn {
        background: none;
        border: none;
        cursor: pointer;
        margin-left: 0.5rem;
        opacity: 0.6;
    }
    .rename-speaker-btn:hover { opacity: 1; }
    
    .speaker-edit-input {
        background-color: #333;
        border: 1px solid var(--primary-color);
        color: var(--text-color);
        border-radius: 8px;
        padding: 0.5rem;
    }

    .code-block {
        background-color: var(--background-color);
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
        max-height: 150px;
        overflow-y: auto;
        white-space: pre-wrap;
        font-family: monospace;
    }
    
    .faq-content h4 {
        color: var(--primary-color);
        margin-bottom: 0.5rem;
    }
    
    .faq-content p {
        margin-top: 0;
        margin-bottom: 1.5rem;
        color: var(--text-muted-color);
    }
    
    .login-step {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .modal-subtitle {
        color: var(--text-muted-color);
        text-align: center;
        margin-top: 0;
    }
    
    .modal-input {
        width: 100%;
        padding: 0.75rem;
        font-size: 1rem;
        border-radius: 8px;
        border: 1px solid #444;
        background-color: #333;
        color: var(--text-color);
    }

    .app-footer {
        text-align: center;
        padding: 2rem;
        font-size: 0.8rem;
        color: var(--text-muted-color);
        border-top: 1px solid var(--surface-color);
    }
    
    .app-footer a {
        color: var(--accent-color);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
        from { transform: translateY(20px) scale(0.98); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
      100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
    }
`;

// --- Root Render ---
const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);