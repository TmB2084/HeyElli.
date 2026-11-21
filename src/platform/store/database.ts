import "server-only";
import {Pool} from "pg";
import {BoundedPool} from "../resource-budgets/pool.ts";
import {databaseConfig} from "./config.ts";
const state=globalThis as typeof globalThis & {heyelliPool?:Pool};
export function database() {
  if (state.heyelliPool) return state.heyelliPool;
  const pool=new BoundedPool(databaseConfig(process.env));
  // Do not log connection errors or configuration values.
  pool.on("error",()=>{});
  state.heyelliPool=pool;
  return pool;
}
