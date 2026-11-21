export type DispatchReference={provider:'pds'|'sharepoint';target:string;id:string;library:string};
export type DispatchDocument={key:string;reference:DispatchReference;name:string;origin:string;modified:string;documentType?:string;url?:string};
export type DispatchSelection={key:string;reference:DispatchReference;selected:boolean;version:number};
export type DispatchTarget={id:string;label:string;kind:'order'|'customer'|'object'|'contract';recordId:string;objectId?:string};
export type DispatchContext={scope:string;sourceRevision:string;canWrite:boolean;targets:DispatchTarget[];contacts:{name:string;phones:string[]}[];bmaObjects:{id:string;name:string}[]};
export type DispatchCatalog={items:DispatchDocument[];errors:string[];notice?:string;truncated?:boolean};
