const $=id=>document.getElementById(id);let ultimo=null, iniciando=false;
function botoes(){ $('nova').disabled=iniciando||!ultimo?.encerrada; }
async function req(path,method='GET',body){const headers={'X-Admin-Password':$('password').value};if(body!==undefined)headers['Content-Type']='application/json';const r=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro);return d;}
async function atualizar(){try{const d=await req('/api/admin/resultado');ultimo=d;botoes();const div=$('dados');div.replaceChildren();const p=document.createElement('p');p.textContent=`Situação: ${d.encerrada?'ENCERRADA':'ABERTA'} | Total de votos: ${d.total}`;div.appendChild(p);const table=document.createElement('table');const hdr=document.createElement('tr');for(const t of ['Chapa / Tipo','Votos']){let th=document.createElement('th');th.textContent=t;hdr.appendChild(th);}table.appendChild(hdr);for(const [name,value] of [...d.chapas.map(c=>[`${c.numero} — ${c.nome}`,d.votos[c.numero]]),['Brancos',d.branco],['Nulos',d.nulo],['TOTAL',d.total]]){const tr=document.createElement('tr');for(const x of [name,value]){let td=document.createElement('td');td.textContent=x;tr.appendChild(td)}table.appendChild(tr)}div.appendChild(table);$('msg').textContent='Contagem atualizada.';}catch(e){$('msg').textContent=e.message;}}
$('atualizar').onclick=atualizar;
$('encerrar').onclick=async()=>{if(!confirm('Encerrar a eleição definitivamente? Não será mais possível registrar votos.'))return;try{await req('/api/admin/encerrar','POST');await atualizar();}catch(e){$('msg').textContent=e.message;}};
$('nova').onclick=async()=>{
 if(iniciando||!ultimo?.encerrada)return;
 if(!confirm('Iniciar uma nova eleição com zero votos? O resultado anterior será arquivado automaticamente. As chapas atuais serão mantidas.'))return;
 iniciando=true;botoes();
 try{
  const resultado=await req('/api/admin/nova','POST',{eleicao:ultimo.eleicao});
  ultimo=null;await atualizar();
  $('msg').textContent=`Nova eleição iniciada com zero votos. Resultado anterior salvo em ${resultado.backup}. As urnas serão atualizadas automaticamente.`;
 }catch(e){$('msg').textContent=e.message;}
 finally{iniciando=false;botoes();}
};
$('csv').onclick=()=>{if(!ultimo){$('msg').textContent='Atualize a apuração primeiro.';return;}const rows=[['Chapa','Votos'],...ultimo.chapas.map(c=>[`${c.numero} - ${c.nome}`,ultimo.votos[c.numero]]),['Brancos',ultimo.branco],['Nulos',ultimo.nulo],['Total',ultimo.total]];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='resultado-gremio.csv';a.click();URL.revokeObjectURL(a.href);};
