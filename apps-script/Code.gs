/**
 * Google Sheets / Apps Script - cadastro B8
 * Cole no projeto Apps Script VINCULADO à planilha Google.
 * Execute setupCadastro() uma vez, após configurar B8_SHARED_SECRET em Propriedades do script.
 * Implantar > Nova implantação > App da Web > Executar como: Eu > Acesso: Qualquer pessoa.
 * A URL /exec e o segredo devem ficar SOMENTE nas variáveis do Netlify, nunca no HTML.
 */
const SUPPLIERS_SHEET='Fornecedores';
const AUDIT_SHEET='Auditoria';
const SUP_HEADERS=['codigo','nome','cnpj','atualizado_em','atualizado_por','origem'];
const AUDIT_HEADERS=['em','usuario','acao','codigo','nome_anterior','cnpj_anterior','nome_novo','cnpj_novo','origem'];
function setupCadastro(){const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Vincule o script a uma planilha.');let s=ss.getSheetByName(SUPPLIERS_SHEET)||ss.insertSheet(SUPPLIERS_SHEET);if(s.getLastRow()===0)s.appendRow(SUP_HEADERS);let a=ss.getSheetByName(AUDIT_SHEET)||ss.insertSheet(AUDIT_SHEET);if(a.getLastRow()===0)a.appendRow(AUDIT_HEADERS);s.getRange('A:C').setNumberFormat('@');s.setFrozenRows(1);a.setFrozenRows(1);}
function doPost(e){try{const req=JSON.parse(e.postData?.contents||'{}');const token=PropertiesService.getScriptProperties().getProperty('B8_SHARED_SECRET');if(!token||req.secret!==token)return json_({ok:false,error:'Integração não autorizada.'});if(!['list','upsert','bulk'].includes(req.action))return json_({ok:false,error:'Ação inválida.'});const email=String(req.actor||'').trim().toLowerCase();if(!/^.+@.+\..+$/.test(email))return json_({ok:false,error:'Usuário não informado.'});
  if(!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUPPLIERS_SHEET))setupCadastro();const lock=LockService.getScriptLock();if(!lock.tryLock(25000))return json_({ok:false,error:'Cadastro ocupado; tente novamente.'});try{return json_(req.action==='list'?list_():upsert_(req.records,email))}finally{lock.releaseLock()}
}catch(err){return json_({ok:false,error:'Erro no cadastro: '+String(err.message||err)})}}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
function sheet_(){return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUPPLIERS_SHEET)}
function string_(x){return String(x??'').trim()}
function digits_(x){return string_(x).replace(/\D/g,'')}
function validCnpj_(raw){const d=digits_(raw);if(d.length!==14||/^(\d)\1{13}$/.test(d))return false;for(const len of [12,13]){let sum=0,p=len===12?5:6;for(let i=0;i<len;i++){sum+=Number(d[i])*p;p=p===2?9:p-1}if((sum*10)%11%10!==Number(d[len]))return false}return true}
function safeText_(v){let s=string_(v).slice(0,160);return /^[=+@-]/.test(s)?"'"+s:s}
function list_(){const s=sheet_(),n=s.getLastRow();if(n<=1)return {ok:true,records:[]};const v=s.getRange(2,1,n-1,6).getDisplayValues();return{ok:true,records:v.filter(x=>x[0]).map(x=>({codigo:String(x[0]).trim(),nome:String(x[1]).replace(/^'/,''),cnpj:digits_(x[2]),atualizado_em:x[3],atualizado_por:x[4],origem:x[5]}))}}
function upsert_(records,actor){if(!Array.isArray(records)||!records.length||records.length>100)return{ok:false,error:'Lote inválido (1–100).'};const s=sheet_(),audit=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_SHEET);const n=s.getLastRow(),current=n>1?s.getRange(2,1,n-1,6).getDisplayValues():[],index={};current.forEach((row,i)=>{const k=String(row[0]).trim();if(k&&!Object.prototype.hasOwnProperty.call(index,k))index[k]=i+2});let created=0,updated=0,skipped=0,conflicts=[];const seen=new Set();const logs=[],newRows=[];for(const rec of records){const codigo=string_(rec.codigo),nome=string_(rec.nome),cnpj=digits_(rec.cnpj),origem=safeText_(rec.origem||'Importação');if(!/^\d{1,12}$/.test(codigo)||!nome||nome.length>160||!validCnpj_(cnpj)){skipped++;continue}if(seen.has(codigo)){skipped++;continue}seen.add(codigo);const when=new Date().toISOString(),row=[codigo,safeText_(nome),cnpj,when,actor,origem];let line=index[codigo],old=line?current[line-2]:null;if(old&&digits_(old[2])&&digits_(old[2])!==cnpj){conflicts.push({codigo,cnpj_existente:digits_(old[2]),cnpj_recebido:cnpj});continue}if(old){if(string_(old[1]).replace(/^'/,'')===nome&&digits_(old[2])===cnpj){skipped++;continue}s.getRange(line,1,1,6).setValues([row]);updated++;logs.push([when,actor,'atualizado',codigo,old[1],old[2],nome,cnpj,origem])}else{newRows.push(row);index[codigo]=n+newRows.length;created++;logs.push([when,actor,'criado',codigo,'','',nome,cnpj,origem])}}
 if(newRows.length)s.getRange(n+1,1,newRows.length,6).setValues(newRows);if(logs.length)audit.getRange(audit.getLastRow()+1,1,logs.length,9).setValues(logs);return {ok:true,created,updated,skipped,conflicts,summary:`${created} criados; ${updated} atualizados; ${skipped} ignorados; ${conflicts.length} conflitos.`}}
