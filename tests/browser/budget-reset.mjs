// Test-fixture maintenance uses the same lock/order as normal request admission.
// Otherwise a late request can deadlock with a reset that has locked user rows first.
export async function resetFixtureBudget(pool){
 const client=await pool.connect();try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('heyelli:request-budget',0))");
  await client.query("UPDATE platform.resource_windows SET requests=0,window_start=now()-interval '2 minutes'");
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
