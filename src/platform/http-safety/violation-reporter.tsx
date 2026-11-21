'use client';
import {eventReport} from './report-model';
import {useEffect} from 'react';
// Native Reporting API delivery can be delayed/disabled (notably on local HTTP).
// A bounded event fallback reports only normalized classes, with the own session.
export function BrowserViolationReporter(){
 useEffect(()=>{
  const seen=new Set<string>();let sent=0,windowStart=Date.now();
  function report(event:SecurityPolicyViolationEvent){
   if(Date.now()-windowStart>60000){seen.clear();sent=0;windowStart=Date.now();}
   const payload=eventReport(event,location.origin,location.pathname),id=JSON.stringify(payload);if(seen.has(id)||sent>=10)return;seen.add(id);sent++;
   // No sample, original policy, nonce, query, fragment, stack, IP or user agent.
   void fetch('/api/sicherheit/csp',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/csp-report'},body:JSON.stringify(payload)}).catch(()=>{});
  }
  document.addEventListener('securitypolicyviolation',report);return()=>document.removeEventListener('securitypolicyviolation',report);
 },[]);
 return null;
}
