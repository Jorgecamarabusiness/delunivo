import {createServer} from 'node:http';
// Only the native REST compatibility endpoint. Auth/Storage services are not simulated.
createServer(async(req,res)=>{
  if(!req.url.startsWith('/rest/v1/')){res.writeHead(404);res.end();return;}
  try {
    const response=await fetch(`http://127.0.0.1:54397/${req.url.slice('/rest/v1/'.length)}`,{method:req.method,headers:Object.fromEntries(Object.entries(req.headers).filter(([k])=>!['host','connection','content-length','accept-encoding'].includes(k))),...(req.method==='GET'||req.method==='HEAD'?{}:{body:req,duplex:'half'})});
    res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([k])=>!['content-encoding','content-length','transfer-encoding'].includes(k))));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(503);res.end('isolated_rest_unavailable');}
}).listen(54398,'127.0.0.1');
