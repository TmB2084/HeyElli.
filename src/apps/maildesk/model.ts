// MailDesk: geteiltes Postfach mit Kundenzuordnung. Mailinhalte werden nie gespeichert, nur Entscheidungen.
export type MailAddress={name:string;address:string};
export type MailAttachment={id:string;name:string;size:number;contentType:string};
export type MailMessage={id:string;receivedAt:string;from:MailAddress;to:MailAddress[];subject:string;preview:string;body:string;attachments:MailAttachment[];unread:boolean;conversationId:string};
export type MatchKind='cost-subject'|'order'|'customer-number'|'cost-body'|'sender'|'manual'|'address'|'name';
export type MailMatch={kind:MatchKind;customerId:string;objectId?:string;orderNumber?:string;score:number;reason:string;evidence?:string};
export type MailDecision='auto'|'manual'|'confirmed'|'cleared';
export type MailState={customerId:string|null;objectId:string|null;orderNumber:string|null;decision:MailDecision;assigneeId:string|null;flagged:boolean;archived:boolean;version:number;updatedAt:string|null};
export type MailCategory='return'|'appointment'|'quote'|'supplier'|'fault'|'other';
export type MailFolder='inbox'|'unassigned'|'suggested'|'assigned'|'order'|'archive'|'mine'|'flagged'|'attachments'|'sent';
export type MailSummary={id:string;receivedAt:string;from:MailAddress;subject:string;preview:string;unread:boolean;attachmentCount:number;
 assignment:MailMatch|null;suggestion:MailMatch|null;customerName:string|null;category:MailCategory;state:MailState;assigneeName:string|null};
export type MatchCustomer={id:string;name:string;number:string};
export type MatchObject={id:string;customerId:string;parentId?:string;name:string;address:string};
export type MatchOrder={id:string;number:string;customerId:string;objectId:string;title:string;status:string};
export type MatchContext={customers:MatchCustomer[];objects:MatchObject[];orders:MatchOrder[];
 costs:{number:string;objectIds:string[]}[];senders:{address:string;customerId:string}[]};
export const folderLabels:Record<MailFolder,string>={inbox:'Eingang',unassigned:'Nicht zugeordnet',suggested:'Vorschlag prüfen',assigned:'Zugeordnet',order:'Auftrag angelegt',archive:'Archiv',mine:'Mir zugewiesen',flagged:'Markiert',attachments:'Mit Anhang',sent:'Gesendet'};
export const categoryLabels:Record<MailCategory,string>={return:'Rücklauf',appointment:'Termin',quote:'Angebot',supplier:'Lieferant',fault:'Störung',other:''};
