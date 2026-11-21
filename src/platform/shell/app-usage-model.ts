export const usagePaths=['/','/hilfe','/servicehub','/casedesk','/planboard','/dutyboard','/maildesk','/taskhub','/missioncontrol','/benutzerkonto','/einstellungen'];
export function usageApp(path:string){return usagePaths.find(value=>path===value||value!=='/'&&path.startsWith(value+'/'));}
export function usageScore(href:string,usage:Record<string,number>){return usage[usageApp(href.split('?')[0])??'']??0;}
