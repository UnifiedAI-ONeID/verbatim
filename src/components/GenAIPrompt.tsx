
import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import '../style.css';

const GENERATE_SUMMARY_MUTATION = gql`
    mutation GenerateSummary($transcript: String!) {
        generateSummary(transcript: $transcript)
    }
`;

const GenAIPrompt = ({ session }) => {
    const [summary, setSummary] = useState('');
    const [generateSummary, { loading, error }] = useMutation(GENERATE_SUMMARY_MUTATION);

    const generateText = async () => {
        if (!session || !session.transcript) {
            alert('No transcript available to summarize.');
            return;
        }

        try {
            const response = await generateSummary({ variables: { transcript: session.transcript } });
            setSummary(response.data.generateSummary);
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
