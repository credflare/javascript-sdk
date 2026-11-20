import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {CredflareServer} from '../dist/server.js';
const {CREDFLARE_API_URL, CREDFLARE_CLIENT_ID, CREDFLARE_CLIENT_SECRET, CREDFLARE_PROFILE_ID} = process.env;
if (!CREDFLARE_API_URL || !CREDFLARE_CLIENT_ID || !CREDFLARE_CLIENT_SECRET || !CREDFLARE_PROFILE_ID) throw new Error('Configure API URL, client ID, client secret and profile ID in the server environment.');
const client = new CredflareServer(CREDFLARE_API_URL, {clientId:CREDFLARE_CLIENT_ID, clientSecret:CREDFLARE_CLIENT_SECRET});
createServer(async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  try {
    if (req.method === 'GET' && req.url === '/') {
      res.setHeader('Content-Type','text/html');
      return res.end(await readFile(new URL('./index.html',import.meta.url)));
    }
    if (req.method === 'GET' && ['/dist/index.js','/dist/browser.js'].includes(req.url)) {
      res.setHeader('Content-Type','text/javascript');
      return res.end(await readFile(new URL(`..${req.url}`,import.meta.url)));
    }
    if (req.method !== 'POST' || req.url !== '/session') {res.writeHead(404);return res.end();}
    if (req.headers.origin && req.headers.origin !== 'http://localhost:3000') {res.writeHead(403);return res.end();}
    let input = '';
    for await (const chunk of req) {
      input += chunk;
      if (input.length > 4096) {res.writeHead(413);return res.end();}
    }
    const {email} = JSON.parse(input);
    if (typeof email !== 'string' || email.length > 255) {res.writeHead(422);return res.end();}
    const verification = await client.createVerification({email, profileId:Number(CREDFLARE_PROFILE_ID)});
    const session = await client.createSession(verification.id, ['http://localhost:3000']);
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(session));
  } catch {
    res.writeHead(502,{'Content-Type':'application/json'});
    res.end(JSON.stringify({message:'Unable to create a session. Check the backend configuration.'}));
  }
}).listen(3000,'localhost', () => console.log('Example: http://localhost:3000'));
