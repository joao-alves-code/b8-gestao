// Netlify Function — MVP público: cadastro de fornecedores sem login Google.
// Apenas código, nome e CNPJ são encaminhados ao Apps Script.
// A credencial B8_APPS_SCRIPT_SECRET permanece APENAS no servidor Netlify.
// ATENÇÃO: esta função é acessível publicamente. Publique em ambiente controlado.
const reply=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
const urlOK=url=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url||'');
export async function handler(event){
  const {B8_APPS_SCRIPT_URL:url,B8_APPS_SCRIPT_SECRET:secret}=process.env;
  if(event.httpMethod==='GET'){
    if(event.queryStringParameters?.action!=='config')return reply(404,{ok:false,error:'Rota não encontrada.'});
    return reply(200,{ok:true,configured:urlOK(url)&&!!secret,mode:'public-mvp'});
  }
  if(event.httpMethod!=='POST')return reply(405,{ok:false,error:'Método não permitido.'});
  if(!urlOK(url)||!secret)return reply(503,{ok:false,error:'Configure B8_APPS_SCRIPT_URL e B8_APPS_SCRIPT_SECRET no Netlify.'});
  if((event.body||'').length>290000)return reply(413,{ok:false,error:'Lote excede o limite de 290 KB.'});
  let req;try{req=JSON.parse(event.body||'{}')}catch{return reply(400,{ok:false,error:'JSON inválido.'})}
  if(!['list','upsert','bulk'].includes(req.action))return reply(400,{ok:false,error:'Operação desconhecida.'});
  if(req.action!=='list'&&(!Array.isArray(req.records)||req.records.length<1||req.records.length>100))return reply(400,{ok:false,error:'Envie entre 1 e 100 cadastros.'});
  try{
    const upstream=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:req.action,records:req.records||[],actor:'MVP - acesso público',secret}),redirect:'follow',signal:AbortSignal.timeout(27000)});
    const raw=await upstream.text();
    let result;try{result=JSON.parse(raw)}catch{return reply(502,{ok:false,error:'Apps Script não respondeu JSON. Confira a URL /exec e a implantação.'})}
    if(!upstream.ok||!result.ok)return reply(502,{ok:false,error:result.error||'Falha no Google Apps Script.'});
    return reply(200,result);
  }catch(error){return reply(502,{ok:false,error:'Falha ao comunicar com Google: '+(error.name==='TimeoutError'?'tempo limite excedido':error.message)})}
}
