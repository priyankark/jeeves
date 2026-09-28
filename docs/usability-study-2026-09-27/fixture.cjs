const http=require('node:http');
let attempts=0;
http.createServer((req,res)=>{
 if(req.url==='/login'){res.setHeader('Content-Type','text/html');return res.end('<h1>Study sign-in fixture</h1><p>Synthetic handoff only. Do not enter real credentials.</p><label>Email <input type="email"></label><label>Password <input type="password"></label><button>Sign in</button>');}
 if(req.url==='/retry' && ++attempts===1){res.writeHead(503);return res.end('Study service temporarily unavailable');}
 if(req.url==='/slow')return setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({summary:'Slow step completed'}));},12000);
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({summary:'Fixture recovered',attempts}));
}).listen(4336,'127.0.0.1',()=>console.log('Study fixture listening 4336'));
