import crypto from 'node:crypto';
import assert from 'node:assert/strict';
export const digest=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)||value instanceof Uint8Array?value:JSON.stringify(value)).digest('hex');
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const scope="(n.nspname in ('public','auth','storage') or n.nspname like 'cocal\\_%' escape '\\')";
const catalogQueries={
 schemas:`select n.nspname name,pg_get_userbyid(n.nspowner) owner,array(select x::text from unnest(coalesce(n.nspacl,acldefault('n',n.nspowner))) x order by x::text) acl from pg_namespace n where ${scope} order by 1`,
 relations:`select n.nspname schema,c.relname name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relreplident,c.relpersistence,pg_get_userbyid(c.relowner) owner,array(select x::text from unnest(coalesce(c.relacl,acldefault((case when c.relkind='S' then 's' else 'r' end)::"char",c.relowner))) x order by x::text) acl,c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace where ${scope} and c.relkind in('r','p','v','m','S') order by 1,2`,
 columns:`select n.nspname schema,c.relname name,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) type,a.attnotnull,a.attidentity,a.attgenerated,array(select x::text from unnest(coalesce(a.attacl,'{}'::aclitem[])) x order by x::text) acl,pg_get_expr(d.adbin,d.adrelid) default_value from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where ${scope} and c.relkind in('r','p','v','m','S') and a.attnum>0 and not a.attisdropped order by 1,2,3`,
 constraints:`select n.nspname schema,c.relname table_name,x.conname name,x.contype,x.convalidated,x.condeferrable,x.condeferred,pg_get_constraintdef(x.oid,true) definition from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where ${scope} order by 1,2,3`,
 policies:`select n.nspname schema,c.relname table_name,p.polname name,p.polcmd,p.polpermissive,array(select case when r=0 then 'public' else pg_get_userbyid(r)::text end from unnest(p.polroles) r order by 1) roles,pg_get_expr(p.polqual,p.polrelid) using_expression,pg_get_expr(p.polwithcheck,p.polrelid) check_expression from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where ${scope} order by 1,2,3`,
 functions:`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,pg_get_userbyid(p.proowner) owner,array(select x::text from unnest(coalesce(p.proacl,acldefault('f',p.proowner))) x order by x::text) acl,p.proconfig,p.prosecdef,p.proleakproof,p.provolatile,p.proparallel,p.proisstrict,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where ${scope} and p.prokind in('f','p') order by 1,2,3`,
 triggers:`select n.nspname schema,c.relname table_name,t.tgname name,t.tgenabled,pg_get_triggerdef(t.oid,true) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where ${scope} and not t.tgisinternal order by 1,2,3`,
 indexes:`select n.nspname schema,c.relname table_name,i.relname name,pg_get_indexdef(x.indexrelid) definition from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where ${scope} order by 1,2,3`,
 views:`select n.nspname schema,c.relname name,pg_get_viewdef(c.oid,true) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where ${scope} and c.relkind in('v','m') order by 1,2`,
 enums:`select n.nspname schema,t.typname name,e.enumsortorder,e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where ${scope} order by 1,2,3`,
 sequences:`select schemaname schema,sequencename name,sequenceowner owner,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname in('public','auth','storage') or schemaname like 'cocal\\_%' escape '\\' order by 1,2`,
 extensions:'select e.extname,e.extversion,n.nspname schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by 1',
 defaultPrivileges:`select pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'<GLOBAL>') schema,d.defaclobjtype object_type,array(select x::text from unnest(d.defaclacl) x order by x::text) acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by 1,2,3`,
 sequenceOwnership:`select n.nspname sequence_schema,s.relname sequence_name,tn.nspname table_schema,t.relname table_name,a.attname column_name,d.deptype from pg_class s join pg_namespace n on n.oid=s.relnamespace join pg_depend d on d.classid='pg_class'::regclass and d.objid=s.oid and d.refclassid='pg_class'::regclass and d.deptype in('a','i') join pg_class t on t.oid=d.refobjid join pg_namespace tn on tn.oid=t.relnamespace join pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid where ${scope} and s.relkind='S' order by 1,2,3,4,5`,
 partitionDefinitions:`select n.nspname schema,c.relname name,c.relkind,pg_get_partkeydef(c.oid) partition_key,pg_get_expr(c.relpartbound,c.oid) partition_bound from pg_class c join pg_namespace n on n.oid=c.relnamespace where ${scope} and(c.relkind='p' or c.relispartition) order by 1,2`,
 inheritance:`select n.nspname schema,c.relname name,pn.nspname parent_schema,p.relname parent_name,i.inhseqno from pg_inherits i join pg_class c on c.oid=i.inhrelid join pg_namespace n on n.oid=c.relnamespace join pg_class p on p.oid=i.inhparent join pg_namespace pn on pn.oid=p.relnamespace where ${scope} order by 1,2,5`,
};
export async function capture(query){
 await query('begin isolation level repeatable read read only');
 try{
  const tables=(await query(`select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where ${scope} and c.relkind in('r','p') order by 1,2`)).rows;
  const rows={};for(const table of tables){const name=table.schema+'.'+table.name;rows[name]=(await query('select to_jsonb(t)::text row from '+quote(table.schema)+'.'+quote(table.name)+' t')).rows.map(x=>x.row).sort();}
  const catalog={};for(const [name,sql]of Object.entries(catalogQueries))catalog[name]=(await query(sql)).rows;
  const sequences={};for(const s of catalog.sequences)sequences[s.schema+'.'+s.name]=(await query('select last_value::text,is_called from '+quote(s.schema)+'.'+quote(s.name))).rows[0];
  await query('commit');return {rows,catalog,sequences};
 }catch(error){await query('rollback');throw error;}
}
export function summary(snapshot){return {tables:Object.entries(snapshot.rows).map(([name,rows])=>({name,rows:rows.length,sha256:digest(rows)})),catalog:Object.fromEntries(Object.entries(snapshot.catalog).map(([name,rows])=>[name,{rows:rows.length,sha256:digest(rows)}])),sequences:summarySequences(snapshot),notValid:snapshot.catalog.constraints.filter(x=>!x.convalidated).map(x=>({schema:x.schema,table:x.table_name,name:x.name,validated:false})),sha256:digest(snapshot)};}
function summarySequences(s){return Object.fromEntries(Object.entries(s.sequences).map(([name,value])=>[name,{sha256:digest(value)}]));}
export function differences(expected,actual){
 const diffs=[];for(const section of ['rows','catalog','sequences'])for(const key of new Set([...Object.keys(expected[section]),...Object.keys(actual[section])]))if(digest(expected[section][key]??null)!==digest(actual[section][key]??null))diffs.push({section,key,expected:digest(expected[section][key]??null),actual:digest(actual[section][key]??null)});
 return diffs;
}
export function requireEqual(expected,actual){const diffs=differences(expected,actual);assert.equal(diffs.length,0,'RECOVERY_CONTENT_MISMATCH: '+JSON.stringify(diffs));return true;}
