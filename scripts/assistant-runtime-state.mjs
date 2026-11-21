// Own only children created by this development process, never an external Ollama service.
export async function reconcileLocalAssistant(provider,child,{reachable,start,stop}){
 if(!['ollama','copilot'].includes(provider))throw Error('Unknown provider');
 if(provider==='copilot'){if(child)stop(child);return null;}
 if(child)return child;
 return await reachable()?null:start();
}
