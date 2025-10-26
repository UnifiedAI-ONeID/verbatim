
import React from 'react';

export const Modal = ({ children, onClose, title }: any) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{title}</h2><button onClick={onClose} className="close-btn">&times;</button></div>
            <div className="modal-body">{children}</div>
        </div>
    </div>
);
