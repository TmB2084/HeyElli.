import fixtures from '../../../../database/seeds/pds-simulator/maintenance.json' with {type:'json'};
import costs from '../../../../database/seeds/pds-simulator/cost-carriers.json' with {type:'json'};
export function simulatedMaintenance(){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
 const day=(offset:number)=>new Date(Date.parse(today+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
 return {contracts:fixtures.map(item=>({uuid:item.uuid,objektUUID:item.object,wartung:{bezeichnung:item.title,beschreibung:'Fiktive regelmäßige Wartung.',leistungsumfang:'Anlage prüfen und Wartung dokumentieren.',abschlussDatum:item.closed?day(-1):undefined,laufzeit:{vonDatum:'2026-01-01'},kstKtr:costs.costCarriers[1],intervalle:[{uuid:item.interval,bezeichnung:item.title}]},rechnung:{kstKtr:costs.costCarriers[2]}})),intervals:fixtures.map(item=>({uuid:item.interval,bezeichnung:item.title,intervallSerie:{startDatum:'2026-01-01',naechstesDatum:item.days===null?undefined:day(item.days)},rootEbene:{uuid:item.interval+'-root',bezeichnung:item.title,positionen:[]}}))};
}
