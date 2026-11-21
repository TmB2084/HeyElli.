import {externalWritesBlocked} from '../../../platform/server-operation/index.ts';

// Testinstanz (HEYELLI_EXTERN_SCHREIBEN=aus): Copilot sendet jede Frage per POST an Microsoft und wird deshalb nie gewählt;
// Elli bleibt beim lokalen Ollama. Der gespeicherte Copilot-Schalter bleibt unverändert.
export function selectedAssistantProvider(copilotEnabled:boolean,env:NodeJS.ProcessEnv=process.env):'copilot'|'ollama'{
 if(typeof copilotEnabled!=='boolean')throw Error('Anbieterstatus unbekannt.');
 if(externalWritesBlocked(env))return 'ollama';
 return copilotEnabled?'copilot':'ollama';
}
