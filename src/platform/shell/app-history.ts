type Entry={href:string;browserIndex:number|null};
/** A separate trail for one mounted app; external destinations never enter it. */
export class AppHistory {
 private entries:Entry[]=[];
 private position=-1;
 private pending:number|null=null;
 private readonly pathname:string;
 constructor(pathname:string){this.pathname=pathname;}
 private belongs(href:string){try{const url=new URL(href,'http://heyelli.invalid');return url.origin==='http://heyelli.invalid'&&url.pathname===this.pathname&&!href.startsWith('//')&&href.startsWith('/');}catch{return false;}}
 visit(href:string,browserIndex:number|null){
  if(!this.belongs(href))return;
  if(this.pending!==null&&this.entries[this.pending]?.href===href){
   this.position=this.pending;this.entries[this.position]={href,browserIndex};this.pending=null;return;
  }
  this.pending=null;
  const known=browserIndex===null?-1:this.entries.findIndex(entry=>entry.browserIndex===browserIndex&&entry.href===href);
  if(known>=0){this.position=known;return;}
  if(this.entries[this.position]?.href===href){this.entries[this.position]={href,browserIndex};return;}
  this.entries=this.entries.slice(0,this.position+1);this.entries.push({href,browserIndex});this.position=this.entries.length-1;
 }
 target(direction:-1|1){if(this.pending!==null)return null;const index=this.position+direction,entry=this.entries[index];return entry&&this.belongs(entry.href)?{index,href:entry.href}:null;}
 begin(direction:-1|1){const target=this.target(direction);if(target)this.pending=target.index;return target?.href??null;}
 get availability(){return {canGoBack:!!this.target(-1),canGoForward:!!this.target(1)};}
}
