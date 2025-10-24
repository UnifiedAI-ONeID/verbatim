
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
type User = { name: string; email: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };


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
        analysisPrompt: 'You are an expert multilingual meeting assistant. The user\'s preferred language is English. Analyze the following meeting audio, which may contain multiple spoken languages. Your task is to process this multilingual audio and generate all output exclusively in English. Provide a concise summary, a list of action items, and a full transcript with speaker labels (e.g., Speaker 1, Speaker 2). Identify all unique speakers. All output text (summary, action items, transcript) MUST be translated to and written in English. Format the output as a JSON object with keys: "summary", "actionItems" (an array of strings), "transcript" (a string with newlines and speaker labels), and "speakers" (an array of identified speaker labels like ["Speaker 1", "Speaker 2"]). Do not include the JSON markdown wrapper.',
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
        loginSubtitle: 'Save and manage your sessions by creating a free account.',
        nameLabel: 'Full Name',
        emailLabel: 'Email',
        continueButton: 'Continue',
        twoFactorTitle: 'Two-Factor Authentication',
        twoFactorSubtitle: 'For your security, please enter the code sent to {email}.',
        twoFactorCodeLabel: 'Your verification code is:',
        verifyButton: 'Verify & Login',
        invalidCodeError: 'Invalid code. Please try again.',
        faqLink: 'FAQ',
        faqTitle: 'Frequently Asked Questions',
        faq: [
            {
                q: 'What\'s new in this version (Beta v1.1)?',
                a: 'This version focuses on hardening the app for a more robust and reliable experience. We\'ve improved offline capabilities, refined error handling, and polished the user interface with smoother animations and a more intuitive speaker renaming flow. The app is now faster and more resilient.',
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
                a: 'All your session data, including audio recordings and analysis results, is stored exclusively in your browser\'s local storage. No data is sent to or stored on any external server, except for the temporary processing of audio by the Gemini API during analysis.',
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
        analysisPrompt: 'Eres un experto asistente de reuniones multilingüe. El idioma preferido del usuario es español. Analiza el siguiente audio de la reunión, que puede contener varios idiomas hablados. Tu tarea es procesar este audio multilingüe y generar todo el resultado exclusivamente en español. Proporciona un resumen conciso, una lista de puntos de acción y una transcripción completa con etiquetas de orador (p. ej., Orador 1, Orador 2). Identifica a todos los oradores únicos. Todo el texto de salida (resumen, puntos de acción, transcripción) DEBE ser traducido y escrito en español. Formatea la salida como un objeto JSON con las claves: "summary", "actionItems" (un array de strings), "transcript" (un string con saltos de línea y etiquetas de orador), y "speakers" (un array de etiquetas de orador identificadas como ["Orador 1", "Orador 2"]). No incluyas el envoltorio de markdown para JSON.',
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
        loginSubtitle: 'Guarda y gestiona tus sesiones creando una cuenta gratuita.',
        nameLabel: 'Nombre Completo',
        emailLabel: 'Correo Electrónico',
        continueButton: 'Continuar',
        twoFactorTitle: 'Autenticación de Dos Factores',
        twoFactorSubtitle: 'Por tu seguridad, ingresa el código enviado a {email}.',
        twoFactorCodeLabel: 'Tu código de verificación es:',
        verifyButton: 'Verificar e Iniciar Sesión',
        invalidCodeError: 'Código no válido. Por favor, inténtalo de nuevo.',
        faqLink: 'FAQ',
        faqTitle: 'Preguntas Frecuentes',
        faq: [
             {
                q: '¿Qué hay de nuevo en esta versión (Beta v1.1)?',
                a: 'Esta versión se centra en fortalecer la aplicación para una experiencia más robusta y fiable. Hemos mejorado las capacidades sin conexión, refinado el manejo de errores y pulido la interfaz de usuario con animaciones más suaves y un flujo de cambio de nombre de orador más intuitivo. La aplicación es ahora más rápida y resistente.',
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
                a: 'Todos los datos de tu sesión, incluidas las grabaciones de audio y los resultados del análisis, se almacenan exclusivamente en el almacenamiento local de tu navegador. Ningún dato se envía o almacena en ningún servidor externo, excepto para el procesamiento temporal del audio por la API de Gemini durante el análisis.',
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
        analysisPrompt: '你是一位专业的多语言会议助理。用户的首选语言是简体中文。请分析接下来的会议音频，其中可能包含多种口语语言。你的任务是处理这段多语言音频，并完全以简体中文生成所有输出。提供一份简洁的摘要、一个行动项列表和一份带有发言人标签（例如，发言人 1，发言人 2）的完整文字记录。识别所有唯一的发言人。所有输出文本（摘要、行动项、文字记录）都必须翻译成并以简体中文书写。将输出格式化为 JSON 对象，包含以下键："summary"、"actionItems"（字符串数组）、"transcript"（包含换行符和发言人标签的字符串）和 "speakers"（已识别的发言人标签数组，如 ["发言人 1", "发言人 2"]）。不要包含 JSON 的 markdown 包装器。',
        actionPrompt: '你是一个智能助手。请根据会议的完整背景和一个具体的行动项，调用最合适的工具来帮助用户完成它。用户的语言是简体中文。会议标题：“{meetingTitle}”。会议日期：“{meetingDate}”。会议摘要：“{meetingSummary}”。行动项：“{actionItemText}”。确保所有生成的内容（如邮件主题或活动描述）都与会议背景相关。',
        featureShowcase: 'Verbatim 功能特性',
        createdBy: '创建者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: '谨此献给我的家人、所有忙碌的妈妈们，以及创作者。❤️',
        featureList: [
            '多语言 AI 分析',
            '自动生成摘要与行动项',
            '带发言人标签的完整转录',
            '一键操作 (日历, Gmail, 文档)',
            'Markdown 导出与复制',
            '画中画迷你视图',
            '离线 PWA 功能',
            '音频源选择',
        ],
        consentTitle: '重要通知',
        consentInternalUse: '我确认此应用程序仅供 Impactory Institute 内部使用。',
        consentNoCopy: '我同意未经许可不会复制或分发此应用程序。',
        consentContinue: '接受并继续',
        loginTitle: '创建账户',
        loginSubtitle: '创建免费账户以保存和管理您的会话。',
        nameLabel: '全名',
        emailLabel: '电子邮箱',
        continueButton: '继续',
        twoFactorTitle: '双因素认证',
        twoFactorSubtitle: '为了您的安全，请输入已发送至 {email} 的验证码。',
        twoFactorCodeLabel: '您的验证码是：',
        verifyButton: '验证并登录',
        invalidCodeError: '代码无效。请重试。',
        faqLink: '常见问题',
        faqTitle: '常见问题',
        faq: [
            {
                q: '此版本（Beta v1.1）有哪些新功能？',
                a: '此版本专注于强化应用程序，以提供更强大、更可靠的体验。我们改进了离线功能，优化了错误处理，并通过更流畅的动画和更直观的发言人重命名流程打磨了用户界面。该应用程序现在更快、更有弹性。',
            },
            {
                q: '如何开始新的录音？',
                a: '点击“🎤 新建会话”按钮。如果是您第一次使用，系统会要求您创建一个帐户。然后，系统会提示您选择首选的麦克风。点击“开始”后，录音将立即开始。',
            },
            {
                q: 'Verbatim 能否在同一次会议中理解不同的语言？',
                a: '是的！Verbatim 由一个多语言人工智能驱动，可以处理包含多种语言的音频。所有最终输出，包括摘要、行动项和文字记录，都将被翻译成并以您的浏览器默认语言（英语、西班牙语或中文）呈现。',
            },
            {
                q: '发言人是如何被识别的？我可以更改他们的名字吗？',
                a: '人工智能会自动区分不同的发言人，并将他们标记为“发言人 1”等。分析完成后，您可以在“发言人”卡片中点击每个发言人姓名旁边的铅笔图标（✏️）。姓名将变为可编辑字段。输入新名称后按 Enter 键或点击旁边空白处即可保存。这将在整个文字记录中更新该名称。',
            },
            {
                q: '什么是“一键操作”？',
                a: '对于人工智能识别的每个行动项，您可以点击“执行操作 ✨”按钮。人工智能将为该任务确定最佳工具（如创建日历活动、草拟电子邮件或创建文档），并为您预先填写必要的信息。',
            },
            {
                q: '当我使用其他窗口时，如何控制录音？',
                a: '在桌面浏览器上录音时，点击“切换迷你视图”按钮。这会打开一个小的画中画窗口，其中包含一个计时器和一个“停止”按钮，该窗口会保持在其他窗口的顶部，方便您控制录音。',
            },
            {
                q: '这个应用可以离线使用吗？',
                a: '是的。Verbatim 是一个渐进式网络应用（PWA）。首次访问后，您可以将其安装到您的设备上，以获得类似应用的体验。即使没有互联网连接，您也可以查看过去的会话。但是，分析新的录音需要互联网连接才能与人工智能通信。',
            },
            {
                q: '我的数据存储在哪里？',
                a: '您所有的会话数据，包括录音和分析结果，都只存储在您浏览器的本地存储中。除了在分析过程中由 Gemini API 临时处理音频外，不会有任何数据发送到或存储在任何外部服务器上。',
            },
        ],
    },
    'zh-TW': {
        title: 'Verbatim',
        subtitle: '您的智慧會議儀表板。',
        welcomeUser: '歡迎，{name}',
        startRecording: '🎤 新增會議',
        stopRecording: '⏹️ 停止錄音',
        analyzing: '正在分析...',
        micPermissionError: '無法開始錄音。請授予麥克風權限。',
        processingError: '處理音訊失敗。這可能是由於網路連線不佳、錄音時間過短或音訊無聲。請重試。',
        offlineError: '分析需要網路連線。請連線後重試。',
        recordingTooShortError: '錄音時間太短，無法分析。請至少錄製2秒。',
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
        draftEmail: '草擬郵件',
        toLabel: '收件人:',
        subjectLabel: '主旨:',
        bodyLabel: '內文:',
        openInEmailApp: '在郵件應用程式中開啟',
        initiatePhoneCall: '撥打電話',
        phoneNumberLabel: '電話號碼:',
        reasonLabel: '通話事由:',
        callNow: '立即通話',
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
        recordPhoneCallInstruction: '為獲得最佳品質，請連接您的耳機。您也可以使用手機的揚声器。點擊錄音按鈕開始。',
        selectAudioDeviceTitle: '選擇音訊來源',
        selectAudioDeviceInstruction: '請選擇您要用於錄音的麥克風。',
        start: '開始',
        cancel: '取消',
        analysisPrompt: '你是一位專業的多語言會議助理。使用者的首選語言是繁體中文。請分析接下來的會議音訊，其中可能包含多種口語語言。你的任務是處理這段多語言音訊，並完全以繁體中文生成所有輸出。提供一份簡潔的摘要、一個行動項目清單、一份帶有發言人標籤（例如，發言人 1，發言人 2）的完整文字記錄，並識別所有唯一的發言人。所有輸出文字（摘要、行動項目、文字記錄）都必須翻譯成並以繁體中文書寫。將輸出格式化為 JSON 物件，包含以下鍵："summary"、"actionItems"（字串陣列）、"transcript"（包含換行符和發言人標籤的字串）和 "speakers"（已識別的發言人標籤陣列，如 ["發言人 1", "發言人 2"]）。不要包含 JSON 的 markdown 包裝器。',
        actionPrompt: '你是一個智慧助理。請根據會議的完整背景和一個具體的行動項目，呼叫最合適的工具來幫助使用者完成它。使用者的語言是繁體中文。會議標題：「{meetingTitle}」。會議日期：「{meetingDate}」。會議摘要：「{meetingSummary}」。行動項目：「{actionItemText}」。確保所有生成的內容（如郵件主旨或活動描述）都與會議背景相關。',
        featureShowcase: 'Verbatim 功能特性',
        createdBy: '創建者',
        creatorName: 'Simon Luke',
        creatorEmail: 'simon.luke@impactoryinstitute.com',
        dedication: '謹此獻給我的家人、所有忙碌的媽媽們，以及創作者。❤️',
        featureList: [
            '多語言 AI 分析',
            '自動生成摘要與行動項目',
            '帶發言人標籤的完整轉錄',
            '一鍵操作 (日曆, Gmail, 文件)',
            'Markdown 導出與複製',
            '畫中畫迷你視圖',
            '離線 PWA 功能',
            '音訊源選擇',
        ],
        consentTitle: '重要通知',
        consentInternalUse: '我確認此應用程式僅供 Impactory Institute 内部使用。',
        consentNoCopy: '我同意未經許可不會複製或分發此應用程式。',
        consentContinue: '接受並繼續',
        loginTitle: '建立帳戶',
        loginSubtitle: '建立免費帳戶以儲存和管理您的會議。',
        nameLabel: '全名',
        emailLabel: '電子郵件',
        continueButton: '繼續',
        twoFactorTitle: '雙重驗證',
        twoFactorSubtitle: '為了您的安全，請輸入已傳送至 {email} 的驗證碼。',
        twoFactorCodeLabel: '您的驗證碼是：',
        verifyButton: '驗證並登入',
        invalidCodeError: '代碼無效。請重試。',
        faqLink: '常見問題',
        faqTitle: '常見問題',
        faq: [
            {
                q: '此版本（Beta v1.1）有哪些新功能？',
                a: '此版本專注於強化應用程式，以提供更強大、更可靠的體驗。我們改進了離線功能，優化了錯誤處理，並透過更流暢的動畫和更直觀的發言人重命名流程打磨了使用者介面。該應用程式現在更快、更有彈性。',
            },
            {
                q: '如何開始新的錄音？',
                a: '點擊“🎤 新增會議”按鈕。如果是您第一次使用，系統會要求您建立一個帳戶。然後，系統會提示您選擇偏好的麥克風。點擊“開始”後，錄音將立即開始。',
            },
            {
                q: 'Verbatim 能否在同一次會議中理解不同的語言？',
                a: '是的！Verbatim 由一個多語言 AI 驅動，可以處理包含多種語言的音訊。所有最終輸出，包括摘要、行動項目和文字記錄，都將被翻譯成並以您的瀏覽器預設語言（英文、西班牙文或中文）呈現。',
            },
            {
                q: '發言人是如何被識別的？我可以更改他們的名字嗎？',
                a: 'AI 會自動區分不同的發言人，並將他們標記為“發言者 1”等。分析完成後，您可以在“發言者”卡片中點擊每個發言人姓名旁邊的鉛筆圖示（✏️）。姓名將變為可編輯欄位。輸入新名稱後按 Enter 鍵或點擊旁邊空白處即可儲存。這將在整個文字記錄中更新該名稱。',
            },
            {
                q: '什麼是“一鍵操作”？',
                a: '對於 AI 識別的每個行動項目，您可以點擊“執行操作 ✨”按鈕。AI 將為該任務確定最佳工具（如建立日曆活動、草擬電子郵件或建立文件），並為您預先填寫必要的資訊。',
            },
            {
                q: '当我使用其他視窗時，如何控制錄音？',
                a: '在桌面瀏覽器上錄音時，點擊“切換迷你視圖”按鈕。這會打開一個小的子母畫面視窗，其中包含一個計時器和一個“停止”按鈕，該視窗會保持在其他視窗的頂部，方便您控制錄音。',
            },
            {
                q: '這個應用程式可以離線使用嗎？',
                a: '是的。Verbatim 是一個漸進式網路應用程式（PWA）。首次訪問後，您可以將其安裝到您的裝置上，以獲得類似應用程式的體驗。即使沒有網路連線，您也可以查看過去的會議。但是，分析新的錄音需要網路連線才能與 AI 通信。',
            },
            {
                q: '我的資料儲存在哪裡？',
                a: '您所有的會議資料，包括錄音和分析結果，都只儲存在您瀏覽器的本機儲存空間中。除了在分析過程中由 Gemini API 暫時處理音訊外，不會有任何資料傳送到或儲存在任何外部伺服器上。',
            },
        ],
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

const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

// --- Gemini Tool Declarations ---
const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'A concise summary of the meeting.' },
    actionItems: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'A list of action items from the meeting.'
    },
    transcript: { type: Type.STRING, description: 'The full transcript of the meeting with speaker labels.' },
    speakers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'A list of identified speaker labels (e.g., "Speaker 1").'
    }
  },
  required: ['summary', 'actionItems', 'transcript', 'speakers'],
};

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
  description: 'Drafts an email with the specified recipients, subject, and body using the default email client.',
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

const initiatePhoneCallTool: FunctionDeclaration = {
  name: 'initiate_phone_call',
  description: 'Initiates a phone call to a specified number for a given reason. Use this for actions like "call someone".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phoneNumber: { type: Type.STRING, description: 'The phone number to call, including country and area codes if available.' },
      reason: { type: Type.STRING, description: 'A brief reason for the phone call, based on the meeting context.' },
    },
    required: ['phoneNumber', 'reason'],
  },
};

// --- Consent Modal Component ---
const ConsentModal: React.FC<{ onConsent: () => void; styles: { [key: string]: CSSProperties } }> = ({ onConsent, styles }) => {
    const [isChecked1, setIsChecked1] = useState(false);
    const [isChecked2, setIsChecked2] = useState(false);
    const allChecked = isChecked1 && isChecked2;

    const handleConsent = () => {
        if (allChecked) {
            onConsent();
        }
    };

    return (
        <div style={styles.modalBackdrop}>
            <div style={{...styles.modalContent, maxWidth: '450px'}}>
                <h2 style={{marginTop: 0, textAlign: 'center', color: '#00A99D'}}>{t.consentTitle}</h2>
                
                <div style={styles.consentCheckboxContainer} onClick={() => setIsChecked1(!isChecked1)}>
                    <input
                        type="checkbox"
                        id="consent-check-1"
                        checked={isChecked1}
                        onChange={e => { e.stopPropagation(); setIsChecked1(e.target.checked); }}
                        style={{ marginTop: '4px' }}
                    />
                    <label htmlFor="consent-check-1" style={{cursor: 'pointer'}}>{t.consentInternalUse}</label>
                </div>
                
                <div style={styles.consentCheckboxContainer} onClick={() => setIsChecked2(!isChecked2)}>
                    <input
                        type="checkbox"
                        id="consent-check-2"
                        checked={isChecked2}
                        onChange={e => { e.stopPropagation(); setIsChecked2(e.target.checked); }}
                         style={{ marginTop: '4px' }}
                    />
                    <label htmlFor="consent-check-2" style={{cursor: 'pointer'}}>{t.consentNoCopy}</label>
                </div>

                <button
                    onClick={handleConsent}
                    disabled={!allChecked}
                    style={{
                        ...styles.button,
                        ...styles.startButton,
                        width: '100%',
                        marginTop: '1.5rem',
                        opacity: allChecked ? 1 : 0.5,
                        cursor: allChecked ? 'pointer' : 'not-allowed',
                    }}
                >
                    {t.consentContinue}
                </button>
            </div>
        </div>
    );
};

// --- Login Modal Component ---
const LoginModal: React.FC<{ onLogin: (user: User) => void; styles: { [key: string]: CSSProperties } }> = ({ onLogin, styles }) => {
    const [step, setStep] = useState<'details' | '2fa'>('details');
    const [user, setUser] = useState<User>({ name: '', email: '' });
    const [generatedCode, setGeneratedCode] = useState('');
    const [userCode, setUserCode] = useState('');
    const [error, setError] = useState('');

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email);

    const handleDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (user.name.trim() && isEmailValid) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedCode(code);
            setError('');
            setStep('2fa');
        }
    };

    const handleVerifySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userCode === generatedCode) {
            onLogin(user);
        } else {
            setError(t.invalidCodeError);
            setUserCode('');
        }
    };

    return (
        <div style={styles.modalBackdrop}>
            <div style={{...styles.modalContent, maxWidth: '450px'}}>
                {step === 'details' ? (
                    <>
                        <h2 style={{marginTop: 0, textAlign: 'center', color: '#00A99D'}}>{t.loginTitle}</h2>
                        <p style={{textAlign: 'center', marginTop: '-1rem', marginBottom: '1.5rem'}}>{t.loginSubtitle}</p>
                        <form onSubmit={handleDetailsSubmit}>
                            <div style={styles.loginFormGroup}>
                                <label htmlFor="name" style={styles.loginLabel}>{t.nameLabel}</label>
                                <input
                                    type="text"
                                    id="name"
                                    value={user.name}
                                    onChange={(e) => setUser(prev => ({...prev, name: e.target.value}))}
                                    required
                                    style={styles.loginInput}
                                />
                            </div>
                            <div style={styles.loginFormGroup}>
                                <label htmlFor="email" style={styles.loginLabel}>{t.emailLabel}</label>
                                <input
                                    type="email"
                                    id="email"
                                    value={user.email}
                                    onChange={(e) => setUser(prev => ({...prev, email: e.target.value.trim()}))}
                                    required
                                    style={styles.loginInput}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!user.name.trim() || !isEmailValid}
                                style={{
                                    ...styles.button,
                                    ...styles.startButton,
                                    width: '100%',
                                    marginTop: '1rem',
                                    opacity: (user.name.trim() && isEmailValid) ? 1 : 0.5,
                                    cursor: (user.name.trim() && isEmailValid) ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {t.continueButton}
                            </button>
                        </form>
                    </>
                ) : (
                     <>
                        <h2 style={{marginTop: 0, textAlign: 'center', color: '#00A99D'}}>{t.twoFactorTitle}</h2>
                        <p style={{textAlign: 'center', marginTop: '-1rem', marginBottom: '1.5rem'}}>{t.twoFactorSubtitle.replace('{email}', user.email)}</p>
                        <form onSubmit={handleVerifySubmit}>
                            <div style={styles.twoFactorInfo}>
                                <label style={styles.loginLabel}>{t.twoFactorCodeLabel}</label>
                                <div style={styles.twoFactorCodeDisplay}>{generatedCode}</div>
                            </div>
                            <div style={styles.loginFormGroup}>
                                <input
                                    type="text"
                                    value={userCode}
                                    onChange={(e) => setUserCode(e.target.value)}
                                    required
                                    maxLength={6}
                                    style={{...styles.loginInput, ...styles.twoFactorInput}}
                                    aria-label="Verification code"
                                />
                            </div>
                             {error && <p style={{...styles.error, textAlign: 'center', margin: '-0.5rem 0 1rem 0'}}>{error}</p>}
                            <button
                                type="submit"
                                disabled={userCode.length !== 6}
                                style={{
                                    ...styles.button,
                                    ...styles.startButton,
                                    width: '100%',
                                    marginTop: '1rem',
                                    opacity: userCode.length === 6 ? 1 : 0.5,
                                    cursor: userCode.length === 6 ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {t.verifyButton}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
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
    const [easterEggClicks, setEasterEggClicks] = useState(0);
    const [showEasterEgg, setShowEasterEgg] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [editingSpeaker, setEditingSpeaker] = useState<EditingSpeaker | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [hasConsented, setHasConsented] = useState(() => {
        try {
            return localStorage.getItem('verbatim_consent') === 'true';
        } catch {
            return false;
        }
    });

    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<number | null>(null);
    const channelRef = useRef(new BroadcastChannel('verbatim_pip_channel'));
    const wakeLockSentinelRef = useRef<any | null>(null);


    // --- Data Persistence & Responsive View ---
    useEffect(() => {
        try {
            const savedSessions = localStorage.getItem('verbatim_sessions');
            if (savedSessions) {
                setSessions(JSON.parse(savedSessions));
            }
            const savedUser = localStorage.getItem('verbatim_user');
            if (savedUser) {
                setCurrentUser(JSON.parse(savedUser));
            }
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
        }

        const handleResize = () => setIsMobileView(window.innerWidth < 768);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('resize', handleResize);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('verbatim_sessions', JSON.stringify(sessions));
        } catch (e) {
            console.error("Failed to save sessions to localStorage", e);
        }
    }, [sessions]);

    const handleConsent = () => {
        try {
            localStorage.setItem('verbatim_consent', 'true');
        } catch (e) {
            console.error("Failed to save consent to localStorage", e);
        }
        setHasConsented(true);
    };

    const handleLoginAndProceed = (user: User) => {
        try {
            localStorage.setItem('verbatim_user', JSON.stringify(user));
            setCurrentUser(user);
            setShowLoginModal(false);
            showDeviceSelection();
        } catch (e) {
            console.error("Failed to save user to localStorage", e);
            // Optionally set an error state to show the user
        }
    };

    // --- Geolocation ---
    const [location, setLocation] = useState<{ name: string; mapUrl: string } | null>(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const locationRef = useRef(location);
    useEffect(() => {
        locationRef.current = location;
    }, [location]);

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


    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop(); // This triggers the onstop handler
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
    }, [pipWindow]);

     // --- PiP Communication ---
    useEffect(() => {
        const channel = channelRef.current;
        const messageHandler = (event: MessageEvent) => {
            if (event.data?.type === 'stop_recording') {
                if (isRecording) {
                    stopRecording();
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
    }, [isRecording, recordingTime, stopRecording]);


    // --- Recording Logic ---
    const prepareRecording = () => {
        if (!currentUser) {
            setShowLoginModal(true);
            return;
        }
        showDeviceSelection();
    };

    const showDeviceSelection = async () => {
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

            mediaRecorderRef.current.onstop = async () => {
                // Hardening checks
                if (recordingTime < 2) {
                    setError(t.recordingTooShortError);
                    setIsAnalyzing(false);
                    setRecordingTime(0);
                    return;
                }
                 if (!isOnline) {
                    setError(t.offlineError);
                    setIsAnalyzing(false);
                    setRecordingTime(0);
                    return;
                }
                if (audioChunksRef.current.length === 0) {
                    setError(t.processingError);
                    setIsAnalyzing(false);
                    return;
                }
        
                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    audioChunksRef.current = [];
                    setRecordingTime(0);
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
                         contents: { parts: [
                             {text: "Analyze this meeting audio."},
                             {inlineData: { mimeType: 'audio/webm', data: audioData }}
                         ]},
                         config: {
                            systemInstruction,
                            responseMimeType: 'application/json',
                            responseSchema: analysisResponseSchema,
                         }
                    });
        
                    const result = JSON.parse(response.text);
                    const currentLoc = locationRef.current;
                    
                    const newSession: Session = {
                        id: generateSessionId(),
                        metadata: {
                            title: result.summary?.substring(0, 40) + '...' || t.meetingTitle,
                            date: new Date().toISOString(),
                            location: currentLoc?.name || t.locationUnavailable,
                            mapUrl: currentLoc?.mapUrl || ''
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
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            setError(null);
            setActiveSession(null);
            getLocation();

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = window.setInterval(() => {
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
        if (!activeSession) return;
        
        setLoadingActionItem(actionItemText);
        setActionError(null);
        setActionModalData(null);
        
        try {
            const { title, date } = activeSession.metadata;
            const { summary } = activeSession.results;
            
            const promptText = t.actionPrompt
                .replace('{actionItemText}', actionItemText)
                .replace('{meetingTitle}', title)
                .replace('{meetingDate}', new Date(date).toLocaleDateString())
                .replace('{meetingSummary}', summary);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: promptText,
                config: {
                    tools: [{ functionDeclarations: [createCalendarEventTool, draftEmailTool, createDocumentTool, initiatePhoneCallTool] }],
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
            .map(([id, name]) => `- ${name} (ID: ${id})`)
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
    
    const handleRenameSpeaker = (sessionId: string, speakerId: string, newName: string) => {
        if (!newName || newName.trim() === "") {
            setEditingSpeaker(null);
            return;
        }

        const trimmedNewName = newName.trim();
        
        const updatedSessions = sessions.map(session => {
            if (session.id === sessionId) {
                const oldSpeakerName = session.speakers[speakerId];
                if (oldSpeakerName === trimmedNewName) return session;

                const newSpeakers = { ...session.speakers, [speakerId]: trimmedNewName };
                const escapedOldName = escapeRegExp(oldSpeakerName);
                const newTranscript = session.results.transcript.replace(
                    new RegExp(`^${escapedOldName}:`, 'gm'), 
                    `${trimmedNewName}:`
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
        setEditingSpeaker(null);
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
    
    const handleTitleClick = () => {
        const newClicks = easterEggClicks + 1;
        setEasterEggClicks(newClicks);
        
        if (newClicks >= 5) {
            setShowEasterEgg(true);
            setEasterEggClicks(0);
        }
        
        const timer = setTimeout(() => {
            setEasterEggClicks(current => (current === newClicks ? 0 : current));
        }, 1500);

        return () => clearTimeout(timer);
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
                    const mailtoUrl = `mailto:${encodeURIComponent(args.to || '')}?subject=${encodeURIComponent(args.subject || '')}&body=${encodeURIComponent(args.body || '')}`;
                    return (
                        <>
                            <h3>{t.draftEmail}</h3>
                            <p><strong>{t.toLabel}</strong> {args.to}</p>
                            <p><strong>{t.subjectLabel}</strong> {args.subject}</p>
                            <p><strong>{t.bodyLabel}</strong></p>
                            <pre style={styles.modalPre}>{args.body}</pre>
                            <a href={mailtoUrl} className="action-button">
                                {t.openInEmailApp}
                            </a>
                        </>
                    );
                case 'initiate_phone_call':
                    const telUrl = `tel:${args.phoneNumber.replace(/[^0-9+]/g, '')}`;
                    return (
                        <>
                            <h3>{t.initiatePhoneCall}</h3>
                            <p><strong>{t.phoneNumberLabel}</strong> {args.phoneNumber}</p>
                            <p><strong>{t.reasonLabel}</strong> {args.reason || sourceItem}</p>
                            <a href={telUrl} className="action-button">
                                {t.callNow}
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
    
    const renderEasterEggModal = () => {
        if (!showEasterEgg) return null;
    
        const closeModal = () => setShowEasterEgg(false);
    
        const Confetti = () => {
            const confettiCount = 100;
            const colors = ['#00A99D', '#FFC107', '#FF5722', '#4CAF50', '#2196F3', '#9C27B0'];
        
            return (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}>
                    {Array.from({ length: confettiCount }).map((_, i) => {
                         const style: CSSProperties & { '--random-x'?: string, '--random-y'?: string, '--random-rot'?: string } = {
                            position: 'absolute',
                            width: `${Math.random() * 8 + 4}px`,
                            height: `${Math.random() * 8 + 4}px`,
                            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                            top: '50%',
                            left: '50%',
                            opacity: 0,
                            animation: `confetti-burst 1.5s ${Math.random() * 0.5}s ease-out forwards`,
                            '--random-x': `${(Math.random() - 0.5) * 600}px`,
                            '--random-y': `${(Math.random() - 0.5) * 600}px`,
                            '--random-rot': `${Math.random() * 720 - 360}deg`,
                        };
                        return <div key={i} style={style} />;
                    })}
                </div>
            );
        };
    
        return (
            <div style={styles.modalBackdrop} onClick={closeModal}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <Confetti />
                    <button style={styles.modalCloseButton} onClick={closeModal}>&times;</button>
                    <h3 style={styles.easterEggTitle}>{t.featureShowcase}</h3>
                    <ul style={styles.featureList}>
                        {t.featureList.map((feature, index) => <li key={index}>{feature}</li>)}
                    </ul>
                    <p style={styles.dedicationText}>{t.dedication}</p>
                    <div style={styles.creatorCredit}>
                        <p><strong>{t.createdBy}:</strong> {t.creatorName}</p>
                        <p><a href={`mailto:${t.creatorEmail}`}>{t.creatorEmail}</a></p>
                    </div>
                </div>
            </div>
        );
    };

    const renderFaqModal = () => {
        if (!showFaqModal) return null;
    
        const closeModal = () => setShowFaqModal(false);
    
        return (
            <div style={styles.modalBackdrop} onClick={closeModal}>
                <div style={{...styles.modalContent, maxWidth: '700px'}} onClick={(e) => e.stopPropagation()}>
                    <button style={styles.modalCloseButton} onClick={closeModal}>&times;</button>
                    <h2 style={{...styles.easterEggTitle, marginBottom: '2rem'}}>{t.faqTitle}</h2>
                    <div style={styles.faqContainer}>
                        {(t.faq || []).map((item, index) => (
                            <div key={index} style={styles.faqItem}>
                                <h4 style={styles.faqQuestion}>{item.q}</h4>
                                <p style={styles.faqAnswer}>{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };
    
    const renderControls = () => (
        <div style={styles.controls}>
             {isRecording ? (
                <>
                    <button onClick={stopRecording} style={{...styles.button, ...styles.stopButton}}>
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
            {filteredSessions.map((session, index) => (
                <div
                    key={session.id}
                    className="session-card"
                    style={{
                        ...styles.sessionCard,
                        ...(activeSession?.id === session.id ? styles.activeSessionCard : {}),
                        ...(isRecording ? { cursor: 'not-allowed', opacity: 0.6 } : {}),
                        animation: `cardFadeIn 0.5s ease-out ${index * 0.05}s both`,
                    }}
                    onClick={() => handleSessionSelect(session)}
                >
                    <div style={styles.sessionCardContent}>
                        <h3 style={styles.sessionTitle}>{session.metadata.title}</h3>
                        <p style={styles.sessionDate}>{new Date(session.metadata.date).toLocaleDateString()}</p>
                    </div>
                    <button
                        style={styles.deleteButton}
                        className="delete-button"
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
                        <div style={{...styles.resultCard, animation: 'cardFadeIn 0.5s ease-out 0s both'}}>
                            <h3>{t.summaryHeader}</h3>
                            <div dangerouslySetInnerHTML={{ __html: marked(activeSession.results.summary) }} />
                        </div>
                        <div style={{...styles.resultCard, animation: 'cardFadeIn 0.5s ease-out 0.1s both'}}>
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
                         <div style={{...styles.resultCard, animation: 'cardFadeIn 0.5s ease-out 0.2s both'}}>
                             <h3>{t.speakersHeader}</h3>
                            <ul>
                                {Object.entries(activeSession.speakers).map(([id, name]) => (
                                    <li key={id} style={styles.speakerItem}>
                                        {editingSpeaker?.sessionId === activeSession.id && editingSpeaker?.speakerId === id ? (
                                            <input
                                                type="text"
                                                defaultValue={name}
                                                autoFocus
                                                style={styles.speakerInput}
                                                onBlur={(e) => handleRenameSpeaker(activeSession.id, id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRenameSpeaker(activeSession.id, id, e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingSpeaker(null);
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <span>{name}</span>
                                                <button 
                                                    onClick={() => setEditingSpeaker({ sessionId: activeSession.id, speakerId: id })} 
                                                    style={styles.renameButton}
                                                    aria-label={`Rename ${name}`}
                                                >
                                                    ✏️
                                                </button>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{...styles.resultCard, ...styles.transcriptCard, animation: 'cardFadeIn 0.5s ease-out 0.3s both'}}>
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
                <h1 style={styles.title} onClick={handleTitleClick}>{t.title}</h1>
                <p style={styles.subtitle}>
                    {currentUser ? t.welcomeUser.replace('{name}', currentUser.name) : t.subtitle}
                </p>
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
                    <p style={styles.mobileFooterText}>{t.footerText} | <a href="#" onClick={(e) => { e.preventDefault(); setShowFaqModal(true); }} style={styles.footerLink}>{t.faqLink}</a></p>
                </div>
            )}
            
            {!hasConsented && <ConsentModal onConsent={handleConsent} styles={styles} />}
            {showLoginModal && <LoginModal onLogin={handleLoginAndProceed} styles={styles} />}
            {renderActionModal()}
            {renderDeviceSelectorModal()}
            {renderEasterEggModal()}
            {renderFaqModal()}
            
            <footer style={{...styles.footer, ...(isMobileView && { display: 'none' })}}>
                <p>{t.footerText} | <a href="#" onClick={(e) => { e.preventDefault(); setShowFaqModal(true); }} style={styles.footerLink}>{t.faqLink}</a></p>
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
        cursor: 'pointer',
        userSelect: 'none',
    },
    subtitle: {
        margin: '0.25rem 0 0',
        fontSize: '1rem',
        color: isDarkMode ? '#999' : '#5F6368',
        minHeight: '1.2rem', // Prevent layout shift when name appears
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
        transition: 'background-color 0.2s, box-shadow 0.2s, transform 0.2s',
        border: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: 0, // for animation
    },
    activeSessionCard: {
        backgroundColor: 'rgba(0, 169, 157, 0.1)',
        borderColor: '#00A99D',
        boxShadow: '0 0 10px rgba(0, 169, 157, 0.2)',
    },
    sessionCardContent: {
        flex: 1,
        overflow: 'hidden',
    },
    sessionTitle: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
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
        opacity: 0, // for animation
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
        transition: 'background-color 0.2s',
    },
    speakerItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.2rem 0',
        gap: '0.5rem',
    },
    renameButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
    },
    speakerInput: {
        width: '100%',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
        backgroundColor: isDarkMode ? '#333' : '#fff',
        color: isDarkMode ? '#fff' : '#000',
        boxSizing: 'border-box',
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
        animation: 'fadeIn 0.3s ease',
    },
    modalContent: {
        backgroundColor: isDarkMode ? '#282828' : '#fff',
        padding: '2rem',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '90%',
        position: 'relative',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        animation: 'slideIn 0.3s ease',
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
        zIndex: 2,
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
    footerLink: {
        color: '#00A99D',
        textDecoration: 'none',
        fontWeight: 600,
    },
    mobileControlsContainer: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.5rem',
        background: `linear-gradient(to top, ${isDarkMode ? '#121212' : '#F7F9FC'} 80%, transparent)`,
    },
    mobileFooterText: {
        fontSize: '0.8rem',
        color: '#999',
        margin: 0,
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
        transition: 'transform 0.2s ease',
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
    easterEggTitle: {
        color: '#00A99D',
        textAlign: 'center',
        marginTop: 0,
    },
    featureList: {
        listStyleType: '"✅ "',
        paddingLeft: '20px',
    },
    creatorCredit: {
        textAlign: 'center',
        marginTop: '2rem',
        fontSize: '0.9rem',
        color: isDarkMode ? '#aaa' : '#555',
    },
    dedicationText: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: '2rem',
        color: isDarkMode ? '#bbb' : '#555',
    },
    consentCheckboxContainer: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '0.75rem',
        backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        cursor: 'pointer',
        userSelect: 'none',
    },
    loginFormGroup: {
        marginBottom: '1rem',
    },
    loginLabel: {
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: 600,
        fontSize: '0.9rem',
        color: isDarkMode ? '#ccc' : '#333',
    },
    loginInput: {
        width: '100%',
        padding: '0.75rem',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
        backgroundColor: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#000',
        boxSizing: 'border-box',
        fontSize: '1rem',
    },
    twoFactorInfo: {
        textAlign: 'center',
        marginBottom: '1rem',
    },
    twoFactorCodeDisplay: {
        fontSize: '2.5rem',
        fontWeight: 700,
        letterSpacing: '0.5rem',
        padding: '0.5rem',
        backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
        borderRadius: '8px',
        userSelect: 'all',
        color: '#00A99D',
    },
    twoFactorInput: {
        textAlign: 'center',
        fontSize: '1.5rem',
        letterSpacing: '0.2rem',
    },
    faqContainer: {
        maxHeight: '60vh',
        overflowY: 'auto',
        paddingRight: '1rem',
    },
    faqItem: {
        marginBottom: '1.5rem',
        borderBottom: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`,
        paddingBottom: '1.5rem',
    },
    faqQuestion: {
        margin: '0 0 0.5rem 0',
        color: '#00A99D',
        fontSize: '1.1rem',
    },
    faqAnswer: {
        margin: 0,
        lineHeight: 1.6,
        color: isDarkMode ? '#ccc' : '#333',
    },
};

// --- Keyframes for Animations ---
const keyframes = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes cardFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes confetti-burst {
        0% {
            opacity: 1;
            transform: translate(0, 0) rotate(0);
        }
        100% {
            opacity: 0;
            transform: translate(var(--random-x), var(--random-y)) rotate(var(--random-rot));
        }
    }
    .session-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, ${isDarkMode ? 0.3 : 0.08});
    }
    .delete-button:hover {
        background-color: ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
    }
    .action-button, button {
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .action-button:hover, button:hover {
       opacity: 0.9;
    }
    .action-button:active, button:active {
       transform: scale(0.97);
    }
`;
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = keyframes;
document.head.appendChild(styleSheet);


// --- Render App ---
const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);