export type AppointmentMessage={orderId:string;incidentId:string;sourceRevision:string;fingerprint:string;customer:string;location:string;start:string;end:string;technician:string;recipients:{address:string;label:string}[];subject:string;body:string};
export type ConfirmationMailSettings={enabled:boolean;testMode:boolean;version:number;sender:string};
export type ConfirmationInput={requestId:string;orderId:string;incidentId:string;sourceRevision:string;fingerprint:string;recipient:string;subject:string;body:string;channel:'outlook'|'graph';mailVersion:number;confirm:boolean};
export type ConfirmationReceipt={id:string;channel:'outlook'|'graph';queueId:string|null;testMode:boolean;repeated:boolean};
export function validConfirmationEmail(value:unknown):value is string{return typeof value==='string'&&value.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(value)&&!/[\x00-\x1f\x7f]/.test(value);}
