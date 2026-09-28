import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'exports');
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2','.pdf':'application/pdf','.json':'application/json','.md':'text/plain'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const report={createdAt:new Date().toISOString(),artwork:[],pdf:[],checks:[]};
async function ready(){await page.evaluate(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});}
async function open(file){await page.goto(`${base}/${file}`);await ready();}
function check(ok,message){if(!ok)throw new Error(message);report.checks.push(message);}
try{
  const manifest=JSON.parse(await readFile(path.join(root,'assets/creative-manifest.json'),'utf8'));
  for(const asset of manifest){
    await page.setViewportSize({width:asset.width,height:asset.height});
    await open(`social.html?asset=${asset.id}`);
    const dimensions=await page.locator('.social.selected').boundingBox();
    check(dimensions.width===asset.width&&dimensions.height===asset.height,`${asset.id}: exact authored dimensions`);
    await page.locator('.social.selected').screenshot({path:path.join(out,asset.id+'.png')});
    report.artwork.push({file:asset.id+'.png',width:asset.width,height:asset.height});
  }
  await page.setViewportSize({width:1280,height:800});
  await open('deck.html');
  check(await page.locator('.slide').count()===8,'Deck contains eight slides');
  await page.keyboard.press('ArrowRight');
  check(await page.locator('#counter').innerText()==='2 / 8','Deck keyboard navigation works');
  await page.getByRole('button',{name:'Previous slide'}).click();
  check(await page.locator('#counter').innerText()==='1 / 8','Deck button navigation works');
  for(let i=0;i<8;i++){
    await page.evaluate(n=>show(n),i);
    const overflow=await page.locator('.slide.active').evaluate(el=>el.scrollHeight>el.clientHeight||el.scrollWidth>el.clientWidth);
    check(!overflow,`Slide ${i+1}: no container overflow`);
    await page.locator('.slide.active').screenshot({path:path.join(out,`slide-${i+1}.png`)});
  }
  await page.locator('.brand').evaluateAll(links=>links.forEach(a=>a.removeAttribute('href')));
  await page.pdf({path:path.join(out,'jeeves-product-deck.pdf'),preferCSSPageSize:true,printBackground:true,tagged:true});
  report.pdf.push({file:'jeeves-product-deck.pdf',expectedPages:8,format:'16:9'});
  await page.setViewportSize({width:1100,height:1300});
  await open('one-pager.html');
  const footerOverlap=await page.evaluate(()=>document.querySelector('.bottom-note').getBoundingClientRect().bottom>document.querySelector('.paper footer').getBoundingClientRect().top);
  check(!footerOverlap,'One-pager body clears footer');
  await page.locator('.paper').screenshot({path:path.join(out,'one-pager-preview.png')});
  await page.locator('.brand').evaluateAll(links=>links.forEach(a=>a.removeAttribute('href')));
  await page.pdf({path:path.join(out,'jeeves-one-pager.pdf'),preferCSSPageSize:true,printBackground:true,tagged:true});
  report.pdf.push({file:'jeeves-one-pager.pdf',expectedPages:1,format:'A4'});
  await page.setViewportSize({width:1440,height:1000});
  await open('landing.html');
  for(const id of ['normal','needs_information','urgent']){
    await page.locator(`[data-case="${id}"]`).click();
    check(await page.locator(`[data-route="${id}"]`).getAttribute('class')==='active',`Landing illustration selects ${id}`);
  }
  await page.screenshot({path:path.join(out,'landing-preview.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await open('landing.html');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Landing has no horizontal overflow at 390px');
  await page.screenshot({path:path.join(out,'landing-mobile-preview.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  for(const file of ['landing.html','index.html','one-pager.html','deck.html']){
    await open(file);
    const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
    for(const href of links){
      if(href.startsWith('#')){check(await page.locator(href).count()>0,`${file}: anchor ${href} exists`);continue;}
      const target=path.resolve(root,href.split('#')[0].split('?')[0]);
      if(href==='exports/jeeves-launch-kit.zip')continue;
      check(target.startsWith(root+path.sep)&&existsSync(target),`${file}: local link ${href} resolves`);
    }
  }
  await open('index.html');
  await page.screenshot({path:path.join(out,'kit-preview.png'),fullPage:true});
  await writeFile(path.join(out,'deck-contact-sheet.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Jeeves deck overview</title><style>body{margin:0;padding:25px;background:#ded9ce;font:16px Arial;color:#202126}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{display:block;width:100%}figcaption{padding:7px 0}</style></head><body><h1>Jeeves · Product preview deck</h1><div class="grid">${Array.from({length:8},(_,i)=>`<figure><img src="slide-${i+1}.png" alt="Slide ${i+1}"><figcaption>${String(i+1).padStart(2,'0')} / 08</figcaption></figure>`).join('')}</div></body></html>`);
  await page.setViewportSize({width:1400,height:1800});
  await open('exports/deck-contact-sheet.html');
  await page.screenshot({path:path.join(out,'deck-contact-sheet.png'),fullPage:true});
  check(errors.length===0,'No browser JavaScript errors during rendering');
  await writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2)+'\n');
  const files={};
  async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await collect(file);else if(entry.name!=='jeeves-launch-kit.zip'&&entry.name!=='.DS_Store'){const relative=path.relative(root,file).split(path.sep).join('/');files['jeeves-launch-kit/'+relative]=new Uint8Array(await readFile(file));}}}
  await collect(root);
  await writeFile(path.join(out,'jeeves-launch-kit.zip'),zipSync(files,{level:6}));
  console.log(JSON.stringify({checks:report.checks.length,pdf:report.pdf,artwork:report.artwork,archiveBytes:(await stat(path.join(out,'jeeves-launch-kit.zip'))).size},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
