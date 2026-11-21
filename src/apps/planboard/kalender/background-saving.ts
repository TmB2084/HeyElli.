export type SaveFailure={attempts:number;firstAt:number;lastAt:number;message:string;blocked:boolean};
export function saveFailure(previous:SaveFailure|undefined,message:string,status?:number,now=Date.now()):SaveFailure{
 return {attempts:(previous?.attempts??0)+1,firstAt:previous?.firstAt??now,lastAt:now,message,blocked:status!==undefined&&status>=400&&status<500};
}
export function notifySaveFailure(failure:SaveFailure|undefined,now=Date.now()){
 return !!failure&&(failure.blocked||failure.attempts>=3||now-failure.firstAt>=90000);
}
