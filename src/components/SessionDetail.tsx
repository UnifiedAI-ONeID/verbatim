
import React from 'react';
import { Accordion } from './Accordion';
import { marked } from 'marked';

export const SessionDetail = ({ session, onBack, onTakeAction, onRenameSpeaker, editingSpeaker, setEditingSpeaker, onExport, onCopy, t }: any) => {
    const generateMarkdown = (s: any) => ("# " + s.metadata.title + "\n\n" + s.results.summary);
    return (
        <div className="page-container session-detail">
            <div className="page-header sticky">
                <button onClick={onBack} className="back-btn">&larr; {t.backToList}</button>
                <div className="export-buttons">
                    <button onClick={() => onCopy(generateMarkdown(session))}>{t.copyMarkdown}</button>
                    <button onClick={() => onExport(session)}>{t.downloadMarkdown}</button>
                </div>
            </div>
            <h2>{session.metadata.title}</h2>
            <Accordion title={t.summaryHeader} defaultOpen={true}>
                <p>{session.results.summary}</p>
                <button onClick={() => onCopy(session.results.summary)}>{t.copyMarkdown}</button>
            </Accordion>
            <Accordion title={t.actionItemsHeader} defaultOpen={true}>
                <ul>{session.results.actionItems.map((item: any, i: any) => <li key={i}><span>{item}</span><button className="action-btn" onClick={() => onTakeAction(item, session)}>{t.takeAction}</button></li>)}</ul>
            </Accordion>
            <Accordion title={t.speakersHeader}>
                {Object.entries(session.speakers).map(([id, name]) => (
                    <div key={id}>
                        {editingSpeaker?.speakerId === id ?
                            <input type="text" defaultValue={name as string} onBlur={e => onRenameSpeaker(session.id, id, e.target.value)} autoFocus /> :
                            <span onClick={() => setEditingSpeaker({ sessionId: session.id, speakerId: id })}>{name as string} ✏️</span>
                        }
                    </div>
                ))}
            </Accordion>
            <Accordion title={t.transcriptHeader}><div className="transcript-content" dangerouslySetInnerHTML={{ __html: marked.parse(session.results.transcript.replace(/\n/g, '<br/>')) as string }}/></Accordion>
        </div>
    );
};
