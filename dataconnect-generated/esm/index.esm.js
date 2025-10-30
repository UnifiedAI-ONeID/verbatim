
import {
  configureConnector,
  defineQuery,
  defineMutation,
} from 'firebase/data-connect';

export const connectorConfig = {
  connectorId: 'verbatim-genai',
  location: 'us-central1',
};

export const sessionsRef = defineQuery('sessions');
export const sessionRef = defineQuery('session', {
    params: {
        id: 'ID!'
    }
});
export const createSessionRef = defineMutation('createSession', {
    params: {
        status: 'String!'
    }
});
export const updateSessionRef = defineMutation('updateSession', {
    params: {
        id: 'ID!',
        status: 'String',
        uploadProgress: 'Float',
        audioUrl: 'String',
        transcription: 'String',
        summary: 'String'
    }
});
export const deleteSessionRef = defineMutation('deleteSession', {
    params: {
        id: 'ID!'
    }
});
export const generateSummaryRef = defineMutation('generateSummary', {
    params: {
        transcript: 'String!'
    }
});

export const dc = configureConnector(connectorConfig);
