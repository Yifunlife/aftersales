export async function proxyAliOrigin(request,env){
 const target=new URL(env.ALI_ORIGIN_URL);const url=new URL(request.url);target.pathname=target.pathname.replace(/\/$/,'')+url.pathname;target.search=url.search;
 const headers=new Headers(request.headers);headers.set('X-Yifun-Origin-Key',env.ALI_ORIGIN_SECRET);headers.set('X-Forwarded-Host',url.host);headers.set('X-Forwarded-Proto','https');headers.delete('Host');
 try{return await fetch(new Request(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'}))}
 catch{return new Response('售后服务暂时无法连接，请稍后重试。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}})}
}
