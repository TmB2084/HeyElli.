export const feedbackReasons = {workflow:'Bedienweg stimmt nicht',missing:'Information fehlt',permission:'Berechtigung stimmt nicht',context:'Falscher Zusammenhang',unclear:'Unverständlich',other:'Sonstiges'} as const;
export type FeedbackReason=keyof typeof feedbackReasons;
export type AnswerFeedback={turnId:string;rating:'up'|'down';reason:FeedbackReason|null;comment:string};
export type FeedbackInput=AnswerFeedback&{epoch:string};
export type FeedbackReviewItem=AnswerFeedback&{epoch:string;userId:string;displayName:string;question:string;answer:string;sources:{title:string;href:string}[];knowledgeVersion:string;createdAt:string;updatedAt:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function feedbackKey(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Ungültige Bewertung.');
 const value=input as Record<string,unknown>;
 if(typeof value.epoch!=='string'||typeof value.turnId!=='string'||!uuid.test(value.epoch)||!uuid.test(value.turnId))throw Error('Ungültige Antwortkennung.');
 return {epoch:value.epoch,turnId:value.turnId};
}
export function feedbackInput(input:unknown):FeedbackInput{
 const key=feedbackKey(input),value=input as Record<string,unknown>;
 if(Object.keys(value).some(key=>!['epoch','turnId','rating','reason','comment'].includes(key)))throw Error('Unzulässige Bewertungsangaben.');
 if(value.rating!=='up'&&value.rating!=='down')throw Error('Bitte Daumen hoch oder runter wählen.');
 const reason=value.reason??null,comment=value.comment??'';
 if(reason!==null&&(typeof reason!=='string'||!Object.hasOwn(feedbackReasons,reason))||typeof comment!=='string'||comment.length>600||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(comment))throw Error('Bitte einen gültigen Grund mit höchstens 600 Zeichen angeben.');
 if(value.rating==='up'&&(reason!==null||comment.trim()))throw Error('Ein Grund ist nur bei einer negativen Bewertung vorgesehen.');
 return {...key,rating:value.rating,reason:reason as FeedbackReason|null,comment:comment.trim()};
}
