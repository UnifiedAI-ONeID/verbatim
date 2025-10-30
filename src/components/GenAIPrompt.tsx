
import React, in { useState } from 'react';
import { useGenerateSummaryMutation } from '../../dataconnect-generated/react/hooks';
import '../style.css';

const GenAIPrompt = ({ session }) => {
    const [summary, setSummary] = useState('');
    const { mutate: generateSummary, isPending: loading, error } = useGenerateSummaryMutation();

    const generateText = async () => {
        if (!session || !session.transcription) {
            alert('No transcript available to summarize.');
            return;
        }

        try {
            const response = await generateSummary({ transcript: session.transcription });
            setSummary(response);
        } catch (e) {
            console.error('Error generating summary:', e);
            setSummary('Failed to generate summary.');
        }
    };

    return (
        <section className="gen-ai-prompt-container">
            <h3>Generative AI</h3>
            <div className="prompt-controls">
                <button onClick={generateText} disabled={loading} className="primary-button">
                    {loading ? 'Generating Summary...' : 'Summarize Transcript'}
                </button>
            </div>
            {error && <p className="error-message">Error: {error.message}</p>}
            {summary && (
                <div className="summary-output">
                    <h4>Summary:</h4>
                    <p>{summary}</p>
                </div>
            )}
        </section>
    );
};

export default GenAIPrompt;
