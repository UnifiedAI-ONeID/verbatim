
import React, { useState, useRef, CSSProperties, useEffect, useCallback, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { marked } from 'marked';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, query, orderBy, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, deleteObject } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

// --- Type Definitions ---
type Language = 'en' | 'es' | 'zh-CN' | 'zh-TW';
type Theme = 'light' | 'dark' | 'matrix';
type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'unknown';
type MeetingResults = { transcript: string; summary: string; actionItems: string[] };
type MeetingMetadata = { title: string; date: string; location: string; mapUrl: string; };
type Session = { id: string; metadata: MeetingMetadata; results: MeetingResults; speakers: Record<string, string>; status: 'processing' | 'completed' | 'error'; error?: string; };
type ActionModalData = { type: string; args?: any; sourceItem?: string; };
type EditingSpeaker = { sessionId: string; speakerId: string };
type ActiveTab = 'record' | 'sessions';
type AccordionProps = { title: string; children?: React.ReactNode; defaultOpen?: boolean; };
type ModalProps = { children?: React.ReactNode; onClose: () => void; title: string; };

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
        noActionItems: 'No action items were identified.',
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
        sessions: 'Sessions',
        record: 'Record',
        recording: 'Recording...',
        tapToRecord: 'Tap to start recording',
        signIn: 'Sign In with Google',
        signOut: 'Sign Out',
        signInToRecord: 'Sign in to start recording',
        signInToView: 'Sign in to view sessions',
        theme: 'Theme',
        language: 'Language',
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
        noActionItems: 'No se identificaron puntos de acción.',
        takeAction: 'Tomar Acción ✨',
        noActionDetermined: 'No se pudo determinar una acción específica para este ítem. Puedes gestionarlo manualmente.',
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
        sessions: 'Sesiones',
        record: 'Grabar',
        recording: 'Grabando...',
        tapToRecord: 'Toca para empezar a grabar',
        signIn: 'Iniciar Sesión con Google',
        signOut: 'Cerrar Sesión',
        signInToRecord: 'Inicia sesión para grabar',
        signInToView: 'Inicia sesión para ver sesiones',
        theme: 'Tema',
        language: 'Idioma',
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
        noActionItems: '未识别出任何行动项。',
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
        sessions: '会话',
        record: '录音',
        recording: '录音中...',
        tapToRecord: '点击开始录音',
        signIn: '使用 Google 登录',
        signOut: '登出',
        signInToRecord: '登录以开始录音',
        signInToView: '登录以查看会话',
        theme: '主题',
        language: '语言',
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
        noActionItems: '未識別出任何行動項。',
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
        sessions: '會話',
        record: '錄製',
        recording: '錄製中...',
        tapToRecord: '點擊以開始錄製',
        signIn: '使用 Google 登入',
        signOut: '登出',
        signInToRecord: '登入以開始錄製',
        signInToView: '登入以查看會話',
        theme: '主題',
        language: '語言',
        signInError: 'Google 登入失敗，請重試。',
        signInPopupBlockedError: '登入彈出視窗被瀏覽器封鎖。請允許此網站的彈出視窗。',
    },
};

// --- Firebase Initialization ---
const firebaseConfig = {
  // Replace with your own Firebase project configuration.
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const functions = getFunctions(firebaseApp);
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Gemini Function Calling Tool Definitions ---
const tools: FunctionDeclaration[] = [
    { name: 'create_calendar_event', description: 'Creates a Google Calendar event.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The title of the event.' }, description: { type: Type.STRING, description: 'The description or agenda for the event.' }, date: { type: Type.STRING, description: 'The date of the event in YYYY-MM-DD format.' }, time: { type: Type.STRING, description: 'The time of the event in HH:MM format (24-hour).' } }, required: ['title', 'date', 'time'] } },
    { name: 'draft_email', description: 'Drafts an email to a recipient.', parameters: { type: Type.OBJECT, properties: { to: { type: Type.STRING, description: 'The recipient\'s email address.' }, subject: { type: Type.STRING, description: 'The subject line of the email.' }, body: { type: Type.STRING, description: 'The body content of the email.' } }, required: ['to', 'subject', 'body'] } },
    { name: 'draft_invoice_email', description: 'Drafts an email with an invoice for a client.', parameters: { type: Type.OBJECT, properties: { recipient_name: { type: Type.STRING, description: 'The name of the person or company receiving the invoice.' }, item_description: { type: Type.STRING, description: 'A description of the product or service being invoiced.' }, amount: { type: Type.NUMBER, description: 'The total amount due.' } }, required: ['recipient_name', 'item_description', 'amount'] } },
    { name: 'initiate_phone_call', description: 'Initiates a phone call.', parameters: { type: Type.OBJECT, properties: { phone_number: { type: Type.STRING, description: 'The phone number to call.' }, reason: { type: Type.STRING, description: 'A brief summary of why the call is being made.' } }, required: ['phone_number'] } },
    { name: 'create_google_doc', description: 'Creates a new Google Document with specified content.', parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: 'The title of the document.' }, content: { type: Type.STRING, description: 'The initial content to be placed in the document.' } }, required: ['title', 'content'] } }
];

// --- Contexts for Theme and Language ---
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void }>({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} });
const LanguageContext = createContext<{ lang: Language; setLang: (lang: Language) => void; t: typeof translations.en }>({ lang: 'en', setLang: () => {}, t: translations.en });

const ThemeProvider = ({ children }: { children?: React.ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const storedTheme = localStorage.getItem('verbatim_theme') as Theme;
        if (storedTheme === 'matrix') return 'dark'; // Don't load easter egg on refresh
        return storedTheme || 'dark';
    });
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme !== 'matrix') {
            localStorage.setItem('verbatim_theme', theme);
        }
        const themeColor = theme === 'dark' ? '#0D0D0D' : theme === 'light' ? '#F5F5F7' : '#000000';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    }, [theme]);
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
    return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

const LanguageProvider = ({ children }: { children?: React.ReactNode }) => {
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
const useTheme = () => useContext(ThemeContext);
const useLocalization = () => useContext(LanguageContext);
const useKeepAwake = () => {
    const wakeLockRef = useRef<any>(null);
    const requestWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            } catch (err: any) { console.error(`Wake Lock failed: ${err.name}, ${err.message}`); }
        }
    }, []);
    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
        }
    }, []);
    return { requestWakeLock, releaseWakeLock };
};

// --- Main App Component ---
const App = () => {
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
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('record');
    const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(() => JSON.parse(localStorage.getItem('verbatim_keepAwake') || 'false'));
    const [showDedication, setShowDedication] = useState(false);
    const { t } = useLocalization();
    const { setTheme } = useTheme();
    const { requestWakeLock, releaseWakeLock } = useKeepAwake();
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<number | null>(null);
    const konamiIndexRef = useRef(0);
    const logoClickCount = useRef(0);

    // Easter Egg: Konami Code
    useEffect(() => {
        const konamiCode = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === konamiCode[konamiIndexRef.current]) {
                konamiIndexRef.current++;
                if (konamiIndexRef.current === konamiCode.length) {
                    setTheme('matrix');
                    konamiIndexRef.current = 0;
                }
            } else {
                konamiIndexRef.current = 0;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setTheme]);

    const handleLogoClick = () => {
        logoClickCount.current += 1;
        if (logoClickCount.current >= 5) {
            setShowDedication(true);
            logoClickCount.current = 0; // Reset
        }
    };

    const signInWithGoogle = useCallback(async (): Promise<User | null> => {
        setError(null);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            return result.user;
        } catch (error: any) {
            console.error("Authentication error:", error.code, error.message);
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                case 'auth/cancelled-popup-request':
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
    }, [t]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => { setUser(u); setIsLoading(false); });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) { setSessions([]); return; }
        const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('metadata.date', 'desc'));
        const unsub = onSnapshot(q, snap => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session))));
        return () => unsub();
    }, [user]);

    useEffect(() => localStorage.setItem('verbatim_keepAwake', JSON.stringify(keepAwakeEnabled)), [keepAwakeEnabled]);
    
    const handleStartRecording = async (deviceId: string) => {
        if (!auth.currentUser) return;
        const currentUser = auth.currentUser;
        setShowDeviceSelector(false);
        audioChunksRef.current = [];
        const newSessionId = `session_${Date.now()}`;
        const sessionDocRef = doc(db, 'users', currentUser.uid, 'sessions', newSessionId);

        try {
            const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })).catch(() => null);
            let locationName = t.locationUnavailable, mapUrl = '';
            if (pos) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                    if (res.ok) { const data = await res.json(); locationName = data.display_name; mapUrl = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`; }
                } catch (e) {
                    console.warn("Could not fetch location name", e);
                }
            }

            const preliminarySession: Omit<Session, 'id' | 'results' | 'speakers'> = { metadata: { title: `Meeting - ${new Date().toLocaleString()}`, date: new Date().toISOString(), location: locationName, mapUrl }, status: 'processing' };
            await setDoc(sessionDocRef, preliminarySession);
            const newSessionData = { ...preliminarySession, id: newSessionId, results: { transcript: '', summary: '', actionItems: [] }, speakers: {} };
            setSelectedSession(newSessionData);
            setActiveTab('sessions');

            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = async () => {
                setIsSaving(true);
                releaseWakeLock();
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                if (audioBlob.size < 2000) {
                    setError(t.recordingTooShortError);
                    await deleteDoc(sessionDocRef);
                } else if (!navigator.onLine) {
                    setError(t.offlineError);
                    await updateDoc(sessionDocRef, { status: 'error', error: t.offlineError });
                } else {
                    try {
                        const storageRef = ref(storage, `recordings/${currentUser.uid}/${newSessionId}.webm`);
                        await uploadBytes(storageRef, audioBlob);
                        const analyzeAudio = httpsCallable(functions, 'analyzeAudio');
                        await analyzeAudio({ sessionId: newSessionId, prompt: t.analysisPrompt });
                    } catch (e) {
                        setError(t.processingError);
                        await updateDoc(sessionDocRef, { status: 'error', error: t.processingError });
                    }
                }
                setIsSaving(false);
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
            if (keepAwakeEnabled) requestWakeLock();
        } catch (err) {
            console.error("Recording setup failed:", err);
            setError(t.micPermissionError);
            await deleteDoc(sessionDocRef).catch(() => {});
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
        releaseWakeLock();
    };
    
    const handleStartRecordingClick = async () => {
        setError(null);
        if(!user) {
            const signedInUser = await signInWithGoogle();
            if (!signedInUser) return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
            setAvailableDevices(devices);
            setShowDeviceSelector(true);
            stream.getTracks().forEach(track => track.stop());
        } catch (err) { setError(t.micPermissionError); }
    };
    
    const handleDeleteSession = async (sessionId: string) => {
        if (!user || !window.confirm(t.deleteConfirmation)) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
            await deleteObject(ref(storage, `recordings/${user.uid}/${sessionId}.webm`));
            setSelectedSession(null);
        } catch (error) { setError("Failed to delete session."); }
    };

    const handleUpdateSpeakerName = async (sessionId: string, speakerId: string, newName: string) => {
        if (!user || !newName.trim()) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'sessions', sessionId), { [`speakers.${speakerId}`]: newName.trim() });
            setEditingSpeaker(null);
        } catch (error) { setError("Failed to update speaker name."); }
    };

    const handleTakeAction = async (item: string, session: Session) => {
        try {
            const prompt = t.actionPrompt.replace('{meetingTitle}', session.metadata.title).replace('{meetingDate}', new Date(session.metadata.date).toLocaleDateString()).replace('{meetingSummary}', session.results.summary).replace('{actionItemText}', item);
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }], config: { tools: [{ functionDeclarations: tools }] } });
            const call = response.functionCalls?.[0];
            if (call) setShowActionModal({ type: call.name, args: call.args, sourceItem: item });
            else setShowActionModal({ type: 'unknown', sourceItem: item });
        } catch (err) { setShowActionModal({ type: 'error' }); }
    };
    
    if (isLoading) return <div style={styles.loadingContainer}>...</div>;
    
    const renderContent = () => {
        if (selectedSession) return <SessionDetailView session={selectedSession} onBack={() => setSelectedSession(null)} onDelete={handleDeleteSession} onTakeAction={handleTakeAction} onUpdateSpeakerName={handleUpdateSpeakerName} editingSpeaker={editingSpeaker} setEditingSpeaker={setEditingSpeaker} />;
        if (activeTab === 'sessions') return user ? <SessionsListView sessions={sessions} onSelectSession={setSelectedSession} searchQuery={searchQuery} setSearchQuery={setSearchQuery} /> : <LoginView prompt={t.signInToView} onSignIn={signInWithGoogle} />;
        return <RecordView isRecording={isRecording} recordingTime={recordingTime} isSaving={isSaving} error={error} user={user} onStopRecording={handleStopRecording} onStartRecordingClick={handleStartRecordingClick} keepAwake={keepAwakeEnabled} setKeepAwake={setKeepAwakeEnabled} />;
    };

    return (
        <div style={styles.appContainer}>
            <Header user={user} onSignIn={signInWithGoogle} onLogoClick={handleLogoClick} />
            <main style={styles.mainContent}>{renderContent()}</main>
            {!selectedSession && <BottomNav activeTab={activeTab} setActiveTab={(tab) => {setSelectedSession(null); setActiveTab(tab)}} />}
            {showDeviceSelector && <Modal title={t.selectAudioDeviceTitle} onClose={() => setShowDeviceSelector(false)}><p>{t.selectAudioDeviceInstruction}</p><ul style={styles.deviceList}>{availableDevices.map((d, i) => <li key={d.deviceId} style={styles.deviceItem} onClick={() => handleStartRecording(d.deviceId)}>{d.label || `Mic ${i + 1}`}</li>)}</ul></Modal>}
            {showActionModal && <ActionModal data={showActionModal} user={user} onClose={() => setShowActionModal(null)} />}
            {showDedication && <DedicationModal onClose={() => setShowDedication(false)} />}
        </div>
    );
};

// --- Sub-Components ---
const Header = ({ user, onSignIn, onLogoClick }: { user: User | null; onSignIn: () => void; onLogoClick: () => void; }) => {
    const { t, lang, setLang } = useLocalization();
    const { theme, toggleTheme } = useTheme();
    return (
        <header style={styles.header}>
            <div style={styles.logo} onClick={onLogoClick} role="button" aria-label="Verbatim Logo"><svg width="32" height="32" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="192" height="192" rx="48" fill="var(--bg-3)"/><path d="M48 68L80 124L112 68" stroke="var(--accent-primary)" strokeWidth="16" strokeLinecap="round"/><path d="M112 124V68" stroke="var(--accent-primary)" strokeWidth="16" strokeLinecap="round"/><path d="M144 68L144 124" stroke="var(--text-secondary)" strokeOpacity="0.6" strokeWidth="10" strokeLinecap="round"/><path d="M128 80L128 112" stroke="var(--text-secondary)" strokeOpacity="0.6" strokeWidth="10" strokeLinecap="round"/></svg><span style={{color: 'var(--accent-primary)'}}>{t.title}</span></div>
            <div style={styles.headerControls}>
                 <select value={lang} onChange={e => setLang(e.target.value as Language)} style={styles.headerSelect} aria-label={t.language}><option value="en">EN</option><option value="es">ES</option><option value="zh-CN">简体</option><option value="zh-TW">繁體</option></select>
                <button onClick={toggleTheme} style={styles.themeToggleButton} aria-label={`${t.theme}: ${theme}`}>{theme === 'light' ? '🌙' : '☀️'}</button>
                {user ? <button onClick={() => firebaseSignOut(auth)} style={styles.secondaryButton}>{t.signOut}</button> : <button onClick={onSignIn} style={styles.primaryButton}>{t.signIn}</button>}
            </div>
        </header>
    );
};

const RecordView = ({ isRecording, recordingTime, isSaving, error, user, onStopRecording, onStartRecordingClick, keepAwake, setKeepAwake }: any) => {
    const { t } = useLocalization();
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    return (
        <div style={styles.recordView}>
            <div style={styles.recordButtonContainer}>
                <button style={{ ...styles.recordButton, ...(isRecording ? styles.recordButtonRecording : {}) }} onClick={isRecording ? onStopRecording : onStartRecordingClick} aria-label={isRecording ? t.stopRecording : t.startRecording}>{isRecording ? '⏹️' : '🎤'}</button>
                <p style={styles.recordButtonText}>{isRecording ? formatTime(recordingTime) : (user ? t.tapToRecord : t.signInToRecord)}</p>
                 <div style={styles.statusContainer} aria-live="polite">{isSaving ? <p>{t.processing}</p> : error ? <p style={styles.errorText}>{error}</p> : null}</div>
            </div>
            <footer style={styles.recordFooter}>
                 <label style={styles.toggleSwitchLabel}><span>{t.keepAwake}</span><div style={styles.toggleSwitch}><input type="checkbox" checked={keepAwake} onChange={() => setKeepAwake(!keepAwake)} /><span className="slider"></span></div></label>
            </footer>
        </div>
    );
};

const SessionsListView = ({ sessions, onSelectSession, searchQuery, setSearchQuery }: any) => {
    const { t } = useLocalization();
    const filtered = sessions.filter((s: Session) => [s.metadata.title, s.results?.summary, s.results?.transcript].some(text => text?.toLowerCase().includes(searchQuery.toLowerCase())));
    return (
        <div style={styles.sessionsView}>
            <div style={styles.sessionsHeader}><h2>{t.recentSessions}</h2><input type="search" placeholder={t.searchPlaceholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={styles.searchInput} /></div>
            {filtered.length > 0 ? <ul style={styles.sessionsList}>{filtered.map((s: Session) => <li key={s.id} style={styles.sessionItem} onClick={() => onSelectSession(s)} role="button" tabIndex={0}><div><strong>{s.metadata.title}</strong><span style={styles.sessionItemDate}>{new Date(s.metadata.date).toLocaleDateString()}</span></div><div style={styles.sessionItemStatus}>{s.status==='processing' && <span style={styles.processingChip}>{t.processing}</span>}{s.status==='error'&&<span style={styles.errorChip}>Error</span>}></div></li>)}</ul> : <div style={styles.welcomeContainer}><h3>{t.welcomeMessage}</h3><p>{t.welcomeSubtext}</p></div>}
        </div>
    );
};

const SessionDetailView = ({ session, onBack, onDelete, onTakeAction, onUpdateSpeakerName, editingSpeaker, setEditingSpeaker }: any) => {
    const { t } = useLocalization();
    const renderTranscript = () => {
        if (!session.results?.transcript) return t.noTranscript;
        let displayTranscript = Object.entries(session.speakers || {}).reduce((acc, [id, name]) => acc.replace(new RegExp(`<strong>${id}:</strong>`, 'g'), `<strong>${name}:</strong>`), session.results.transcript);
        return <div dangerouslySetInnerHTML={{ __html: marked.parse(displayTranscript) }} />;
    };
    return (
        <div style={styles.detailView}>
            <div style={styles.detailHeader}><button onClick={onBack} style={styles.backButton}>&lt; {t.backToList}</button><button onClick={() => onDelete(session.id)} style={styles.deleteButton}>{t.deleteSession}</button></div>
            <h2>{session.metadata.title}</h2>
            <p style={styles.detailMeta}>{new Date(session.metadata.date).toLocaleString()}</p>
            <p style={styles.detailMeta}>{t.meetingLocation} <a href={session.metadata.mapUrl} target="_blank" rel="noopener noreferrer">{session.metadata.location}</a></p>
            {session.status === 'completed' && session.results ? (
                <div>
                    <Accordion title={t.summaryHeader} defaultOpen><div style={styles.contentBlock} dangerouslySetInnerHTML={{ __html: marked.parse(session.results.summary || t.noSummary) }}></div></Accordion>
                    <Accordion title={t.actionItemsHeader} defaultOpen><ul style={styles.actionItemsList}>{session.results.actionItems.length > 0 ? session.results.actionItems.map((item:string, i:number) => <li key={i} style={styles.actionItem}><span>{item}</span><button style={styles.takeActionButton} onClick={() => onTakeAction(item, session)}>{t.takeAction}</button></li>) : <li>{t.noActionItems}</li>}</ul></Accordion>
                    <Accordion title={t.speakersHeader}><ul style={styles.speakersList}>{Object.entries(session.speakers || {}).map(([id, name]) => <li key={id} style={styles.speakerItem}>{editingSpeaker?.speakerId === id ? <form onSubmit={e => { e.preventDefault(); onUpdateSpeakerName(session.id, id, (e.target as any).speakerName.value); }}><input name="speakerName" type="text" defaultValue={name as string} onBlur={e => onUpdateSpeakerName(session.id, id, e.target.value)} autoFocus style={styles.speakerInput} /></form> : <><span>{name as string}</span><button onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })} style={styles.editSpeakerButton}>✏️</button></>}</li>)}</ul></Accordion>
                    <Accordion title={t.transcriptHeader}><div style={styles.transcriptContainer}>{renderTranscript()}</div></Accordion>
                </div>
            ) : session.status === 'processing' ? <p>{t.processing}</p> : <p style={styles.errorText}>{session.error || t.processingError}</p>}
        </div>
    );
};

const BottomNav = ({ activeTab, setActiveTab }: any) => {
    const { t } = useLocalization();
    return <nav style={styles.bottomNav}><button style={{...styles.navButton, ...(activeTab === 'record' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('record')}>{t.record}</button><button style={{...styles.navButton, ...(activeTab === 'sessions' ? styles.navButtonActive : {})}} onClick={() => setActiveTab('sessions')}>{t.sessions}</button></nav>;
};

const LoginView = ({ prompt, onSignIn }: { prompt: string; onSignIn: () => void; }) => {
    const { t } = useLocalization();
    return (
        <div style={{ ...styles.loginView, justifyContent: 'center' }}>
            <p>{prompt}</p>
            <button onClick={onSignIn} style={styles.primaryButton}>{t.signIn}</button>
        </div>
    );
};

const Modal = ({ title, onClose, children }: ModalProps) => <div style={styles.modalOverlay} onClick={onClose}><div style={styles.modalContainer} onClick={e => e.stopPropagation()}><div style={styles.modalHeader}><h3>{title}</h3><button style={styles.modalCloseButton} onClick={onClose}>&times;</button></div><div style={styles.modalBody}>{children}</div></div></div>;

const ActionModal = ({ data, user, onClose }: { data: ActionModalData, user: User | null, onClose: () => void }) => {
    const { t } = useLocalization();
    const { type, args, sourceItem } = data;
    const [copied, setCopied] = useState(false);
    const copy = (text: string) => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    const content = () => {
        switch (type) {
            case 'create_calendar_event': { const { title, description, date, time } = args; const start = `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}00`; const url = new URL('https://calendar.google.com/calendar/render'); url.searchParams.set('action', 'TEMPLATE'); url.searchParams.set('text', title); url.searchParams.set('details', description); url.searchParams.set('dates', `${start}/${start}`); return <div><h4>{t.createCalendarEvent}</h4><p><strong>{t.titleLabel}</strong> {title}</p><p><strong>{t.descriptionLabel}</strong> {description}</p><p><strong>{t.dateLabel}</strong> {date} <strong>{t.timeLabel}</strong> {time}</p><a href={url.toString()} target="_blank" rel="noopener noreferrer" style={styles.actionButton}>{t.openInCalendar}</a></div>; }
            case 'draft_email': { const { to, subject, body } = args; return <div><h4>{t.draftEmail}</h4><p><strong>{t.toLabel}</strong> {to}</p><p><strong>{t.subjectLabel}</strong> {subject}</p><p><strong>{t.bodyLabel}</strong> <pre style={styles.preformattedText}>{body}</pre></p><a href={`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} target="_blank" style={styles.actionButton}>{t.openInEmailApp}</a></div>; }
            case 'draft_invoice_email': { const { recipient_name, item_description, amount } = args; const body = t.invoiceEmailBody.replace('{recipientName}', recipient_name).replace('{itemDescription}', sourceItem || item_description).replace('{currencySymbol}', '$').replace('{amount}', amount).replace('{userName}', user?.displayName || ''); return <div><h4>{t.draftInvoiceEmail}</h4><p><strong>{t.recipientNameLabel}</strong> {recipient_name}</p><p><strong>{t.amountLabel}</strong> ${amount}</p><p><strong>{t.bodyLabel}</strong> <pre style={styles.preformattedText}>{body}</pre></p><a href={`mailto:?subject=${encodeURIComponent(`Invoice for ${item_description}`)}&body=${encodeURIComponent(body)}`} target="_blank" style={styles.actionButton}>{t.openInEmailApp}</a></div>; }
            case 'initiate_phone_call': { const { phone_number, reason } = args; return <div><h4>{t.initiatePhoneCall}</h4><p><strong>{t.phoneNumberLabel}</strong> {phone_number}</p><p><strong>{t.reasonLabel}</strong> {reason}</p><a href={`tel:${phone_number}`} style={styles.actionButton}>{t.callNow}</a></div>; }
            case 'create_google_doc': { const { title, content } = args; return <div><h4>{t.createDocument}</h4><p>{t.createDocInfo}</p><p><strong>{t.suggestedTitle}</strong> {title}</p><p><strong>{t.suggestedContent}</strong> <pre style={styles.preformattedText}>{content}</pre></p><button style={styles.actionButton} onClick={() => { copy(content); window.open(`https://docs.google.com/document/create?title=${encodeURIComponent(title)}`, '_blank'); }}>{copied ? t.copiedSuccess : t.openGoogleDocs}</button></div>; }
            case 'error': return <p style={styles.errorText}>{t.actionError}</p>;
            default: return <p>{t.noActionDetermined}</p>;
        }
    };
    const titleMap: Record<string, string> = { create_calendar_event: t.createCalendarEvent, draft_email: t.draftEmail, draft_invoice_email: t.draftInvoiceEmail, initiate_phone_call: t.initiatePhoneCall, create_google_doc: t.createDocument };
    const title = titleMap[type] || t.takeAction;
    return <Modal title={title} onClose={onClose}><p style={styles.sourceItemText}><em>"{sourceItem}"</em></p>{content()}</Modal>;
};

const Accordion = ({ title, children, defaultOpen = false }: AccordionProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return <div style={styles.accordionContainer}><button style={styles.accordionHeader} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>{title}<span>{isOpen ? '−' : '+'}</span></button>{isOpen && <div style={styles.accordionContent}>{children}</div>}</div>;
};

const DedicationModal = ({ onClose }: { onClose: () => void }) => {
    const dedicationText = "Lovingly dedicated to moms and the Creator. ❤️";

    useEffect(() => {
        const timeout = setTimeout(onClose, 8000); // Auto-close after 8 seconds
        return () => clearTimeout(timeout);
    }, [onClose]);

    return (
        <div style={styles.dedicationOverlay} onClick={onClose}>
            <div style={styles.confettiContainer}>
                {Array.from({ length: 150 }).map((_, i) => (
                    <div key={i} className="confetti-piece" style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 5}s`,
                        backgroundColor: ['#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'][Math.floor(Math.random() * 7)],
                        transform: `rotate(${Math.random() * 360}deg)`
                    }}></div>
                ))}
            </div>
            <div style={styles.dedicationModal} onClick={(e) => e.stopPropagation()}>
                <p style={styles.dedicationText}>{dedicationText}</p>
            </div>
        </div>
    );
};

// --- STYLES (using CSS variables) ---
const styles: { [key: string]: CSSProperties } = {
    appContainer: { display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--bg)' },
    mainContent: { flex: 1, overflowY: 'auto', paddingBottom: '70px', display: 'flex', flexDirection: 'column' },
    loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, backgroundColor: 'var(--bg)', zIndex: 100 },
    headerControls: { display: 'flex', alignItems: 'center', gap: '10px' },
    logo: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer' },
    recordView: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box' },
    recordButtonContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, textAlign: 'center' },
    recordButton: { width: '150px', height: '150px', borderRadius: '50%', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-text)', fontSize: '4rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 0 20px color-mix(in srgb, var(--accent-primary) 40%, transparent)' },
    recordButtonRecording: { backgroundColor: 'var(--danger)', boxShadow: '0 0 25px color-mix(in srgb, var(--danger) 60%, transparent)', animation: 'pulse 1.5s infinite' },
    recordButtonText: { marginTop: '20px', fontSize: '1.2rem', color: 'var(--text-secondary)' },
    recordFooter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%', paddingBottom: '10px' },
    statusContainer: { minHeight: '24px', textAlign: 'center' },
    errorText: { color: 'var(--danger)' },
    primaryButton: { backgroundColor: 'var(--accent-secondary)', color: 'var(--accent-secondary-text)', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
    secondaryButton: { background: 'var(--bg-3)', border: '1px solid var(--border-color-2)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' },
    themeToggleButton: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '8px', color: 'var(--text-primary)' },
    headerSelect: { backgroundColor: 'var(--bg-3)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px' },
    bottomNav: { display: 'flex', justifyContent: 'space-around', backgroundColor: 'var(--bg-2)', padding: '10px 0', borderTop: '1px solid var(--border-color)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 },
    navButton: { background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1rem', padding: '10px 20px', cursor: 'pointer', flex: 1 },
    navButtonActive: { color: 'var(--accent-primary)', fontWeight: 'bold' },
    sessionsView: { padding: '20px' },
    sessionsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    searchInput: { backgroundColor: 'var(--bg-3)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', padding: '8px 12px' },
    sessionsList: { listStyle: 'none', padding: 0, margin: 0 },
    sessionItem: { backgroundColor: 'var(--bg-2)', padding: '15px', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    sessionItemInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
    sessionItemTitle: { fontSize: '1.1rem' },
    sessionItemDate: { fontSize: '0.9rem', color: 'var(--text-secondary)' },
    sessionItemStatus: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-tertiary)' },
    processingChip: { backgroundColor: 'var(--bg-3)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem' },
    errorChip: { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem' },
    welcomeContainer: { textAlign: 'center', padding: '50px 20px', color: 'var(--text-tertiary)' },
    loginView: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', textAlign: 'center' },
    toggleSwitchLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '1rem', width: '100%', maxWidth: '300px', padding: '12px', backgroundColor: 'var(--bg-2)', borderRadius: '8px', border: '1px solid var(--border-color)' },
    toggleSwitch: { position: 'relative', display: 'inline-block', width: '50px', height: '28px' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    modalContainer: { backgroundColor: 'var(--bg-2)', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px' },
    modalCloseButton: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' },
    modalBody: {},
    deviceList: { listStyle: 'none', padding: 0, margin: '10px 0 0' },
    deviceItem: { padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '10px', cursor: 'pointer', textAlign: 'center', backgroundColor: 'var(--bg-3)', transition: 'background-color 0.2s' },
    detailView: { padding: '20px' },
    detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    backButton: { background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '1rem', cursor: 'pointer' },
    deleteButton: { background: 'none', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' },
    detailMeta: { color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0' },
    contentBlock: { whiteSpace: 'pre-wrap', lineHeight: 1.6 },
    actionItemsList: { listStyle: 'none', padding: 0 },
    actionItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-color)' },
    takeActionButton: { background: 'var(--accent-primary)', color: 'var(--accent-primary-text)', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', marginLeft: '10px' },
    speakersList: { listStyle: 'none', padding: 0 },
    speakerItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' },
    editSpeakerButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' },
    speakerInput: { backgroundColor: 'var(--bg-3)', color: 'var(--text-primary)', border: '1px solid var(--border-color-2)', borderRadius: '4px', padding: '4px 8px' },
    transcriptContainer: { backgroundColor: 'var(--bg-2)', padding: '15px', borderRadius: '8px', maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 },
    accordionContainer: { marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' },
    accordionHeader: { backgroundColor: 'var(--bg-accent)', padding: '15px', cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    accordionContent: { padding: '15px', backgroundColor: 'var(--bg-2)' },
    actionButton: { display: 'inline-block', marginTop: '15px', padding: '10px 20px', backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-text)', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' },
    preformattedText: { whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-3)', padding: '10px', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto' },
    sourceItemText: { color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent-primary)', paddingLeft: '10px', marginBottom: '15px' },
    dedicationOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, overflow: 'hidden' },
    confettiContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
    dedicationModal: { padding: '30px', borderRadius: '12px', textAlign: 'center', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' },
    dedicationText: { fontSize: '1.5rem', fontWeight: 'bold', margin: 0 },
};
const styleSheet = document.createElement("style");
styleSheet.innerText = `@keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 70%, transparent); } 70% { transform: scale(1); box-shadow: 0 0 0 20px color-mix(in srgb, var(--danger) 0%, transparent); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 0%, transparent); } } .slider { position: absolute; cursor: pointer; inset: 0; background-color: var(--bg-3); transition: .4s; border-radius: 28px; } .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; } input { opacity: 0; width: 0; height: 0; } input:checked + .slider { background-color: var(--accent-primary); } input:checked + .slider:before { transform: translateX(22px); }
@keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
.confetti-piece { position: absolute; width: 10px; height: 20px; opacity: 0; animation: confetti-fall 6s linear forwards; }
`;
document.head.appendChild(styleSheet);


const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </ThemeProvider>
    </React.StrictMode>
);