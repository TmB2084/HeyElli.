/** Shared product names; no configuration or business data. */
export const productTerms={account:'Benutzerkonto',settings:'Einstellungen',elliFeedback:'AskElli',mailCategory:'Organisation'} as const;
export function serviceFileTitle(kind:string,objectType?:string){return kind==='order'?'Serviceauftrag':kind==='customer'?'Kundenakte':objectType==='TECHNISCHE_EINHEIT'?'Technische Einheit':'Objektakte';}
