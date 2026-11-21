import {readSystemDefaults} from "../../../platform/store/setup.ts";
import {permitted} from "../../../platform/store/model.ts";
import {colorSources} from "./color-layout.ts";
import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import type {StatusCatalog} from "./status-catalog.ts";
import {CalendarError,type CalendarColor} from "./model.ts";
import {checkColorRules,readLegacyColorRules,normalizeColorRules,colorRuleIdentity} from "./colors.ts";
import {checkColorLayouts,type ColorLayouts} from "./color-layout.ts";
import {checkAppearance,patchPreferences,type CalendarPreferences} from "./preferences.ts";
import {legacyColors,legacyPreferences,legacyOwners,settingsOwner} from "./legacy-settings.ts";
type Colors={rules:CalendarColor[];colorLayouts:ColorLayouts;version:string};
type PreferenceRow={calendar:CalendarPreferences;calendar_version:number;appearance:"dark"|"light"|"system"|null;appearance_version:number};
export function postgresSettings(pool:Pool,root:string) {
  async function transaction<T>(work:(client:PoolClient)=>Promise<T>) {
    const client=await pool.connect();
    try {await client.query("BEGIN");const result=await work(client);await client.query("COMMIT");return result;}
    catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
  async function ensureColors(client:PoolClient) {
    if((await client.query("SELECT id FROM platform.calendar_colors WHERE id='calendar'")).rowCount)return;
    const initial=legacyColors(root);
    await client.query("INSERT INTO platform.calendar_colors(id,settings,version) VALUES('calendar',$1,$2) ON CONFLICT DO NOTHING",[JSON.stringify(initial),randomUUID()]);
  }
  async function ensurePreferences(client:PoolClient,owner:string) {
    if((await client.query("SELECT owner_hash FROM platform.user_preferences WHERE owner_hash=$1",[owner])).rowCount)return;
    const defaults=await readSystemDefaults(client);
    const initial=legacyPreferences(root,owner,{selection:null,showTechnicianBadges:defaults.showTechnicianBadges,limitWorkingHours:defaults.limitWorkingHours,showTentative:defaults.showTentative});
    await client.query("INSERT INTO platform.user_preferences(owner_hash,calendar) VALUES($1,$2) ON CONFLICT DO NOTHING",[owner,JSON.stringify(initial)]);
  }
  function colors(row:{settings:{rules:unknown;colorLayouts:unknown};version:string}):Colors {
    return {rules:readLegacyColorRules(row.settings.rules),colorLayouts:checkColorLayouts(row.settings.colorLayouts),version:row.version};
  }
  async function lockedColors(client:PoolClient) {
    await ensureColors(client);
    const {rows}=await client.query("SELECT settings,version FROM platform.calendar_colors WHERE id='calendar' FOR UPDATE");
    return colors(rows[0]);
  }
  async function lockedPreferences(client:PoolClient,owner:string):Promise<PreferenceRow> {
    await ensurePreferences(client,owner);
    return (await client.query<PreferenceRow>("SELECT calendar,calendar_version,appearance,appearance_version FROM platform.user_preferences WHERE owner_hash=$1 FOR UPDATE",[owner])).rows[0];
  }
  const colorStore={
    async readWithCatalogs(catalogs:StatusCatalog[]):Promise<Colors> {
      return transaction(async client=>{
        const current=await lockedColors(client),rules=normalizeColorRules(current.rules,catalogs);
        if(JSON.stringify(rules)===JSON.stringify(current.rules))return current;
        const version=randomUUID();
        await client.query("UPDATE platform.calendar_colors SET settings=$1,version=$2,updated_at=now() WHERE id='calendar'",[JSON.stringify({rules,colorLayouts:current.colorLayouts}),version]);
        return {rules,colorLayouts:current.colorLayouts,version};
      });
    },
    async write(raw:unknown,expectedVersion:unknown,layoutInput?:unknown,actor?:string):Promise<Colors> {
      return transaction(async client=>{
        if(actor){const {rows}=await client.query("SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE",[actor]);if(!rows[0]?.enabled||!permitted(rows[0],"admin"))throw new CalendarError("Administratorrechte erforderlich.",403);}
        const current=await lockedColors(client);
        if(expectedVersion!==current.version)throw new CalendarError("Farben wurden zwischenzeitlich geändert. Bitte neu laden.",409);
        const rules=checkColorRules(raw),colorLayouts=checkColorLayouts(layoutInput??current.colorLayouts),version=randomUUID();
        await client.query("UPDATE platform.calendar_colors SET settings=$1,version=$2,updated_at=now() WHERE id='calendar'",[JSON.stringify({rules,colorLayouts}),version]);
        if(actor){
          const previous=new Map(current.rules.map(rule=>[colorRuleIdentity(rule),rule])),next=new Map(rules.map(rule=>[colorRuleIdentity(rule),rule]));
          const changes:{field:string;label:string;before:unknown;after:unknown}[]=[];
          for(const key of new Set([...previous.keys(),...next.keys()])){
            const before=previous.get(key),after=next.get(key),rule=after??before!;
            if(before?.farbe!==after?.farbe)changes.push({field:`rule:${key}`,label:`Farbe · ${[rule.typ,rule.category&&`Kategorie ${rule.category}`,rule.status,rule.orderType,rule.orderStatusName??rule.orderStatus,rule.contractService,rule.vacationApproval].filter(Boolean).join(" · ")||key}`,before:before?.farbe??null,after:after?.farbe??null});
          }
          for(const type of Object.keys(colorLayouts))for(const slot of ["main","secondary"] as const){
            const before=current.colorLayouts[type][slot],after=colorLayouts[type][slot];
            if(before!==after)changes.push({field:`layout:${type}:${slot}`,label:`${type} · ${slot==="main"?"Hauptfarbe":"Nebenfarbe"}`,before:before?colorSources[before]:null,after:after?colorSources[after]:null});
          }
          if(changes.length)await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'calendar.colors.updated','calendar',$2::jsonb)",[actor,JSON.stringify(changes)]);
        }
        return {rules,colorLayouts,version};
      });
    }
  };
  const selectionStore={
    async readSettings(identity:string) {
      const owner=settingsOwner(identity);
      return transaction(async client=>{const row=await lockedPreferences(client,owner);return {...row.calendar,version:row.calendar_version};});
    },
    async update(identity:string,patch:unknown,expectedVersion:unknown) {
      const owner=settingsOwner(identity);
      return transaction(async client=>{
        const row=await lockedPreferences(client,owner);
        if(expectedVersion!==row.calendar_version)throw new CalendarError("Anzeigeeinstellungen wurden zwischenzeitlich geändert. Bitte neu laden.",409);
        const calendar=patchPreferences(row.calendar,patch),version=row.calendar_version+1;
        await client.query("UPDATE platform.user_preferences SET calendar=$1,calendar_version=$2,updated_at=now() WHERE owner_hash=$3",[JSON.stringify(calendar),version,owner]);
        return {...calendar,version};
      });
    }
  };
  const appearanceStore={
    async read(identity:string) {
      return transaction(async client=>{const row=await lockedPreferences(client,settingsOwner(identity));return {appearance:row.appearance,version:row.appearance_version};});
    },
    async write(identity:string,input:unknown,expectedVersion:unknown,importIfUnset=false) {
      const appearance=checkAppearance(input),owner=settingsOwner(identity);
      return transaction(async client=>{
        const row=await lockedPreferences(client,owner);
        // Importing an old browser preference never overwrites an existing server value.
        if(importIfUnset&&row.appearance!==null)return {appearance:row.appearance,version:row.appearance_version};
        if(expectedVersion!==row.appearance_version)throw new CalendarError("Darstellung wurde zwischenzeitlich geändert. Bitte neu laden.",409);
        const version=row.appearance_version+1;
        await client.query("UPDATE platform.user_preferences SET appearance=$1,appearance_version=$2,updated_at=now() WHERE owner_hash=$3",[appearance,version,owner]);
        return {appearance,version};
      });
    }
  };
  return {colorStore,selectionStore,appearanceStore,
    async importLegacy() {
      return transaction(async client=>{
        // Serialize import commands. Existing PostgreSQL rows always take precedence.
        await client.query("SELECT pg_advisory_xact_lock(741963283)");
        const before=(await client.query("SELECT count(*)::int AS n FROM platform.user_preferences")).rows[0].n;
        await ensureColors(client);
        for(const owner of legacyOwners(root))await ensurePreferences(client,owner);
        const after=(await client.query("SELECT count(*)::int AS n FROM platform.user_preferences")).rows[0].n;
        return {importedUsers:after-before};
      });
    }
  };
}
