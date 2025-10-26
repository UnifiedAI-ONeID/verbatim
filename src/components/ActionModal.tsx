
import React, { useState } from 'react';
import { Modal } from './Modal';

const CreateCalendarEvent = ({ args, t }: any) => {
    const [title, setTitle] = useState(args.title || '');
    const [description, setDescription] = useState(args.description || '');
    const [date, setDate] = useState(args.date || '');
    const [time, setTime] = useState(args.time || '');

    const handleCreateEvent = () => {
        const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(description)}&dates=${encodeURIComponent(date)}/${encodeURIComponent(date)}`;
        window.open(googleCalendarUrl, '_blank');
    };

    return (
        <div className="action-form">
            <h3>{t.createCalendarEvent}</h3>
            <label>{t.titleLabel}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>{t.descriptionLabel}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            <label>{t.dateLabel}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
             <label>{t.timeLabel}</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <button onClick={handleCreateEvent} className="modal-button">{t.openInCalendar}</button>
        </div>
    );
};

const DraftEmail = ({ args, t }: any) => {
    const [to, setTo] = useState(args.to || '');
    const [subject, setSubject] = useState(args.subject || '');
    const [body, setBody] = useState(args.body || '');

    const handleDraftEmail = () => {
        const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    };

    return (
        <div className="action-form">
            <h3>{t.draftEmail}</h3>
            <label>{t.toLabel}</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
            <label>{t.subjectLabel}</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label>{t.bodyLabel}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
            <button onClick={handleDraftEmail} className="modal-button">{t.openInEmailApp}</button>
        </div>
    );
};

const InitiatePhoneCall = ({ args, t }: any) => {
    const [phoneNumber, setPhoneNumber] = useState(args.phoneNumber || '');

    const handleCall = () => {
        window.location.href = `tel:${phoneNumber}`;
    };

    return (
        <div className="action-form">
            <h3>{t.initiatePhoneCall}</h3>
            <label>{t.phoneNumberLabel}</label>
            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            <p>{t.reasonLabel} {args.reason}</p>
            <button onClick={handleCall} className="modal-button">{t.callNow}</button>
        </div>
    );
};

const CreateDocument = ({ args, t }: any) => {
    const [title, setTitle] = useState(args.title || '');
    const [content, setContent] = useState(args.content || '');

    const handleCreateDoc = () => {
        navigator.clipboard.writeText(`${title}\n\n${content}`);
        window.open('https://docs.google.com/document/create', '_blank');
    };

    return (
        <div className="action-form">
            <h3>{t.createDocument}</h3>
            <p>{t.createDocInfo}</p>
            <label>{t.suggestedTitle}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>{t.suggestedContent}</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
            <button onClick={handleCreateDoc} className="modal-button">{t.openGoogleDocs}</button>
        </div>
    );
};

const DraftInvoiceEmail = ({ args, t, user }: any) => {
    const [to, setTo] = useState(args.to || '');
    const [subject, setSubject] = useState(args.subject || '');
    const [recipientName, setRecipientName] = useState(args.recipientName || '');
    const [itemDescription, setItemDescription] = useState(args.itemDescription || '');
    const [amount, setAmount] = useState(args.amount || 0);
    const [currencySymbol, setCurrencySymbol] = useState(args.currencySymbol || '$');

    const handleDraftInvoice = () => {
        const body = t.invoiceEmailBody
            .replace('{recipientName}', recipientName)
            .replace('{itemDescription}', itemDescription)
            .replace('{currencySymbol}', currencySymbol)
            .replace('{amount}', amount)
            .replace('{userName}', user?.displayName || '');

        const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    };

    return (
        <div className="action-form">
            <h3>{t.draftInvoiceEmail}</h3>
            <label>{t.toLabel}</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
            <label>{t.recipientNameLabel}</label>
            <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            <label>{t.subjectLabel}</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label>Item:</label>
            <input type="text" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
            <label>{t.amountLabel}</label>
            <div>
                <input type="text" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} style={{ width: '30px' }} />
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <button onClick={handleDraftInvoice} className="modal-button">{t.openInEmailApp}</button>
        </div>
    );
};

export const ActionModal = ({ data, onClose, t, user }: any) => {
    const renderAction = () => {
        switch (data.type) {
            case 'create_calendar_event':
                return <CreateCalendarEvent args={data.args} t={t} />;
            case 'draft_email':
                return <DraftEmail args={data.args} t={t} />;
            case 'initiate_phone_call':
                return <InitiatePhoneCall args={data.args} t={t} />;
            case 'create_document':
                return <CreateDocument args={data.args} t={t} />;
            case 'draft_invoice_email':
                return <DraftInvoiceEmail args={data.args} t={t} user={user} />;
            default:
                return <pre>{JSON.stringify(data.args, null, 2)}</pre>;
        }
    };

    return (
        <Modal onClose={onClose} title="Suggested Action">
            {renderAction()}
        </Modal>
    );
};
