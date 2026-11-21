import {PlatformError} from '../../../platform/store/model.ts';
export type StandardPosition={id:string;articleId:string;name:string;type:'ARTIKEL'|'ARTIKEL_INKL_LOHN';number:string;quantity:number};
export type Defaults={positions:StandardPosition[];version:number};
export function positionInput(value:unknown):Pick<StandardPosition,'id'|'articleId'|'number'|'quantity'>[]{
 if(!Array.isArray(value)||value.length>20)throw new PlatformError('Höchstens 20 Standardpositionen sind möglich.');
 const numbers=new Set<string>(),ids=new Set<string>();return value.map(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!/^[a-f0-9-]{36}$/.test(row.id)||ids.has(row.id)||typeof row.articleId!=='string'||!row.articleId||row.articleId.length>200||/[\x00-\x20]/.test(row.articleId)||typeof row.number!=='string'||!row.number.trim()||row.number.trim().length>40||!/^\w[\w./-]*$/.test(row.number.trim())||typeof row.quantity!=='number'||!Number.isFinite(row.quantity)||row.quantity<=0||row.quantity>1000000)throw new PlatformError('Bitte Katalogartikel, eindeutige Positionsnummer und eine Menge größer null eingeben.');
  const number=row.number.trim();if(numbers.has(number.toLowerCase()))throw new PlatformError('Positionsnummern dürfen nicht doppelt vorkommen.');ids.add(row.id);numbers.add(number.toLowerCase());return {id:row.id,articleId:row.articleId,number,quantity:row.quantity};
 });
}
