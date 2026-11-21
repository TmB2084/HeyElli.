export type OrderAction={id:string;label:string;kind:'status'|'mobile';target:string};
export function orderActions(status:string,catalog:{uuid:string;bezeichnung:string}[],hasTechnician:boolean):OrderAction[]{
 const lower=status.trim().toLocaleLowerCase('de');
 if(/storniert/.test(lower))return [];
 const manual=lower==='mobil abgeholt',cancel=manual?'Manuell storniert':'Storniert';
 const actions=catalog.filter(item=>item.bezeichnung!==status&&!/mobil|storniert/i.test(item.bezeichnung)).map(item=>({id:item.uuid,label:item.bezeichnung,kind:'status' as const,target:item.bezeichnung}));
 if(catalog.some(item=>item.bezeichnung===cancel))actions.push({id:'cancel',label:manual?'Manuell stornieren':'Stornieren',kind:'status',target:cancel});
 return [...(!/mobil|erledigt|abgeschlossen/i.test(status)&&hasTechnician?[{id:'mobile',label:'Mobil ausgeben',kind:'mobile' as const,target:'Ausgegeben Mobil'}]:[]),...actions];
}
