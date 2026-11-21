import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loginAttempt} from '../login-attempt.ts';
test('login source headers are ignored unless an operator explicitly trusts an overwriting proxy',()=>{
 const request=new Request('http://localhost/api/simulator-session',{headers:{'x-forwarded-for':'192.0.2.1','x-real-ip':'192.0.2.2','x-heyelli-client-ip':'192.0.2.3'}});
 assert.deepEqual(loginAttempt(request,'password',' DEMO.Alex ',{}),{source:null,account:'demo.alex',channel:'password'});
 assert.equal(loginAttempt(request,'password','a',{AUTH_LOGIN_SOURCE_HEADER:'x-heyelli-client-ip'}).source,'192.0.2.3');
 for(const header of ['host','X-Client-IP','x-invalid header'])assert.throws(()=>loginAttempt(request,'password','a',{AUTH_LOGIN_SOURCE_HEADER:header}));
 for(const value of ['', '192.0.2.1, 192.0.2.2','not-an-ip'])assert.throws(()=>loginAttempt(new Request(request,{headers:{'x-client-ip':value}}),'password','a',{AUTH_LOGIN_SOURCE_HEADER:'x-client-ip'}));
});
test('equivalent IPv6 and mapped IPv4 source addresses normalize to one key',()=>{
 const source=value=>loginAttempt(new Request('http://localhost',{headers:{'x-client-ip':value}}),'password','a',{AUTH_LOGIN_SOURCE_HEADER:'x-client-ip'}).source;
 assert.equal(source('2001:0db8:0000:0000:0000:0000:0000:0001'),'2001:db8::1');
 for(const value of ['192.0.2.1','::ffff:192.0.2.1','0:0:0:0:0:ffff:c000:201'])assert.equal(source(value),'192.0.2.1');
});
