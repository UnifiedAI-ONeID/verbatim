
import React from 'react';

export const LoadingModal = ({ text }: any) => (
    <div className="modal-overlay">
        <div className="loading-content">
            <div className="spinner"/>
            {text}
        </div>
    </div>
);
