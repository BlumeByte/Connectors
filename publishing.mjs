export function allowedRequest(h,method,port=4173){
 const hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
 return hosts.includes(h.host)&&(!h.origin||hosts.map(x=>'http://'+x).includes(h.origin))&&(['GET','HEAD'].includes(method)||!!h.origin&&h['content-type']?.startsWith('application/json'));
}
export function buildInputs(body,channels){
 if(!Array.isArray(body.channelIds)||!body.channelIds.length||body.channelIds.length>4)throw Error('Select between one and four connected accounts.');
 if(new Set(body.channelIds).size!==body.channelIds.length)throw Error('Duplicate channel selection.');
 let assets=[];
 if(body.media){let url;try{url=new URL(body.media.url);}catch{throw Error('Media must have a public HTTPS URL.');}
 if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)||url.hostname.startsWith('[')||url.hostname.endsWith('.local'))throw Error('Media must have a public HTTPS URL.');
 if(!['image','video'].includes(body.media.type))throw Error('Choose image or video media.');assets=[{[body.media.type]:{url:url.href}}];}
 let dueAt;if(body.date){const date=new Date(body.date);if(!Number.isFinite(date.getTime())||date<=new Date())throw Error('Choose a future posting time.');dueAt=date.toISOString();}
 return body.channelIds.map(id=>{const c=channels.find(c=>c.id===id);
 if(!c||!['instagram','tiktok','facebook','twitter'].includes(c.service))throw Error('Select a connected account.');
 if(c.isDisconnected||c.isLocked||c.isQueuePaused)throw Error(`${c.name} is unavailable; check its connection or queue in Buffer.`);
 if(['instagram','tiktok'].includes(c.service)&&!assets.length)throw Error(`${c.name} requires photo or video media.`);
 const override=body.overrides?.[c.service==='twitter'?'x':c.service],text=typeof override==='string'&&override.trim()?override:body.text||'';
 if(typeof text!=='string'||text.length>10000||(!text.trim()&&!assets.length))throw Error('Add post content (up to 10,000 characters) or media.');
 const input={channelId:id,text,assets,mode:dueAt?'customScheduled':'shareNow',schedulingType:'automatic',needsApproval:false};
 if(dueAt)input.dueAt=dueAt;
 if(c.service==='instagram')input.metadata={instagram:{type:body.media.type==='video'?'reel':'post',shouldShareToFeed:true}};
 if(c.service==='facebook')input.metadata={facebook:{type:'post'}};return input;});
}
