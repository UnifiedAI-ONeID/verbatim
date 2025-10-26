
import React from 'react';
import { Modal } from './Modal';

export const ErrorModal = ({ message, onClose, t }: any) => (
    <Modal onClose={onClose} title="Error">
        <p>{message}</p>
    </Modal>
);
