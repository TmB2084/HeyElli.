import {test} from 'node:test';
import assert from 'node:assert/strict';
import {naturalAnswer,elliAnswerStyle} from '../language.ts';
test('language validation rejects known malformed sentences and preserves factual and permission wording verbatim',()=>{
 for(const text of ['Dies ist ermöglicht durch eine Sicherung.','Beim Neuerladen werden Fragen wiederzuvermitteln.','Nachdem du einen Projektleiter zuweisen hast.'])assert.throws(()=>naturalAnswer(text));
 for(const text of ['Zum Verschieben brauchst du Disposition oder Administrator.','Eine Mitarbeiterzuordnung ist für die Tauschfreigabe nicht nötig.','Deine Frage wird automatisch gesichert. Nach dem Neuladen kannst du weiterschreiben.'])assert.equal(naturalAnswer(text),text);
 assert.match(elliAnswerStyle,/Berechtigungen.*korrekt bleiben/);
 assert.match(elliAnswerStyle,/zwei kurze Sätze/);
});
