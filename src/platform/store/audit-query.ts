import type {PoolClient} from 'pg';
import {PlatformError} from './model.ts';
import {auditActionLabels,auditKind,type AuditEntry} from '../../system/einstellungen/audit-format.ts';
import {emptyAuditFilters,type AuditFilters} from '../../system/einstellungen/audit-filter.ts';
export type AuditPage={entries:(AuditEntry&{id:string})[];nextCursor:string|null;snapshot:string;actors:string[];actions:string[]};
export function auditFilters(params:URLSearchParams):AuditFilters{
 const filters={...emptyAuditFilters};for(const key of Object.keys(filters) as (keyof AuditFilters)[]){filters[key]=params.get(key)??'';if(filters[key].length>500)throw new PlatformError('Filter ist zu lang.');}
 for(const day of [filters.from,filters.to])if(day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day))throw new PlatformError('Ungültiges Filterdatum.');
 if(filters.from&&filters.to&&filters.from>filters.to)throw new PlatformError('Das Enddatum muss nach dem Anfangsdatum liegen.');return filters;
}
function identifier(value:string){if(!/^\d{1,19}$/.test(value)||BigInt(value)>BigInt('9223372036854775807'))throw new PlatformError('Ungültige Protokollseite.');return value;}
export async function queryAudit(client:PoolClient,filters:AuditFilters,options:{cursor?:string;snapshot?:string;limit?:number;facets?:boolean}={}):Promise<AuditPage>{
 const limit=options.limit??50;if(!Number.isSafeInteger(limit)||limit<1||limit>200)throw new PlatformError('Ungültige Seitengröße.');
 const snapshot=options.snapshot?identifier(options.snapshot):String((await client.query('SELECT coalesce(max(id),0)::text AS id FROM platform.audit_events')).rows[0].id);
 const values:unknown[]=[snapshot],where=['id <= $1::bigint'];
 const add=(value:unknown)=>{values.push(value);return '$'+values.length;};
 if(options.cursor)where.push('id < '+add(identifier(options.cursor))+'::bigint');
 if(filters.actor)where.push('actor_id = '+add(filters.actor));
 if(filters.action)where.push(filters.action==='calendar.changed'?"action LIKE 'calendar.field.%'":'action = '+add(filters.action));
 if(filters.from)where.push("created_at >= ("+add(filters.from)+"::date::timestamp AT TIME ZONE 'Europe/Berlin')");
 if(filters.to)where.push("created_at < ("+add(filters.to)+"::date+1)::timestamp AT TIME ZONE 'Europe/Berlin'");
 const search=filters.search.trim().toLocaleLowerCase('de');
 if(search){
  const param=add(search),actions=Object.entries(auditActionLabels).filter(([,label])=>label.toLocaleLowerCase('de').includes(search)).map(([key])=>key);
  const aliases=add(actions);
  // Search is literal (no wildcard semantics), with the same German value labels
  // used by copy/export. All predicates run in PostgreSQL before LIMIT.
  const valueText=(field:string)=>`CASE c->>'${field}' WHEN 'true' THEN 'Ja' WHEN 'false' THEN 'Nein' WHEN 'admin' THEN 'Administrator' WHEN 'dispatcher' THEN 'Disposition' WHEN 'reader' THEN 'Lesezugriff' WHEN 'dark' THEN 'Dunkel' WHEN 'light' THEN 'Hell' WHEN 'system' THEN 'System' ELSE c->>'${field}' END`;
  where.push(`(position(${param} in lower(concat_ws(' ',actor_id,target_id,action,changes::text,(SELECT string_agg(concat_ws(' ',c->>'label',${valueText('before')},${valueText('after')}),' ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(changes)='array' THEN changes ELSE '[]'::jsonb END) c)))) > 0 OR action=ANY(${aliases}::text[])${'termin geändert'.includes(search)?" OR action LIKE 'calendar.field.%'":''})`);
 }
 const result=await client.query(`SELECT id::text,actor_id AS "actorId",action,changes,target_id AS "targetId",created_at AS "createdAt" FROM platform.audit_events WHERE ${where.join(' AND ')} ORDER BY platform.audit_events.id DESC LIMIT ${add(limit+1)}`,values);
 const more=result.rows.length>limit,entries=result.rows.slice(0,limit);
 const facets=options.facets?await client.query("SELECT 'actor' AS kind,actor_id AS value FROM platform.audit_events WHERE id<=$1::bigint GROUP BY actor_id UNION ALL SELECT 'action',action FROM platform.audit_events WHERE id<=$1::bigint GROUP BY action ORDER BY kind,value LIMIT 1000",[snapshot]):{rows:[]};
 return {entries,nextCursor:more?entries.at(-1)!.id:null,snapshot,actors:facets.rows.filter(r=>r.kind==='actor').map(r=>r.value),actions:[...new Set(facets.rows.filter(r=>r.kind==='action').map(r=>auditKind(r.value)))]};
}
