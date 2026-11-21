export type AccountProfile={
 displayName:string;
 roleName?:string;
 role:'admin'|'dispatcher'|'reader';
 username?:string|null;
 loginMode?:'local'|'microsoft';
 microsoftLinked?:boolean;
 microsoftLinkAvailable?:boolean;
 employee:{name:string;number?:string}|null;
 employeeState:'linked'|'none'|'missing'|'unavailable';
};
