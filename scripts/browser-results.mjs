export function mergeBrowserReports(engines,parts){
 if(new Set(engines).size!==engines.length||parts.length!==engines.length)throw Error('Browsernachweise unvollständig.');
 const byEngine=new Map();for(const {engine,report}of parts){if(!engines.includes(engine)||byEngine.has(engine)||report.cases.some(c=>c.engine!==engine))throw Error('Browsernachweis gehört nicht zur erwarteten Prüfung.');byEngine.set(engine,report);}
 return {status:engines.every(engine=>{const r=byEngine.get(engine);return r?.status==='passed'&&r.cases.length>0&&r.cases.every(c=>c.status==='passed');})?'passed':'failed',cases:parts.flatMap(p=>p.report.cases),steps:parts.flatMap(p=>p.report.steps??[])};
}
