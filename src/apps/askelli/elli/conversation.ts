export type ChatTurn={question:string;answer:string};
// Keep complete, recent question/answer pairs within the local model's context budget.
export function recentConversation(turns:readonly ChatTurn[]):ChatTurn[]{
 const result:ChatTurn[]=[];let size=0;
 for(const turn of turns.slice(-8).reverse()){
  const next={question:turn.question,answer:turn.answer};const length=next.question.length+next.answer.length;
  if(size+length>10000)break;
  result.unshift(next);size+=length;
 }
 return result;
}
export function readConversation(value:unknown):ChatTurn[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>8)throw Error('Ungültiger Gesprächsverlauf.');
 const turns=value.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['question','answer'].includes(key))||typeof item.question!=='string'||!item.question.trim()||item.question.length>1500||typeof item.answer!=='string'||!item.answer.trim()||item.answer.length>6000)throw Error('Ungültiger Gesprächsverlauf.');
  return {question:item.question,answer:item.answer};
 });
 return recentConversation(turns);
}
