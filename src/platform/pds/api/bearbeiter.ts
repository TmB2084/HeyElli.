import {PdsProtocolError} from "./protocol.ts";
export type PdsActor={pdsUserUUID?:string};
// The actor must come from the verified server session, never from document input.
export function assignBearbeiter(data:Record<string,unknown>,actor:PdsActor) {
  const uuid=actor.pdsUserUUID;
  if(typeof uuid!=="string" || !uuid || uuid.length>200 || /\s/.test(uuid))throw new PdsProtocolError("PDS-Bearbeiterzuordnung fehlt.");
  return {...data,bearbeiterUUID:uuid};
}
