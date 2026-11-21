/** Shared Meister symbols for the launcher, Service and the app information dialog. */
export function PlannerGlyph({icon}:{icon:'incident'|'resource'|'duty'}){
 return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {icon==='incident'?<><rect x="8" y="6" width="17" height="23" rx="3"/><rect x="12" y="3" width="9" height="5" rx="2" fill="currentColor" stroke="none"/><path d="m12 17 3 3 6-7M12 24h8"/></>:icon==='resource'?<><rect x="5" y="7" width="23" height="22" rx="4"/><path d="M5 14h23M11 4v7M22 4v7M10 19h7M18 24h5"/></>:<><path d="M22 5a11 11 0 1 0 6 17A11 11 0 0 1 22 5Z"/><path d="M25 5v6M22 8h6M28 17h2"/></>}
 </svg>;
}
