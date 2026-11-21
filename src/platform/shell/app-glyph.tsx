import {PlannerGlyph} from './planner-glyph';
export type AppGlyphName = 'incident' | 'resource' | 'duty' | 'elli' | 'account' | 'settings' | 'help' | 'service' | 'notes' | 'maildesk' | 'tasks' | 'mission';
export const appIconBackground:Record<AppGlyphName,string> = {
 incident:'linear-gradient(155deg,#ff8c7e,#e04459 60%,#c72b47)',
 resource:'linear-gradient(155deg,#77c3ff,#428bed 60%,#3064d9)',
 duty:'linear-gradient(155deg,#b5a1ff,#8b6be9 60%,#6949c6)',
 account:'linear-gradient(155deg,#7ed6b7,#42a58c 60%,#267c6c)',
 settings:'linear-gradient(155deg,#aab5c5,#778598 60%,#526174)',
 notes:'linear-gradient(155deg,#f6dc83,#deb13e 60%,#bc8c26)',
 service:'linear-gradient(155deg,#eec18c,#bf8954 60%,#966035)',
 help:'linear-gradient(155deg,#81d4ed,#329cbf 60%,#21738f)',
 maildesk:'linear-gradient(155deg,#6fdad6,#22a6a6 60%,#13808a)',
 tasks:'linear-gradient(155deg,#ffcf6b,#f5a524 60%,#d9820b)',
 mission:'linear-gradient(155deg,#ff8a7a,#e8475f 55%,#7c3aed)',
 elli:'linear-gradient(155deg,#ff9b9d,#e64868 60%,#bd2854)',
};
/** Elli combines a speech bubble with a spark: conversation and a helpful idea. */
export function AppGlyph({icon}:{icon:AppGlyphName}){
 // MissionControl: Zielscheibe mit Fokuspunkt (Tag planen, fokussiert arbeiten).
 if(icon==='mission')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/><path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4"/></svg>;
 // Aufgaben: Checkliste mit Haken (PDS-Aufgaben und weitere Quellen an einem Ort).
 if(icon==='tasks')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="5" width="20" height="22" rx="4"/><path d="m10.5 12 2 2 3.5-4M18.5 12.5H22M10.5 20.5l2 2 3.5-4M18.5 21H22"/></svg>;
 // MailDesk: Briefumschlag mit Verknüpfung (Mail wird einem Kunden zugeordnet).
 if(icon==='maildesk')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="7" width="24" height="18" rx="3.5"/><path d="m5 9 11 8 11-8"/><circle cx="24" cy="24" r="5" fill="currentColor" stroke="none" opacity=".9"/><path d="m21.8 24 1.6 1.6 3-3.2" stroke="#2b5fd0"/></svg>;
 if(icon==='notes')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="4" width="21" height="25" rx="3"/><path d="M6 11h21M12 17h9m-9 5h7M11 2v4m11-4v4"/></svg>;
 if(icon==='service')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="9" width="24" height="19" rx="4"/><path d="M11 9V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M4 17h9m6 0h9"/><rect x="13" y="15" width="6" height="5" rx="1"/><path d="M9 24h14"/></svg>;
 if(icon==='help')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="16" cy="16" r="12.5"/><path d="M11.8 12a4.2 4.2 0 1 1 7 3.1C17.1 16.3 16 17 16 19"/><circle cx="16" cy="23" r="1" fill="currentColor" stroke="none"/></svg>;
 if(icon==='account')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="16" cy="16" r="13"/><circle cx="16" cy="12" r="4.5"/><path d="M7 25a9 9 0 0 1 18 0"/></svg>;
 if(icon==='settings')return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M16.00 6.50 L18.34 4.23 L20.59 4.91 L21.28 8.10 L22.72 9.28 L25.98 9.33 L27.09 11.41 L25.32 14.15 L25.50 16.00 L27.77 18.34 L27.09 20.59 L23.90 21.28 L22.72 22.72 L22.67 25.98 L20.59 27.09 L17.85 25.32 L16.00 25.50 L13.66 27.77 L11.41 27.09 L10.72 23.90 L9.28 22.72 L6.02 22.67 L4.91 20.59 L6.68 17.85 L6.50 16.00 L4.23 13.66 L4.91 11.41 L8.10 10.72 L9.28 9.28 L9.33 6.02 L11.41 4.91 L14.15 6.68Z"/><circle cx="16" cy="16" r="4.5"/></svg>;
 if(icon!=='elli')return <PlannerGlyph icon={icon}/>;
 return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M22 6H10a6 6 0 0 0-6 6v8a6 6 0 0 0 6 6h2l-1 4 7-4h4a6 6 0 0 0 6-6v-8a6 6 0 0 0-6-6Z"/>
  <path d="m16 10 1.7 4.3L22 16l-4.3 1.7L16 22l-1.7-4.3L10 16l4.3-1.7Z" fill="currentColor" stroke="none"/>
  <path d="M26 2v5M23.5 4.5h5"/>
 </svg>;
}
