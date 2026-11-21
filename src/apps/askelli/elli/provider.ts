import 'server-only';
import {copilotStore} from '@/apps/askelli/copilot';
import {selectedAssistantProvider} from './provider-policy';
export async function assistantProvider(){
 const store=copilotStore(),settings=await store.settings();
 if(selectedAssistantProvider(settings.enabled)==='ollama')return {name:'ollama' as const,version:settings.version};
 // An active but broken Copilot setup must not silently select another provider.
 const active=await store.active();return {name:'copilot' as const,version:active.settings.version,...active};
}
