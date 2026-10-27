'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/admin.js'),'utf8');

function panel(options={}){
 const elements=new Map(),requests=[];
 const element=()=>({textContent:'',value:'test-password',disabled:false,children:[],appendChild(child){this.children.push(child);},replaceChildren(){this.children=[];}});
 const document={createElement:element,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
 document.getElementById('nova').disabled=true;
 let result={encerrada:options.open?false:true,eleicao:'inicial',total:7,votos:{'10':4},branco:1,nulo:2,chapas:[{numero:'10',nome:'Teste'}]};
 const context={document,confirm:()=>options.cancel?false:true,async fetch(url,opts){
  requests.push({url,...opts});assert.equal(opts.headers['X-Admin-Password'],'test-password');
  if(url==='/api/admin/resultado')return {ok:true,json:async()=>result};
  if(url==='/api/admin/nova'){
   assert.equal(JSON.parse(opts.body).eleicao,'inicial');
   if(options.fail)return {ok:false,json:async()=>({erro:'Falha no backup. Eleição anterior preservada.'})};
   result={...result,total:0,votos:{'10':0},branco:0,nulo:0,encerrada:false,eleicao:'nova'};
   return {ok:true,json:async()=>({ok:true,backup:'dados/backups/eleicao-teste'})};
  }
  throw Error('Unexpected route: '+url);
 }};
 vm.runInNewContext(source,context);
 return {get:id=>document.getElementById(id),requests};
}

test('painel habilita nova eleição só após consultar eleição encerrada e impede clique duplo',async()=>{
 const p=panel();assert.equal(p.get('nova').disabled,true);
 await p.get('atualizar').onclick();assert.equal(p.get('nova').disabled,false);
 await Promise.all([p.get('nova').onclick(),p.get('nova').onclick()]);
 assert.equal(p.requests.filter(r=>r.url==='/api/admin/nova').length,1);
 assert.equal(p.get('nova').disabled,true);
 assert.match(p.get('msg').textContent,/Nova eleição iniciada com zero votos/);
 assert.match(p.get('msg').textContent,/dados\/backups\/eleicao-teste/);
 const text=p.get('dados').children[0].textContent;
 assert.match(text,/ABERTA/);assert.match(text,/Total de votos: 0/);
});

test('painel não inicia outra eleição se estiver aberta ou se a confirmação for cancelada',async()=>{
 for(const options of [{open:true},{cancel:true}]){
  const p=panel(options);await p.get('atualizar').onclick();await p.get('nova').onclick();
  assert.equal(p.requests.some(r=>r.url==='/api/admin/nova'),false);
 }
});

test('painel apresenta erro de backup sem apresentar contagem zerada',async()=>{
 const p=panel({fail:true});await p.get('atualizar').onclick();await p.get('nova').onclick();
 assert.match(p.get('msg').textContent,/Falha no backup/);
 assert.match(p.get('dados').children[0].textContent,/Total de votos: 7/);
 assert.equal(p.get('nova').disabled,false);
});
