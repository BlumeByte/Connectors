import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {uploadSignature} from './cloudinary.mjs';
test('signs uploads without returning the secret',()=>{const result=uploadSignature({cloud:'my-cloud',key:'123',secret:'private'}, {type:'image/png',size:42},1700000000);assert.equal(result.endpoint,'https://api.cloudinary.com/v1_1/my-cloud/image/upload');assert.equal(result.signature,createHash('sha1').update('timestamp=1700000000private').digest('hex'));assert.equal(JSON.stringify(result).includes('private'),false);});
test('rejects unsupported or oversized files and unsafe cloud names',()=>{for(const file of [{type:'text/html',size:40},{type:'video/mp4',size:51*1024*1024},{type:'image/png',size:0}])assert.throws(()=>uploadSignature({cloud:'demo',key:'123',secret:'s'},file));assert.throws(()=>uploadSignature({cloud:'../other',key:'123',secret:'s'},{type:'image/png',size:20}));});
test('video uses video endpoint',()=>{assert.match(uploadSignature({cloud:'demo',key:'123',secret:'s'},{type:'video/mp4',size:20}).endpoint,/\/video\/upload$/);});
