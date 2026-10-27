'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const ROOT = __dirname;
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error('Configure ADMIN_PASSWORD (8+ caracteres) antes de iniciar. Consulte README.md.');
  process.exit(1);
}
const numbers = new Set();
for (const c of CONFIG.chapas) {
  if (!/^\d{2}$/.test(c.numero) || numbers.has(c.numero) || !c.nome) throw new Error('Cada chapa precisa de numero exclusivo de 2 digitos e nome.');
  numbers.add(c.numero);
}
const DB = path.join(ROOT, 'dados', 'votos.json');
fs.mkdirSync(path.dirname(DB), {recursive: true});
const fresh = () => ({eleicao: crypto.randomUUID(), votos: Object.fromEntries(CONFIG.chapas.map(c => [c.numero, 0])), branco: 0, nulo: 0, total: 0, urnas: {}, operacoes: [], encerrada: false});
let db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : fresh();
for (const c of CONFIG.chapas) if (!(c.numero in db.votos)) throw new Error('Configuração de chapas alterada depois do início. Para uma nova eleição, arquive e remova dados/votos.json.');
function save(state=db){const tmp = DB + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state, null, 2)); fs.renameSync(tmp, DB);}
const eleicaoAtual = () => db.eleicao || 'inicial';
if (!fs.existsSync(DB)) save();
function json(res, status, data){const payload=JSON.stringify(data);res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(payload);}
function equal(a,b){ const x=crypto.createHash('sha256').update(String(a||'')).digest(); const y=crypto.createHash('sha256').update(String(b||'')).digest();return crypto.timingSafeEqual(x,y); }
function read(req){return new Promise((resolve,reject)=>{let b=''; req.on('data',s=>{b+=s;if(b.length>8192){reject(new Error('Requisição muito grande'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'));}catch{reject(new Error('JSON inválido'));}});req.on('error',reject);});}
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const publicDir = path.join(ROOT, 'public');
async function handler(req,res){
 const url = new URL(req.url,'http://localhost');
 if(req.method==='GET' && url.pathname==='/api/config') return json(res,200,{titulo:CONFIG.titulo,chapas:CONFIG.chapas,encerrada:db.encerrada,eleicao:eleicaoAtual()});
 if(req.method==='GET' && url.pathname==='/api/estado'){
   const id=url.searchParams.get('id'); if(!id||!/^[-a-zA-Z0-9]{12,80}$/.test(id))return json(res,400,{erro:'ID de urna inválido'});
   return json(res,200,{liberada:!db.encerrada,encerrada:db.encerrada,eleicao:eleicaoAtual()});
 }
 if(req.method==='POST' && url.pathname==='/api/votar'){
   const p=await read(req);
   if(p.eleicao!==eleicaoAtual())return json(res,409,{erro:'A eleição mudou. Aguarde a atualização da urna e vote novamente.'});
   if(!/^[-a-zA-Z0-9]{12,80}$/.test(p.id||'') || !/^[a-f0-9-]{36}$/.test(p.operacao||'')) return json(res,400,{erro:'Identificador inválido'});
   if(db.operacoes.includes(p.operacao))return json(res,200,{ok:true,duplicado:true});
   if(db.encerrada)return json(res,403,{erro:'Eleição encerrada'});
   if(p.escolha!=='BRANCO' && p.escolha!=='NULO' && !numbers.has(p.escolha))return json(res,400,{erro:'Voto inválido'});
   if(p.escolha==='BRANCO')db.branco++;else if(p.escolha==='NULO')db.nulo++;else db.votos[p.escolha]++;
   db.total++;db.operacoes.push(p.operacao);if(db.operacoes.length>10000)db.operacoes.shift();save();
   return json(res,200,{ok:true});
 }
 if(url.pathname.startsWith('/api/admin/')){
   const pass=req.headers['x-admin-password'];if(!equal(pass,ADMIN_PASSWORD))return json(res,401,{erro:'Senha administrativa incorreta'});
   if(req.method==='GET'&&url.pathname==='/api/admin/resultado')return json(res,200,{...db,eleicao:eleicaoAtual(),operacoes:undefined,chapas:CONFIG.chapas});
   if(req.method==='POST'&&url.pathname==='/api/admin/encerrar'){const next={...db,encerrada:true,urnas:{}};save(next);db=next;return json(res,200,{ok:true});}
   if(req.method==='POST'&&url.pathname==='/api/admin/nova'){
     const p=await read(req);
     if(!db.encerrada)return json(res,409,{erro:'Encerre a eleição atual antes de iniciar outra.'});
     if(p.eleicao!==eleicaoAtual())return json(res,409,{erro:'A eleição mudou. Atualize a apuração antes de continuar.'});
     try{
       const name='eleicao-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID();
       const dir=path.join(ROOT,'dados','backups',name);
       fs.mkdirSync(dir,{recursive:true});
       fs.writeFileSync(path.join(dir,'votos.json'),JSON.stringify(db,null,2),{flag:'wx'});
       fs.writeFileSync(path.join(dir,'config-salva.json'),JSON.stringify(CONFIG,null,2),{flag:'wx'});
       const next=fresh();save(next);db=next;
       return json(res,200,{ok:true,eleicao:eleicaoAtual(),backup:path.relative(ROOT,dir).split(path.sep).join('/')});
     }catch(e){console.error(e);return json(res,500,{erro:'Não foi possível iniciar outra eleição. A votação anterior foi preservada. Verifique o espaço e as permissões da pasta dados.'});}
   }
   return json(res,404,{erro:'Rota não encontrada'});
 }
 if(req.method!=='GET')return json(res,405,{erro:'Método não permitido'});
 const name=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'');
 const filename=path.resolve(publicDir,name);
 if(!filename.startsWith(publicDir+path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile())return json(res,404,{erro:'Arquivo não encontrado'});
 res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(filename).pipe(res);
}
const server=http.createServer((req,res)=>{handler(req,res).catch(e=>{console.error(e);if(!res.headersSent)json(res,500,{erro:'Erro interno'});});});
server.on('error',e=>{
 if(e.code==='EADDRINUSE')console.error(`A porta ${PORT} já está em uso. Feche a janela do servidor anterior com Ctrl + C antes de abrir outro. Se quiser apenas acessar a urna, use http://localhost:${PORT}.`);
 else console.error('Não foi possível iniciar o servidor:',e.message);
 process.exitCode=1;
});
server.listen(PORT,'0.0.0.0',()=>{
 console.log(`\nURNA ESCOLAR ATIVA: http://localhost:${PORT}`);
 for(const network of Object.values(os.networkInterfaces()))for(const i of network||[])if(i.family==='IPv4'&&!i.internal)console.log(`Acesso na rede: http://${i.address}:${PORT}`);
 console.log('Painel de apuração: /admin.html\nMantenha o computador servidor ligado durante toda a eleição.\n');
 if(db.encerrada)console.log('A eleição salva está ENCERRADA. Para iniciar outra, abra o painel de apuração, atualize a contagem e clique em Iniciar nova eleição.');
});
