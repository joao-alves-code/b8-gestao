// Netlify Function — apenas código/nome/CNPJ chegam ao Apps Script.
// Auth: ID token Google verificado no servidor + allowlist exata de e-mails.
const reply=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
const urlOK=url=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url||'');
export async function handler(event){
  if(event.httpMethod==='GET'){
    if(event.queryStringParameters?.action!=='config')return reply(404,{ok:false,error:'Rota não encontrada.'});
    const id=process.env.GOOGLE_OAUTH_CLIENT_ID||'';
    return reply(200,{ok:true,configured:!!(id&&process.env.B8_APPS_SCRIPT_URL&&process.env.B8_APPS_SCRIPT_SECRET&&process.env.ALLOWED_GOOGLE_EMAILS),clientId:id});
  }
  if(event.httpMethod!=='POST')return reply(405,{ok:false,error:'Método não permitido.'});
  const {B8_APPS_SCRIPT_URL:url,B8_APPS_SCRIPT_SECRET:secret,GOOGLE_OAUTH_CLIENT_ID:clientId,ALLOWED_GOOGLE_EMAILS:allowed}=process.env;
  if(!urlOK(url)||!secret||!clientId||!allowed)return reply(503,{ok:false,error:'Integração ainda não configurada pelo administrador.'});
  const auth=event.headers.authorization||event.headers.Authorization||'';
  if(!auth.startsWith('Bearer '))return reply(401,{ok:false,error:'Login Google necessário.'});
  if((event.body||'').length>290000)return reply(413,{ok:false,error:'Lote excede o limite de 290 KB.'});
  let req;try{req=JSON.parse(event.body||'{}')}catch{return reply(400,{ok:false,error:'JSON inválido.'})}
  if(!['list','upsert','bulk'].includes(req.action))return reply(400,{ok:false,error:'Operação desconhecida.'});
  if(req.action!=='list'&&(!Array.isArray(req.records)||req.records.length<1||req.records.length>100))return reply(400,{ok:false,error:'Envie entre 1 e 100 cadastros.'});
  try{
    const token=auth.slice(7);
    const check=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token),{signal:AbortSignal.timeout(11000)});
    if(!check.ok)return reply(401,{ok:false,error:'Sessão Google expirada ou inválida. Entre novamente.'});
    const person=await check.json();
    if(person.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(person.iss)||String(person.email_verified)!=='true'||Number(person.exp)*1000<=Date.now())return reply(401,{ok:false,error:'Identidade Google não validada.'});
    const whitelist=allowed.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(!whitelist.includes(String(person.email||'').toLowerCase()))return reply(403,{ok:false,error:'Sua conta Google não possui acesso à planilha corporativa.'});
    const data={action:req.action,records:req.records||[],actor:person.email,secret};
    const upstream=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data),redirect:'follow',signal:AbortSignal.timeout(27000)});
    const raw=await upstream.text();
    let result;try{result=JSON.parse(raw)}catch{return reply(502,{ok:false,error:'Apps Script não respondeu JSON. Confira a URL /exec, implantação e permissões.'})}
    if(!upstream.ok||!result.ok)return reply(502,{ok:false,error:result.error||'Falha no Google Apps Script.'});
    // Não devolver segredos nem conteúdo além dos dados autorizados.
    return reply(200,{...result,user:person.email});
  }catch(error){return reply(502,{ok:false,error:'Falha ao comunicar com Google: '+(error.name==='TimeoutError'?'tempo limite excedido':error.message)})}
}
