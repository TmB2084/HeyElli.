// Testhilfe: ordnet einem Konto einen PDS-Benutzer der Simulator-Quelle zu (Pflicht zur Anmeldung, Migration 047).
// Jede Kennung ist eindeutig je Konto, weil ein PDS-Benutzer nur einem Konto zugeordnet sein darf.
export const SIMULATOR_WORKSPACE='00000000-0000-4000-8000-000000000001';
export async function assignPds(pool,userId,pdsUserUUID=`fixture-${userId}`){
 await pool.query('INSERT INTO platform.pds_user_mappings(workspace_id,user_id,pds_user_uuid) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET pds_user_uuid=excluded.pds_user_uuid',[SIMULATOR_WORKSPACE,userId,pdsUserUUID]);
 return pdsUserUUID;
}
