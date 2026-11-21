// Ordnerstruktur in SharePoint (Vorgabe 21.11.2026):
//   Objekte/<Stadt>/<straße_hausnummer>/<Gewerk>/<Einheit>_<dbid>/<Ablagetyp>/
// Quellen (PDS-OpenAPI, Handbuch): Straße/Ort = standort.strasse/ort; Gewerk = Fachbereich der Anlage (fachbereichUUID →
// /mitarbeiter/listfachbereiche); Einheit = bezeichnung + dbid (die PDS-Kennung „Kürzel“ liefert die API nicht).
//   Objekte/<Stadt>/<straße_hausnummer>/Allgemein/<Ablagetyp>/          (Objekt ohne technische Einheit)
//   Kunden/<kundenname>_<kundennummer>/<Ablagetyp>/                      (Kunde ohne technische Einheit)
//   Kunden/<kundenname>_<kundennummer>/Verträge/<vertrag>/               (Vertrag, ggf. mehrere Objekte)
// Serviceaufträge liegen bei der Einheit ihres Einsatzes; Dateinamen beginnen mit der Auftragsnummer.
export type DocumentLocation=
 |{kind:'unit';city:string;street:string;trade:string;unitName:string;unitId:string;namePrefix?:string}
 |{kind:'object';city:string;street:string;namePrefix?:string}
 |{kind:'customer';customerName:string;customerNumber:string;namePrefix?:string}
 |{kind:'contract';customerName:string;customerNumber:string;contractName:string;namePrefix?:string};
export type StorageType={key:string;label:string;sort:number;active:boolean};
export const defaultStorageTypes:StorageType[]=[['mails','Mails'],['berichte','Berichte'],['ruecklaeufe','Rückläufe'],['fotos','Fotos'],['vertraege','Verträge'],['angebote','Angebote'],['sonstiges','Sonstiges']].map(([key,label],index)=>({key,label,sort:(index+1)*10,active:true}));
const forbidden=/["*:<>?/\\|#%\x00-\x1f\x7f]/g;
// Ordnername für SharePoint: verbotene Zeichen entfernt, keine führenden/abschließenden Punkte oder Leerzeichen, max. 80 Zeichen.
export function folderName(value:string,fallback:string){const cleaned=value.normalize('NFC').replace(forbidden,' ').replace(/\s+/g,' ').trim().replace(/^[.\s]+|[.\s]+$/g,'').slice(0,80).trim();return cleaned||fallback;}
// Straße/Kundenname im Stil der Vorgabe: klein, Leerzeichen als Unterstrich (z. B. „Hauptstraße 21“ → „hauptstraße_21“).
export function slugName(value:string,fallback:string){return folderName(value.toLocaleLowerCase('de').replace(/[,;]+/g,' ').replace(/\s+/g,'_').replace(/_+/g,'_'),fallback);}
export function locationSegments(location:DocumentLocation):string[]{
 switch(location.kind){
  case 'unit':return ['Objekte',folderName(location.city,'ohne_ort'),slugName(location.street,'ohne_adresse'),folderName(location.trade,'ohne_gewerk'),folderName([location.unitName,location.unitId].filter(Boolean).join('_'),'einheit')];
  case 'object':return ['Objekte',folderName(location.city,'ohne_ort'),slugName(location.street,'ohne_adresse'),'Allgemein'];
  case 'customer':return ['Kunden',customerFolder(location.customerName,location.customerNumber)];
  case 'contract':return ['Kunden',customerFolder(location.customerName,location.customerNumber),'Verträge',folderName(location.contractName,'vertrag')];
 }
}
function customerFolder(name:string,number:string){const base=slugName(name,'kunde'),suffix=folderName(number,'');return suffix?`${base}_${suffix}`.slice(0,90):base;}
// Verträge sind selbst der Zielordner (keine weiteren Ablagetypen); alle übrigen Akten verzweigen nach Ablagetyp.
export const usesStorageTypes=(location:DocumentLocation)=>location.kind!=='contract';
export function previewPath(location:DocumentLocation,typeLabel?:string){return [...locationSegments(location),...(usesStorageTypes(location)&&typeLabel?[folderName(typeLabel,'Sonstiges')]:[])].join('/');}
// Lesbarer, eindeutiger Dateiname: Präfix (z. B. Auftragsnummer) + Originalname; bei Belegung „ (2)“, „ (3)“ …
export function remoteFileName(name:string,prefix='',attempt=1){const dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';const head=prefix&&!stem.startsWith(prefix)?prefix+'_':'';return folderName(`${head}${stem}${attempt>1?` (${attempt})`:''}`,'dokument').slice(0,150)+ext;}
// Adresse aus PDS: Straße mit Hausnummer und Ort getrennt (standort.strasse / standort.ort).
export function splitAddress(address:string){const [street='',rest='']=address.split(',').map(part=>part.trim());const city=rest.replace(/^\d{4,5}\s+/,'').trim();return {street,city};}
