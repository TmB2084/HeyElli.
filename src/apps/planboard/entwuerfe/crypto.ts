import {gcm} from '@noble/ciphers/aes.js';
import {bytesToHex,hexToBytes} from '@noble/ciphers/utils.js';
export type DraftKey={keyId:string;key:string};
export type Envelope={v:3;keyId:string;nonce:string;data:string};
export function encryptDraft(key:DraftKey,storageKey:string,text:string){const nonce=crypto.getRandomValues(new Uint8Array(12));return JSON.stringify({v:3,keyId:key.keyId,nonce:bytesToHex(nonce),data:bytesToHex(gcm(hexToBytes(key.key),nonce,new TextEncoder().encode(storageKey)).encrypt(new TextEncoder().encode(text)))} satisfies Envelope);}
export function decryptDraft(key:DraftKey,storageKey:string,text:string){const v=JSON.parse(text) as Envelope;if(v.v!==3||v.keyId!==key.keyId||typeof v.nonce!=='string'||typeof v.data!=='string'||v.nonce.length!==24||v.data.length>16*1024*1024)throw Error('Entwurf kann für dieses Benutzerkonto nicht entschlüsselt werden.');return new TextDecoder('utf-8',{fatal:true}).decode(gcm(hexToBytes(key.key),hexToBytes(v.nonce),new TextEncoder().encode(storageKey)).decrypt(hexToBytes(v.data)));}
export function ownEnvelope(text:string,keyId:string){try{const v=JSON.parse(text);return v.v===3&&v.keyId===keyId;}catch{return false;}}
export function assertDraftKey(value:unknown):asserts value is DraftKey{const v=value as DraftKey;if(!v||typeof v.keyId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.keyId)||typeof v.key!=='string'||!/^[a-f0-9]{64}$/i.test(v.key))throw Error('Geschützter Entwurfsschlüssel ist nicht verfügbar. Vorhandene Eingaben bleiben erhalten.');}
