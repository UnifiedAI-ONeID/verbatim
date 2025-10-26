
import React, { useState } from 'react';

export const Accordion = ({ title, children, defaultOpen = false }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={"accordion-item " + (isOpen ? 'open' : '')}>
            <button className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
                <h3>{title}</h3><span className="accordion-icon">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <div className="accordion-content">{children}</div>}
        </div>
    );
};
