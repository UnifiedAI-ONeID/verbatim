
import React, { useState } from 'react';
import { Modal } from './Modal';

export const FeedbackModal = ({ onClose, onSubmit, t }: any) => {
    const [feedback, setFeedback] = useState('');

    const handleSubmit = () => {
        onSubmit(feedback);
        onClose();
    };

    return (
        <Modal onClose={onClose} title={t.feedback}>
            <div className="action-form">
                <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={5}
                    placeholder="Enter your feedback..."
                />
                <button onClick={handleSubmit} className="modal-button">{t.submitFeedback}</button>
            </div>
        </Modal>
    );
};
