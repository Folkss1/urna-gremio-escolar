'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../public/urna.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function terminal(savedId, options={}){
 const elements=new Map();
 const document={activeElement:null,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},createElement:()=>element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
 function element(){return {children:[],listeners:{},textContent:'',value:'',hidden:false,addEventListener(type,fn){this.listeners[type]=fn;},appendChild(child){this.children.push(child);},replaceChildren(){this.children=[];},blur(){if(document.activeElement===this)document.activeElement=null;}};}
 const timers=[], intervals=[], tones=[];
 let closed=false, election='inicial';
 class AudioContext {
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};}
  resume(){this.state='running';return Promise.resolve();}
  createOscillator(){let frequency;return {frequency:{setValueAtTime(value){frequency=value;}},connect(){},disconnect(){},start(){tones.push(frequency);},stop(){}};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 const requests=[];
 const storage=new Map(savedId?[['urna_id',savedId]]:[]);
 const context={document,Uint8Array,AudioContext:options.noAudio?undefined:AudioContext,crypto:{getRandomValues:bytes=>webcrypto.getRandomValues(bytes)},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout(fn,ms){timers.push({fn,ms});},setInterval(fn){intervals.push(fn);},async fetch(url,opts={}){
  const body=opts.body?JSON.parse(opts.body):null;
  requests.push({url,body});
  let data;
  if(url==='/api/config')data={titulo:'Teste',chapas:options.chapas||[{numero:'10',nome:'Chapa teste'}],eleicao:election};
  else if(url.startsWith('/api/estado'))data={liberada:!closed,encerrada:closed,eleicao:election};
  else if(url==='/api/votar'){if(options.failVote)return {ok:false,json:async()=>({erro:'Falha de teste'})};data={ok:true};}
  else throw Error('Unexpected route: '+url);
  return {ok:true,json:async()=>data};
 }};
 vm.runInNewContext(source,context);
 const get=id=>document.getElementById(id);
 return {get,document,requests,storage,tones,timers,async poll(){await intervals[0]();},close(){closed=true;},newElection(){closed=false;election="seguinte";},next(){const timer=timers.shift();assert.equal(timer.ms,3000);timer.fn();},key(key){let prevented=false;document.listeners.keydown({key,preventDefault(){prevented=true;}});return prevented;},digit(n){get('keys').listeners.click({target:{closest:()=>({dataset:{digit:n}})}});},votes:()=>requests.filter(r=>r.url==='/api/votar'),text(){function content(e){return e.textContent+e.children.map(content).join('');}return content(get('content'));}};
}

test('HTTP local sem randomUUID: vota diretamente e aguarda FIM antes do próximo voto',async()=>{
 const t=terminal();await tick();
 assert.match(t.get('status').textContent,/pronta para votar/);
 const id=t.storage.get('urna_id');
 assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.equal(t.key('1'),true);t.key('0');
 assert.match(t.text(),/Chapa teste/);
 assert.deepEqual(t.tones,[1200,1200]);
 t.key('Enter');await tick();
 assert.equal(t.votes().length,1);
 assert.equal(t.votes()[0].body.escolha,'10');assert.equal(t.votes()[0].body.id,id);
 assert.match(t.votes()[0].body.operacao,/^[a-f0-9-]{36}$/);
 assert.equal(t.text(),'FIM');assert.deepEqual(t.tones.slice(-4),[1800,1800,1800,2200]);
 await t.poll();assert.equal(t.text(),'FIM');
 t.key('1');t.key('0');t.key('Enter');await tick();assert.equal(t.votes().length,1);
 t.next();t.key('1');t.key('0');t.key('Enter');await tick();assert.equal(t.votes().length,2);
 assert.notEqual(t.votes()[0].body.operacao,t.votes()[1].body.operacao);
 assert.equal(t.requests.some(r=>r.url==='/api/liberar'),false);
});

test('preserva ID existente e botões numéricos, CORRIGE, BRANCO e CONFIRMA',async()=>{
 const id='terminal-existente-123';const t=terminal(id);await tick();
 assert.equal(t.storage.get('urna_id'),id);
 t.digit('9');t.digit('9');assert.match(t.text(),/VOTO NULO/);
 t.get('corrige').listeners.click();assert.doesNotMatch(t.text(),/VOTO NULO/);
 t.get('branco').listeners.click();assert.match(t.text(),/VOTO EM BRANCO/);
 t.get('corrige').listeners.click();t.digit('1');t.digit('0');
 await t.get('confirma').listeners.click();assert.equal(t.votes()[0].body.escolha,'10');
 t.next();t.get('branco').listeners.click();await t.get('confirma').listeners.click();
 assert.equal(t.votes()[1].body.escolha,'BRANCO');
 t.next();t.digit('9');t.digit('9');await t.get('confirma').listeners.click();
 assert.equal(t.votes()[2].body.escolha,'NULO');
 assert.equal(new Set(t.votes().map(v=>v.body.operacao)).size,3);
});

test('não toca conclusão nem mostra FIM se o servidor rejeitar o voto',async()=>{
 const t=terminal(undefined,{failVote:true});await tick();t.digit('1');t.digit('0');
 await t.get('confirma').listeners.click();
 assert.equal(t.tones.includes(2200),false);assert.notEqual(t.text(),'FIM');
 assert.match(t.get('status').textContent,/Falha de teste/);assert.equal(t.timers.length,0);
});

test('continua votando sem suporte de áudio e respeita eleição encerrada',async()=>{
 const t=terminal(undefined,{noAudio:true});await tick();t.digit('1');t.digit('0');
 await t.get('confirma').listeners.click();assert.equal(t.text(),'FIM');
 t.close();await t.poll();t.next();assert.match(t.text(),/ELEIÇÃO ENCERRADA/);
 t.digit('1');t.digit('0');t.get('branco').listeners.click();t.key('Enter');await tick();
 assert.equal(t.votes().length,1);
});

test('reconhece nova eleição sem recarregar e limpa a escolha anterior',async()=>{
 const t=terminal();await tick();t.digit('1');t.digit('0');
 t.close();await t.poll();assert.match(t.text(),/ENCERRADA/);
 t.newElection();await t.poll();assert.match(t.get('status').textContent,/pronta para votar/);
 await t.get('confirma').listeners.click();assert.equal(t.votes().length,0);
 t.digit('1');t.digit('0');await t.get('confirma').listeners.click();
 assert.equal(t.votes()[0].body.eleicao,'seguinte');assert.equal(t.text(),'FIM');
});

test('temporizador da eleição anterior não apaga FIM da nova eleição',async()=>{
 const t=terminal();await tick();t.digit('1');t.digit('0');await t.get('confirma').listeners.click();
 t.newElection();await t.poll();t.digit('1');t.digit('0');await t.get('confirma').listeners.click();
 t.next();assert.equal(t.text(),'FIM');
 t.next();assert.match(t.get('status').textContent,/pronta para votar/);
});

test('exibe o cartaz correspondente a 01, 02 e 03 e o remove ao corrigir, votar branco ou nulo',async()=>{
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../config.json'),'utf8'));
 const t=terminal(undefined,{chapas:config.chapas});await tick();
 const images=()=>t.get('content').children.filter(e=>e.className==='chapa-imagem');
 for(const numero of ['01','02','03']){
  const chapa=config.chapas.find(c=>c.numero===numero);
  t.digit(numero[0]);assert.equal(images().length,0);
  t.digit(numero[1]);assert.equal(images().length,1);
  assert.equal(images()[0].src,`/imagens/chapa-${numero}.jpeg`);
  assert.equal(images()[0].alt,`Cartaz da chapa ${numero} — ${chapa.nome}`);
  assert.equal(fs.existsSync(path.join(__dirname,'../public',chapa.imagem)),true);
  t.get('corrige').listeners.click();assert.equal(images().length,0);
 }
 t.digit('0');t.digit('1');t.get('branco').listeners.click();assert.equal(images().length,0);
 t.get('corrige').listeners.click();t.digit('9');t.digit('9');assert.equal(images().length,0);
 assert.match(t.text(),/VOTO NULO/);assert.equal(t.votes().length,0);
});

test('erro de imagem não impede confirmar e caminhos externos não são carregados',async()=>{
 const t=terminal(undefined,{chapas:[{numero:'10',nome:'Teste',imagem:'/imagens/ausente.jpeg'}]});await tick();
 t.digit('1');t.digit('0');const image=t.get('content').children.find(e=>e.className==='chapa-imagem');
 image.listeners.error();assert.equal(image.hidden,true);
 await t.get('confirma').listeners.click();assert.equal(t.text(),'FIM');assert.equal(t.votes().length,1);
 const other=terminal(undefined,{chapas:[{numero:'10',nome:'Teste',imagem:'https://example.com/foto.jpeg'}]});await tick();
 other.digit('1');other.digit('0');assert.equal(other.get('content').children.some(e=>e.className==='chapa-imagem'),false);
});
