import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {CredflareServer} from '../dist/server.js';

export function createDemoServer(environment = process.env, fetcher = globalThis.fetch, port = 3107) {
  const {CREDFLARE_API_URL, CREDFLARE_CLIENT_ID, CREDFLARE_CLIENT_SECRET, CREDFLARE_PROFILE_ID, CREDFLARE_PROFILE_IDS, CREDFLARE_FACE_MODEL} = environment;
  if (!CREDFLARE_API_URL || !CREDFLARE_CLIENT_ID || !CREDFLARE_CLIENT_SECRET || !CREDFLARE_PROFILE_ID) throw new Error('Configure the API URL, client credentials and demo profile ID on the server.');
  const profiles = CREDFLARE_PROFILE_IDS ? JSON.parse(CREDFLARE_PROFILE_IDS) : {snapshot_or_upload:Number(CREDFLARE_PROFILE_ID)};
  const client = new CredflareServer(CREDFLARE_API_URL, {clientId:CREDFLARE_CLIENT_ID, clientSecret:CREDFLARE_CLIENT_SECRET}, fetcher);
  const origins = [`http://localhost:${port}`,`http://127.0.0.1:${port}`];
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control','no-store');
    try {
      if (req.method === 'GET' && req.url === '/') {
        res.setHeader('Content-Type','text/html');
        return res.end(await readFile(new URL('./index.html',import.meta.url)));
      }
      if (req.method === 'GET' && req.url === '/credflare-mark.png') {res.setHeader('Content-Type','image/png');return res.end(await readFile(new URL('./credflare-mark.png',import.meta.url)));}
      if (req.method === 'GET' && /^\/dist\/[a-z.]+\.js$/.test(req.url)) {
        res.setHeader('Content-Type','text/javascript');
        return res.end(await readFile(new URL(`..${req.url}`,import.meta.url)));
      }
      if (req.method === 'GET' && req.url === '/config.json') {
        res.setHeader('Content-Type','application/json');
        return res.end(JSON.stringify({faceModel: CREDFLARE_FACE_MODEL ? '/vendor/face_landmarker.task' : undefined}));
      }
      if (req.method === 'GET' && req.url === '/vendor/face_landmarker.task' && CREDFLARE_FACE_MODEL) {
        res.setHeader('Content-Type','application/octet-stream');
        return res.end(await readFile(CREDFLARE_FACE_MODEL));
      }
      const vendor = req.method === 'GET' && req.url.match(/^\/vendor\/mediapipe\/((?:wasm\/)?[a-z_]+\.(?:mjs|js|wasm))$/);
      if (vendor) {
        res.setHeader('Content-Type', vendor[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        return res.end(await readFile(new URL(`../node_modules/@mediapipe/tasks-vision/${vendor[1]}`,import.meta.url)));
      }
      if (req.method !== 'POST' || req.url !== '/session') {res.writeHead(404);return res.end();}
      if (req.headers.origin && !origins.includes(req.headers.origin)) {res.writeHead(403);return res.end();}
      let input = '';
      for await (const chunk of req) {
        input += chunk;
        if (input.length > 4096) {res.writeHead(413);return res.end();}
      }
      const {email} = JSON.parse(input);
      const mode = environment.CREDFLARE_DEMO_FLOW ?? 'snapshot_or_upload';
      if (typeof email !== 'string' || email.length > 255 || !Object.hasOwn(profiles,mode)) {
        res.writeHead(422,{'Content-Type':'application/json'});
        return res.end(JSON.stringify({message:'Enter an email and configure the demo flow on the server.'}));
      }
      const verification = await client.createVerification({email,profileId:Number(profiles[mode])});
      const session = await client.createSession(verification.id,origins);
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(session));
    } catch {
      res.writeHead(502,{'Content-Type':'application/json'});
      res.end(JSON.stringify({message:'Unable to start the demo. Check the local backend configuration.'}));
    }
  });
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1],'file:').href) {
  const port = Number(process.env.PORT ?? 3107);
  createDemoServer(process.env, globalThis.fetch, port).listen(port,'127.0.0.1',()=>console.log(`Example: http://localhost:${port}`));
}
