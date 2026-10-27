import {readFileSync} from 'node:fs';
import {createServer,request as httpRequest} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const config=JSON.parse(readFileSync(process.env.YIFUN_RUNTIME_CONFIG,'utf8'));
process.env.VINEXT_TRUSTED_HOSTS=config.publicHost;
const {startProdServer}=await import('vinext/server/prod-server');
const port=Number(process.env.PORT||3100),innerPort=port+1;
await startProdServer({port:innerPort,host:'127.0.0.1',outDir:join(dir,'dist')});
createServer((req,res)=>{
 if(req.url==='/__health'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,service:'yifun-aftersales',runtime:'aliyun-node'}));return}
 const secret=String(req.headers['x-yifun-origin-key']||'');if(secret.length!==config.originSecret.length||!timingSafeEqual(Buffer.from(secret),Buffer.from(config.originSecret))){res.writeHead(404);res.end();return}
 const headers={...req.headers,host:config.publicHost,'x-forwarded-host':config.publicHost,'x-forwarded-proto':'https'};delete headers['x-yifun-origin-key'];for(const key of Object.keys(headers))if(key.startsWith('oai-authenticated-user-'))delete headers[key];
 const proxy=httpRequest({hostname:'127.0.0.1',port:innerPort,path:req.url,method:req.method,headers},upstream=>{res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res)});
 proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Service unavailable')});req.on('aborted',()=>proxy.destroy());req.pipe(proxy);
}).listen(port,'127.0.0.1');
