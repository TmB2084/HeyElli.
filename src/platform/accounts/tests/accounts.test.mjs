import test from "node:test";
import assert from "node:assert/strict";
import {localLoginReplaced,pdsAssignmentSatisfied,ACCOUNT_ID,SIMULATOR_WORKSPACE,activeWorkspaceSql} from "../core.ts";
import {hashPassword,verifyPassword,validateNewPassword,generateInitialPassword,usernameInput,upnInput,MIN_PASSWORD_LENGTH} from "../password.ts";

test("Passwörter: scrypt-Hash mit Salz, Prüfung in konstanter Form, keine Klartexte",async()=>{
  const first=await hashPassword("fiktives-passwort-1"),second=await hashPassword("fiktives-passwort-1");
  assert.match(first,/^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/);
  assert.notEqual(first,second,"jedes Passwort bekommt ein eigenes Salz");assert.ok(!first.includes("fiktives"));
  assert.equal(await verifyPassword("fiktives-passwort-1",first),true);
  for(const wrong of ["fiktives-passwort-2","","x".repeat(300),null,undefined,42])assert.equal(await verifyPassword(wrong,first),false);
  for(const stored of [null,"","klartext","scrypt$1$8$1$aaaaaaaaaaaaaaaaaaaaaa$"+"a".repeat(86)])assert.equal(await verifyPassword("fiktives-passwort-1",stored),false);
});
test("Neue Passwörter: Mindestlänge, keine Steuerzeichen; Startpasswörter zufällig und lang genug",()=>{
  assert.throws(()=>validateNewPassword("x".repeat(MIN_PASSWORD_LENGTH-1)),/mindestens 12/);
  for(const bad of ["a\nbbbbbbbbbbbbb"," ".repeat(20),"x".repeat(257),undefined])assert.throws(()=>validateNewPassword(bad));
  assert.equal(validateNewPassword("ein langes Passwort"),"ein langes Passwort");
  const a=generateInitialPassword(),b=generateInitialPassword();assert.notEqual(a,b);assert.ok(a.length>=MIN_PASSWORD_LENGTH);validateNewPassword(a);
});
test("Benutzername und Microsoft-Anmeldeadresse werden normalisiert und geprüft",()=>{
  assert.equal(usernameInput("  Alex.Beispiel "),"alex.beispiel");
  for(const bad of ["ab","-start","mit leerzeichen","ümlaut",42,undefined])assert.throws(()=>usernameInput(bad));
  assert.equal(upnInput(" Alex@Example.Invalid "),"alex@example.invalid");assert.equal(upnInput(""),null);assert.equal(upnInput(null),null);
  for(const bad of ["kein-at","a b@example.invalid",7])assert.throws(()=>upnInput(bad));
});
test("aktive Microsoft-Anmeldung ersetzt die eigene Anmeldung, Deaktivieren stellt sie wieder her",()=>{
  assert.equal(localLoginReplaced("local",true),true);assert.equal(localLoginReplaced("local",false),false);
  assert.equal(localLoginReplaced("microsoft",true),false);assert.equal(localLoginReplaced("microsoft",false),false);
});
test("PDS-Zuordnung ist Pflicht zur Anmeldung, nur Administratoren sind ausgenommen",()=>{
  assert.equal(pdsAssignmentSatisfied("dispatcher",null),false);assert.equal(pdsAssignmentSatisfied("reader",""),false);
  assert.equal(pdsAssignmentSatisfied("reader","sim-employee-3"),true);assert.equal(pdsAssignmentSatisfied("admin",null),true);
});
test("Kontokennungen: neue Konten, fester Admin und bestehende Kennungen bleiben gültig",()=>{
  for(const id of ["heyelli-admin","konto:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","local-service-user","demo-ad:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","entra:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222"])assert.ok(ACCOUNT_ID.test(id),id);
  for(const id of ["admin","konto:xyz","entra:abc","' OR 1=1"])assert.ok(!ACCOUNT_ID.test(id),id);
  assert.ok(activeWorkspaceSql.includes(SIMULATOR_WORKSPACE)&&activeWorkspaceSql.includes("pds-readonly"));
});

test('same-origin checks use the actual host and port and reject cross-site or malformed origins',async()=>{
 const {isSameOrigin}=await import('../core.ts');
 const request=(origin,host)=>new Request('http://localhost:3100/api/simulator-session',{headers:{origin,host}});
 assert.equal(isSameOrigin(request('http://127.0.0.1:3100','127.0.0.1:3100')),true);
 assert.equal(isSameOrigin(request('https://outside.example.invalid','127.0.0.1:3100')),false);
 assert.equal(isSameOrigin(request('http://127.0.0.1:3000','127.0.0.1:3100')),false);
 assert.equal(isSameOrigin(request('http://localhost:3100','localhost:3100/invalid')),false);
 assert.equal(isSameOrigin(new Request('http://localhost:3100')),false);
});

test('same-origin checks behind a reverse proxy on the default port use only the declared public origin',async()=>{
 const {isSameOrigin}=await import('../core.ts');
 const request=(origin,host)=>new Request('http://localhost:3000/api/simulator-session',{headers:{origin,host}});
 const previous=process.env.HEYELLI_PUBLIC_ORIGIN;
 try{
  delete process.env.HEYELLI_PUBLIC_ORIGIN;
  // A Host without port must not inherit the internal port 3000.
  assert.equal(isSameOrigin(request('http://heyelli.example.invalid','heyelli.example.invalid')),true);
  assert.equal(isSameOrigin(request('http://heyelli.example.invalid:3000','heyelli.example.invalid')),false);
  process.env.HEYELLI_PUBLIC_ORIGIN='https://heyelli.example.invalid';
  assert.equal(isSameOrigin(request('https://heyelli.example.invalid','heyelli.example.invalid')),true);
  assert.equal(isSameOrigin(request('http://heyelli.example.invalid','heyelli.example.invalid')),false);
  // The declared origin never applies to a different validated Host.
  assert.equal(isSameOrigin(request('https://heyelli.example.invalid','other.example.invalid')),false);
  assert.equal(isSameOrigin(request('http://other.example.invalid','other.example.invalid')),true);
 }finally{if(previous===undefined)delete process.env.HEYELLI_PUBLIC_ORIGIN;else process.env.HEYELLI_PUBLIC_ORIGIN=previous;}
});
