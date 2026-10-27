'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');

// Todo acesso ao banco e toda gravação são simulados em memória.
function server(options={}){
 const initial=options.snapshot||{votos:{'10':4},branco:1,nulo:2,total:7,urnas:{'terminal-antigo':true},operacoes:[crypto.randomUUID()],encerrada:!!options.closed};
 const root=path.resolve(__dirname,'..'), dbPath=path.join(root,'dados','votos.json');
 const config={titulo:'Teste',chapas:[{numero:'10',nome:'Teste'}]};
 const files=new Map([[dbPath,JSON.stringify(initial)],[path.join(root,'config.json'),JSON.stringify(config)]]);
 const isBackup=filename=>filename.includes(path.sep+'backups'+path.sep);
 const fakeFs={mkdirSync(){},existsSync(filename){return files.has(filename);},readFileSync(filename){return files.get(filename);},writeFileSync(filename,data){if(options.failBackup&&isBackup(filename))throw Error('Backup indisponível');files.set(filename,data);},renameSync(from,to){if(options.failCommit)throw Error('Falha de gravação');files.set(to,files.get(from));files.delete(from);}};
 const context={require(name){if(name==='node:fs')return fakeFs;if(name==='node:http')return {createServer(){return {on(){},listen(){}}}};return require(name);},__dirname:root,process:{env:{ADMIN_PASSWORD:'test-password'},exit(){throw Error('Servidor exigiu credenciais extras');}},console:{log(){},error(){}},URL};
 vm.createContext(context);vm.runInContext(source+'\nglobalThis.handle=handler;',context);
 return {db:()=>JSON.parse(files.get(dbPath)),backups:()=>[...files].filter(([name])=>isBackup(name)).map(([name,data])=>({name,data:JSON.parse(data)})),async request(method,url,body,pass){
  const req=new EventEmitter();Object.assign(req,{method,url,headers:{'x-admin-password':pass}});
  const res={writeHead(status){this.status=status;},end(data){this.body=JSON.parse(data);}};
  const pending=context.handle(req,res);
  queueMicrotask(()=>{req.emit('data',JSON.stringify(body||{}));req.emit('end');});
  await pending;return {status:res.status,body:res.body};
 }};
}

test('aceita votos consecutivos sem PIN e preserva registros anteriores e deduplicação',async()=>{
 const s=server();const before=s.db();const id='terminal-teste-123';
 const state=await s.request('GET','/api/estado?id='+id);assert.equal(state.body.liberada,true);
 const vote={id,escolha:'10',operacao:crypto.randomUUID(),eleicao:'inicial'};
 assert.equal((await s.request('POST','/api/votar',vote)).status,200);
 assert.equal((await s.request('POST','/api/votar',vote)).body.duplicado,true);
 for(const escolha of ['BRANCO','NULO'])assert.equal((await s.request('POST','/api/votar',{id,escolha,operacao:crypto.randomUUID(),eleicao:'inicial'})).status,200);
 const after=s.db();assert.equal(after.total,before.total+3);assert.equal(after.votos['10'],5);
 assert.equal(after.branco,2);assert.equal(after.nulo,3);
 assert.deepEqual(after.urnas,before.urnas);assert.equal(after.operacoes[0],before.operacoes[0]);
});

test('valida escolha e mantém senha administrativa e encerramento efetivos',async()=>{
 const s=server();const vote={id:'terminal-teste-123',escolha:'10',operacao:crypto.randomUUID(),eleicao:'inicial'};
 assert.equal((await s.request('POST','/api/votar',{...vote,escolha:'99'})).status,400);
 assert.equal((await s.request('POST','/api/admin/encerrar')).status,401);
 assert.equal((await s.request('POST','/api/admin/encerrar',{},'test-password')).status,200);
 assert.equal((await s.request('GET','/api/estado?id='+vote.id)).body.liberada,false);
 assert.equal((await s.request('POST','/api/votar',vote)).status,403);
 assert.equal(s.db().total,7);
});

test('nova eleição exige senha, encerramento e identificação da eleição correta',async()=>{
 const s=server();const before=s.db();
 assert.equal((await s.request('POST','/api/admin/nova',{eleicao:'inicial'})).status,401);
 assert.equal((await s.request('POST','/api/admin/nova',{eleicao:'inicial'},'test-password')).status,409);
 assert.deepEqual(s.db(),before);assert.equal(s.backups().length,0);
 await s.request('POST','/api/admin/encerrar',{},'test-password');
 assert.equal((await s.request('POST','/api/admin/nova',{eleicao:'outra'},'test-password')).status,409);
 assert.equal(s.db().encerrada,true);assert.equal(s.backups().length,0);
});

test('arquiva votos e configuração antes de abrir nova eleição zerada, sem duplicar início',async()=>{
 const s=server({closed:true});const previous=s.db();
 const results=await Promise.all([1,2].map(()=>s.request('POST','/api/admin/nova',{eleicao:'inicial'},'test-password')));
 assert.deepEqual(results.map(r=>r.status),[200,409]);
 assert.match(results[0].body.backup,/^dados\/backups\/eleicao-/);
 const db=s.db();assert.equal(db.total,0);assert.deepEqual(db.votos,{'10':0});
 assert.equal(db.branco,0);assert.equal(db.nulo,0);assert.equal(db.encerrada,false);
 assert.deepEqual(db.operacoes,[]);assert.deepEqual(db.urnas,{});assert.notEqual(db.eleicao,'inicial');
 const archives=s.backups();assert.equal(archives.length,2);
 assert.deepEqual(archives.find(b=>b.name.endsWith('votos.json')).data,previous);
 assert.equal(archives.find(b=>b.name.endsWith('config-salva.json')).data.chapas[0].nome,'Teste');
 assert.equal((await s.request('GET','/api/config')).body.eleicao,db.eleicao);
 const delayed={id:'terminal-teste-123',escolha:'10',operacao:crypto.randomUUID(),eleicao:'inicial'};
 assert.equal((await s.request('POST','/api/votar',delayed)).status,409);
 assert.equal((await s.request('POST','/api/votar',{...delayed,eleicao:db.eleicao})).status,200);
 const restarted=server({snapshot:s.db()});
 assert.equal((await restarted.request('GET','/api/config')).body.eleicao,db.eleicao);
 assert.equal(restarted.db().total,1);
});

for(const failure of ['failBackup','failCommit'])test('preserva eleição anterior se falhar '+failure,async()=>{
 const s=server({closed:true,[failure]:true});const previous=s.db();
 assert.equal((await s.request('POST','/api/admin/nova',{eleicao:'inicial'},'test-password')).status,500);
 assert.deepEqual(s.db(),previous);
 const result=await s.request('GET','/api/admin/resultado',{},'test-password');
 assert.equal(result.body.total,previous.total);assert.equal(result.body.encerrada,true);
});
