
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
        <div className="gen-ai-prompt-container">
            <button onClick={generateText} disabled={loading}>
                {loading ? 'Generating Summary...' : 'Summarize Transcript'}
            </button>
            {error && <p>Error: {error.message}</p>}
            {summary && (
                <div>
                    <h3>Summary:</h3>
                    <p>{summary}</p>
                </div>
            )}
        </div>
    );
};

export default GenAIPrompt;
