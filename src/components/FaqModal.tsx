
import React from 'react';
import { Modal } from './Modal';

export const FaqModal = ({ onClose, t }: any) => (
    <Modal onClose={onClose} title={t.faqTitle}>
        <p>{t.faq[0].a}</p>
    </Modal>
);
