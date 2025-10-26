
import React from 'react';
import { Modal } from './Modal';

const CreateCalendarEvent = ({ args, t }: any) => {
    // UI for creating a calendar event
    return (
        <div>
            <h3>{t.createCalendarEvent}</h3>
            <p>Title: {args.title}</p>
            <p>Description: {args.description}</p>
            <p>Date: {args.date}</p>
            <p>Time: {args.time}</p>
        </div>
    );
};

export const ActionModal = ({ data, onClose, t }: any) => {
    const renderAction = () => {
        switch (data.type) {
            case 'create_calendar_event':
                return <CreateCalendarEvent args={data.args} t={t} />;
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
