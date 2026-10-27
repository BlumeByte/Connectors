import http from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {allowedRequest,buildInputs} from './publishing.mjs';
import {uploadSignature} from './cloudinary.mjs';
let cloudConfig=null;
const port=4173,files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/connect.js':'connect.js','/style.css':'style.css'};
const stateDir=new URL('./.local/',import.meta.url),receiptFile=new URL('receipts.json',stateDir);
let apiKey=process.env.BUFFER_API_KEY||'',channels=[],busy=false,receipts=[];
try{receipts=JSON.parse(await readFile(receiptFile,'utf8'));if(!Array.isArray(receipts))throw Error('Invalid receipt store');}catch(e){if(e.code!=='ENOENT')throw Error('Cannot read publishing history. Restore .local/receipts.json before publishing.');}
async function saveReceipts(){await mkdir(stateDir,{recursive:true});const tmp=new URL('receipts.tmp',stateDir);await writeFile(tmp,JSON.stringify(receipts,null,2));await rename(tmp,receiptFile);}
async function gql(query,variables={},key=apiKey){
 if(!key)throw Error('Connect Buffer first.');let response;
 try{response=await fetch('https://api.buffer.com',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(30000)});}catch{throw Error('Buffer could not be reached. If publishing was in progress, check Buffer before trying again.');}
 if(!response.ok)throw Error(response.status===401?'Buffer rejected the key. Check it in Buffer Settings → API.':`Buffer returned HTTP ${response.status}. Check Buffer before retrying a post.`);
 const result=await response.json();if(result.errors?.length)throw Error(result.errors.map(e=>e.message).join('; ').slice(0,800));return result.data;
}
async function loadChannels(key=apiKey){const data=await gql('query { account { organizations { id name } } }',{},key);const all=[];for(const org of data.account.organizations){const result=await gql('query($input: ChannelsInput!) { channels(input:$input) { id name service isDisconnected isLocked isQueuePaused } }',{input:{organizationId:org.id}},key);all.push(...result.channels.filter(c=>['instagram','tiktok','facebook','twitter'].includes(c.service)).map(c=>({...c,organization:org.name})));}return all;}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>100000)throw Error('Request too large.');}try{return JSON.parse(text);}catch{throw Error('Invalid request.');}}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 if(!allowedRequest(req.headers,req.method,port))return json(res,403,{error:'Only requests from the local Connectors page are allowed.'});
 const path=new URL(req.url,'http://localhost').pathname;
 try{
 if(path==='/api/status'&&req.method==='GET')return json(res,200,{connected:!!apiKey,channels,receipts,cloudinary:cloudConfig?{configured:true,cloud:cloudConfig.cloud}:{configured:false}});
 if(path==='/api/cloudinary/connect'&&req.method==='POST'){
 const input=await body(req);const config={cloud:String(input.cloud||'').trim(),key:String(input.key||'').trim(),secret:String(input.secret||'').trim()};
 uploadSignature(config,{type:'image/png',size:1});cloudConfig=config;return json(res,200,{configured:true,cloud:config.cloud});}
 if(path==='/api/cloudinary/disconnect'&&req.method==='POST'){cloudConfig=null;return json(res,200,{configured:false});}
 if(path==='/api/cloudinary/sign'&&req.method==='POST'){if(!apiKey)throw Error('Connect Buffer before uploading a post.');return json(res,200,uploadSignature(cloudConfig,await body(req)));}
 if(path==='/api/connect'&&req.method==='POST'){
 if(busy)throw Error('Wait for the current publish request to finish.');const input=await body(req);if(typeof input.key!=='string'||!input.key.trim()||input.key.length>4096)throw Error('Enter your Buffer API key.');
 const next=await loadChannels(input.key.trim());apiKey=input.key.trim();channels=next;return json(res,200,{connected:true,channels});}
 if(path==='/api/disconnect'&&req.method==='POST'){if(busy)throw Error('Wait for publishing to finish.');apiKey='';channels=[];return json(res,200,{connected:false});}
 if(path==='/api/refresh'&&req.method==='POST'){channels=await loadChannels();return json(res,200,{connected:true,channels});}
 if(path==='/api/publish'&&req.method==='POST'){
 if(busy)throw Error('A post is already being submitted. Check Publishing status.');const input=await body(req);if(!apiKey)throw Error('Connect Buffer first.');
 if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId))throw Error('Missing request identifier.');
 const existing=receipts.find(r=>r.requestId===input.requestId);if(existing)return json(res,200,{receipt:existing});busy=true;
 try{channels=await loadChannels();const posts=buildInputs(input,channels),fingerprint=createHash('sha256').update(JSON.stringify(posts)).digest('hex');
 const duplicate=receipts.find(r=>r.fingerprint===fingerprint);if(duplicate)return json(res,200,{receipt:duplicate,duplicate:true});
 const receipt={id:randomUUID(),requestId:input.requestId,fingerprint,created:new Date().toISOString(),results:posts.map(p=>({channelId:p.channelId,name:channels.find(c=>c.id===p.channelId).name,status:'not_submitted'}))};receipts.unshift(receipt);await saveReceipts();
 for(let i=0;i<posts.length;i++){const result=receipt.results[i];result.status='uncertain';result.message='Submission started. Check Buffer before retrying.';await saveReceipts();
 try{const data=await gql('mutation($input: CreatePostInput!) { createPost(input:$input) { ... on PostActionSuccess { post { id text dueAt } } ... on MutationError { message } } }',{input:posts[i]});
 if(data.createPost.post){result.status='accepted';result.postId=data.createPost.post.id;result.dueAt=data.createPost.post.dueAt;result.message='Accepted by Buffer. Verify delivery in Buffer.';}else{result.status='rejected';result.message=data.createPost.message||'Buffer rejected this post.';}}
 catch(e){result.status='uncertain';result.message=e.message;}await saveReceipts();}
 return json(res,200,{receipt});}finally{busy=false;}}
 if(path.startsWith('/api/'))return json(res,404,{error:'Unknown operation.'});if(req.method!=='GET')return json(res,405,{error:'Method not allowed.'});
 const file=files[path];if(!file)return json(res,404,{error:'Not found.'});const data=await readFile(new URL('./dist/'+file,import.meta.url));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);
 }catch(e){json(res,400,{error:e.message});}
}).listen(port,'127.0.0.1',()=>console.log(`Connectors ready at http://127.0.0.1:${port}`));
