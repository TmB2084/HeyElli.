// Public, non-sensitive catalogue. Grants are resolved on the server.
export const toolCatalog=[{id:'incident',name:'CaseDesk',app:'/casedesk',path:'/werkzeuge/casedesk',icon:'incident'},{id:'notes',name:'Notizen',app:null,path:'',icon:'notes'}] as const;
export function grantedTools(apps:readonly string[],tools:readonly string[]){return toolCatalog.filter(tool=>(tool.app===null||apps.includes(tool.app))&&tools.includes(tool.id));}
