import { createServer } from "node:http";
export async function simulationServer() {
  const events: { path: string; method: string; body?: unknown }[] = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    events.push({
      path: url.pathname,
      method: req.method!,
      ...(raw ? { body: JSON.parse(raw) } : {}),
    });
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/v1/chat/completions") {
      const body = JSON.parse(raw);
      const observation = JSON.parse(body.messages.at(-1).content).observation;
      const cart = observation.text.split("Your cart")[1] || "";
      const action = cart.includes("Oat milk")
        ? {
            action: "review",
            summary:
              "Prepared one oat milk for $4.00. Review the cart before checkout.",
          }
        : {
            action: "click",
            target: observation.controls.find(
              (c: { name: string }) => c.name === "Add Oat milk",
            ).id,
          };
      json(200, {
        choices: [{ message: { content: JSON.stringify(action) } }],
      });
      return;
    }
    if (url.pathname === "/shop") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html lang="en"><head><title>Local grocery test store</title><style>body{font:18px system-ui;max-width:900px;margin:40px auto;background:#f7f4ec;color:#222}article{padding:18px;border:1px solid #ccc;margin:12px 0;display:flex;justify-content:space-between}button{padding:12px;font:inherit}#cart{padding:22px;background:#dbe7d3}</style></head><body><h1>Grocery test store</h1><p>Local simulation. Nothing here can be purchased.</p><label>Search products <input id="search" type="search"></label><button onclick="filter()">Search</button><section id="products"></section><section id="cart"></section><button id="checkout" onclick="fetch('/purchase',{method:'POST',body:'{}'}).then(()=>document.body.dataset.ordered='true')">Checkout</button><a href="/escape">External promotion</a><script>
      const products=[{id:'oat-milk',name:'Oat milk',price:4,allergens:'Oats; no nuts',stock:true},{id:'rolled-oats',name:'Rolled oats',price:3,allergens:'Oats; no nuts',stock:true},{id:'almond-milk',name:'Almond milk',price:5,allergens:'Contains almonds (tree nuts)',stock:true},{id:'whole-milk',name:'Whole milk',price:4,allergens:'Dairy',stock:false}];
      let cart=JSON.parse(localStorage.getItem('cart')||'[]');
      function filter(){let q=document.querySelector('#search').value.toLowerCase();document.querySelector('#products').innerHTML=products.filter(p=>p.name.toLowerCase().includes(q)).map(p=>'<article><div><strong>'+p.name+'</strong><p>$'+p.price+'.00 · '+p.allergens+' · '+(p.stock?'In stock':'Out of stock')+'</p></div><button '+(!p.stock?'disabled':'')+' data-product="'+p.id+'" onclick="add(this.dataset.product)">Add '+p.name+'</button></article>').join('');}
      function add(id){cart.push(id);localStorage.setItem('cart',JSON.stringify(cart));render();fetch('/cart',{method:'POST',body:JSON.stringify({id})});}
      function render(){document.querySelector('#cart').innerHTML='<h2>Your cart</h2>'+cart.map(id=>'<p>'+products.find(p=>p.id===id).name+' · $'+products.find(p=>p.id===id).price+'.00</p>').join('')+'<strong>Total: $'+cart.reduce((n,id)=>n+products.find(p=>p.id===id).price,0)+'.00</strong>';}
      filter();render();</script></body></html>`);
      return;
    }
    if (url.pathname === "/login-fixture") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        '<h1>Synthetic sign-in</h1><label>Password<input type="password"></label>',
      );
      return;
    }
    if (url.pathname === "/options") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><head><title>Grocery options</title></head><body>
        <h1>Oat milk · $4 per bottle</h1>
        <label>Quantity<select id="quantity"><option value="1">One bottle</option><option value="2">Two bottles</option><option value="3" disabled>Three bottles — unavailable</option></select></label>
        <label><input type="checkbox" id="substitutions" checked>Allow substitutions</label>
        <button disabled>Add unavailable milk</button><button style="visibility:hidden">Invisible promotion</button>
        <button onclick="localStorage.setItem('prepared-cart',JSON.stringify({quantity:Number(quantity.value),substitutions:substitutions.checked}));document.querySelector('#result').textContent='Cart: '+quantity.value+' bottles. Substitutions: '+substitutions.checked;fetch('/cart',{method:'POST',body:JSON.stringify({quantity:Number(quantity.value),substitutions:substitutions.checked})})">Add configured milk</button>
        <p id="result"></p><button onclick="fetch('/purchase',{method:'POST',body:'{}'})">Checkout</button>
        <script>const prior=JSON.parse(localStorage.getItem('prepared-cart')||'null');if(prior)document.querySelector('#result').textContent='Cart: '+prior.quantity+' bottles. Substitutions: '+prior.substitutions;</script>
      </body></html>`);
      return;
    }
    if (url.pathname === "/escape") {
      res.writeHead(302, { Location: "http://localhost:1/not-allowed" });
      res.end();
      return;
    }
    if (url.pathname === "/purchase" || url.pathname === "/cart") {
      json(200, { ok: true });
      return;
    }
    if (url.pathname === "/rate-limit") {
      res.setHeader("Retry-After", "60");
      json(429, { message: "Slow down" });
      return;
    }
    if (url.pathname.startsWith("/repos/")) {
      if (req.headers.authorization !== "Bearer fixture-maintainer-token") {
        json(401, { message: "Bad credentials" });
        return;
      }
      if (url.pathname.endsWith("/issues")) {
        json(200, [
          {
            number: 12,
            title: "Crash when loading an empty project",
            html_url: "https://github.com/acme/project/issues/12",
            labels: [{ name: "bug" }],
            body: "Steps: create an empty project, then reopen it.",
          },
          {
            number: 13,
            title: "Documentation typo",
            html_url: "https://github.com/acme/project/issues/13",
            labels: [{ name: "documentation" }],
          },
        ]);
        return;
      }
      if (url.pathname.endsWith("/pulls")) {
        json(200, [
          {
            number: 14,
            title: "Fix empty project crash",
            html_url: "https://github.com/acme/project/pull/14",
            draft: false,
          },
        ]);
        return;
      }
    }
    if (url.pathname === "/echo") {
      json(200, { body: raw ? JSON.parse(raw) : null });
      return;
    }
    json(404, { error: "Not found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return {
    origin: `http://127.0.0.1:${address.port}`,
    events,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
