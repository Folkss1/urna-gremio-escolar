const $ = id => document.getElementById(id);
function criarId(){
 // getRandomValues também funciona no HTTP da rede local.
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const id = localStorage.getItem('urna_id') || criarId();localStorage.setItem('urna_id',id);
let chapas=[], digitado='', branco=false, liberada=false, encerrada=false, enviando=false, operacao=null, finalizado=false, eleicao=null;
let audio=null;
function ativarSom(){
 try{
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Audio)return;
  audio ||= new Audio();
  if(audio.state==='suspended')audio.resume().catch(()=>{});
 }catch{/* O áudio não deve impedir a votação. */}
}
function tocarSom(tipo){
 ativarSom();if(!audio)return;
 try{
  const notas=tipo==='fim'?[[0,1800,0.10],[0.15,1800,0.10],[0.30,1800,0.10],[0.48,2200,0.55]]:[[0,1200,0.06]];
  for(const [atraso,frequencia,duracao] of notas){
   const inicio=audio.currentTime+atraso;
   const oscilador=audio.createOscillator(), volume=audio.createGain();
   oscilador.type='square';oscilador.frequency.setValueAtTime(frequencia,inicio);
   volume.gain.setValueAtTime(0,inicio);
   volume.gain.linearRampToValueAtTime(0.06,inicio+0.005);
   volume.gain.setValueAtTime(0.06,inicio+duracao-0.015);
   volume.gain.linearRampToValueAtTime(0,inicio+duracao);
   oscilador.connect(volume);volume.connect(audio.destination);
   oscilador.onended=()=>{oscilador.disconnect();volume.disconnect();};
   oscilador.start(inicio);oscilador.stop(inicio+duracao);
  }
 }catch{/* A confirmação visual continua disponível sem áudio. */}
}
const call=async(url,opts={})=>{const r=await fetch(url,{cache:'no-store',...opts});const b=await r.json();if(!r.ok)throw new Error(b.erro||'Falha de comunicação');return b;};
const post=(url,data)=>call(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const chapaAtual=()=>chapas.find(c=>c.numero===digitado);
function render(){
 const c=$('content');c.replaceChildren();
 function add(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;c.appendChild(e);return e;}
 function imagem(chapa){
  if(typeof chapa.imagem!=='string'||!/^\/imagens\/[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(chapa.imagem))return;
  const img=add('img','','chapa-imagem');
  img.alt=`Cartaz da chapa ${chapa.numero} — ${chapa.nome}`;
  img.addEventListener('error',()=>{img.hidden=true;});
  img.src=chapa.imagem;
 }
 if(encerrada){add('div','ELEIÇÃO ENCERRADA','big');$('status').textContent='Votação encerrada.';return;}
 if(finalizado){add('div','FIM','big');$('status').textContent='Voto registrado com sucesso. Aguarde a próxima votação.';return;}
 if(!liberada){add('div','AGUARDE','chapainfo');$('status').textContent='Conectando ao servidor...';return;}
 $('status').textContent=enviando?'Registrando voto...':'Urna pronta para votar.';
 if(branco){add('div','VOTO EM BRANCO','big');add('p','Pressione CONFIRMA para registrar ou CORRIGE para voltar.','description');return;}
 add('div','Número da chapa','prompt');let d=add('div','','digits');for(let i=0;i<2;i++){const e=document.createElement('div');e.className='digit';e.textContent=digitado[i]||'';d.appendChild(e);}
 if(digitado.length===2){if(chapaAtual()){add('div',chapaAtual().nome,'chapainfo');imagem(chapaAtual());add('p','Pressione CONFIRMA para registrar seu voto.','description');}else{add('div','VOTO NULO','chapainfo');add('p','Número não cadastrado. Ao confirmar, o voto será contabilizado como nulo.','description');}}else{add('p','Digite dois números para selecionar uma chapa.','description');}
}
function digitar(n){if(!liberada||encerrada||enviando||finalizado||branco||digitado.length>=2)return;tocarSom('tecla');digitado+=n;render();}
function corrigir(){if(!liberada||encerrada||enviando||finalizado)return;tocarSom('tecla');digitado='';branco=false;render();}
async function confirmar(){if(!liberada||enviando||encerrada||finalizado||(!branco&&digitado.length!==2))return;
 ativarSom();
 const escolha=branco?'BRANCO':chapaAtual()?digitado:'NULO', votacao=eleicao;enviando=true;operacao ||= criarId();render();
 try{await post('/api/votar',{id,operacao,escolha,eleicao:votacao});if(votacao!==eleicao)return;digitado='';branco=false;operacao=null;enviando=false;finalizado=true;tocarSom('fim');render();setTimeout(()=>{if(votacao===eleicao){finalizado=false;render();}},3000);}
 catch(e){if(votacao!==eleicao)return;enviando=false;$('status').textContent=`Não foi possível confirmar: ${e.message}. Pressione CONFIRMA para tentar novamente.`;}
}
$('keys').addEventListener('click',e=>{const b=e.target.closest('[data-digit]');if(b)digitar(b.dataset.digit)});
$('corrige').addEventListener('click',corrigir);$('branco').addEventListener('click',()=>{if(liberada&&!encerrada&&!enviando&&!finalizado){tocarSom('tecla');branco=true;digitado='';render();}});$('confirma').addEventListener('click',confirmar);
document.addEventListener('keydown',e=>{if(document.activeElement?.tagName==='INPUT'||e.ctrlKey||e.altKey||e.metaKey)return;if(/^\d$/.test(e.key)){e.preventDefault();digitar(e.key);}if(e.key==='Enter'){e.preventDefault();confirmar();}if(e.key==='Backspace'){e.preventDefault();corrigir();}});
async function estado(){try{const e=await call('/api/estado?id='+encodeURIComponent(id));if(e.eleicao!==eleicao){digitado='';branco=false;operacao=null;finalizado=false;enviando=false;eleicao=e.eleicao;}encerrada=e.encerrada;liberada=e.liberada&&!encerrada;render();}catch{$('status').textContent='Sem comunicação com o servidor. Verifique a conexão.';}}
(async()=>{try{const conf=await call('/api/config');$('titulo').textContent=conf.titulo;chapas=conf.chapas;eleicao=conf.eleicao;await estado();setInterval(estado,3000);}catch(e){$('status').textContent=e.message;}})();
