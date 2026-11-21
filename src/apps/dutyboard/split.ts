import {berlinWall,wallInstant,type CalendarEvent,type Resource} from '../planboard/kalender/domain.ts';
export function dutySplit(original:CalendarEvent,splitAt:unknown,resourceId:unknown,resources:Resource[],events:CalendarEvent[],now=new Date()){
 if(original.type!=='FREIER')throw new Error('Nur freie Bereitschaftstermine können geteilt werden.');
 if(original.fixed)throw new Error('Fixierte Bereitschaften können nicht geteilt werden.');
 if(original.resourceIds.length!==1)throw new Error('Bereitschaft muss genau einem Mitarbeiter zugeordnet sein.');
 if(typeof splitAt!=='string'||typeof resourceId!=='string')throw new Error('Übergabezeitpunkt und Mitarbeiter fehlen.');
 const split=wallInstant(splitAt),instant=Date.parse(split);
 if(instant<=Date.parse(original.start)||instant>=Date.parse(original.end)||instant<=now.getTime())throw new Error('Die Übergabe muss innerhalb der Bereitschaft und in der Zukunft liegen.');
 const person=resources.find(item=>item.id===resourceId);
 if(!person||original.resourceIds.includes(resourceId))throw new Error('Bitte einen anderen verfügbaren Mitarbeiter auswählen.');
 if(person.planningFrom&&person.planningFrom>splitAt.slice(0,10)||person.planningTo&&person.planningTo<berlinWall(original.end).slice(0,10))throw new Error('Mitarbeiter ist nicht für den gesamten zweiten Teil planbar.');
 if(events.some(item=>item.id!==original.id&&item.resourceIds.includes(resourceId)&&Date.parse(item.start)<Date.parse(original.end)&&Date.parse(item.end)>instant&&(original.categories.some(id=>item.categories.includes(id))||item.status!=='FREI'&&['URLAUB','ABWESENHEIT','PRIVATE_ABWESENHEIT'].includes(item.type))))throw new Error('Der zweite Mitarbeiter hat in diesem Zeitraum bereits Bereitschaft oder ist abwesend.');
 return {split,resourceId};
}
