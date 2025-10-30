
import React from 'react';
import '../style.css';

const GenAIPrompt = ({ session }) => {

    return (
        <section className="gen-ai-prompt-container">
            <h3>Generative AI</h3>
            <div className="prompt-controls">
                <button className="primary-button" disabled>
                    Summarize (Coming Soon)
                </button>
            </div>
        </section>
    );
};

export default GenAIPrompt;
