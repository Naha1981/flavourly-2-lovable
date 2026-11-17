const GUEST_DEMO="<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Flavourly - fictional guest workspace</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f2e9;color:#20251c;font:17px/1.55 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:32px 20px}h1{font-size:clamp(30px,6vw,52px);line-height:1.1}h2{font-size:24px}section{background:white;border:1px solid #d7ddce;border-radius:18px;padding:24px;margin:20px 0}.note{padding:16px;background:#fff2c2;border:1px solid #bc9430;border-radius:10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}button,a{font:inherit}button{min-height:48px;padding:10px 16px;border:1px solid #184b30;border-radius:8px;background:#184b30;color:white;cursor:pointer;margin:8px 4px 0 0}button:disabled{background:#68796d;cursor:default}a{color:#184b30}label{display:block;font-weight:700}select{font:inherit;padding:10px;max-width:100%}strong{font-weight:750}.status{color:#184b30;font-weight:750}nav{display:flex;gap:20px;flex-wrap:wrap}</style><main><nav><strong>Flavourly</strong><a href=\"/\">Product home</a><a href=\"/login\">Account sign in</a></nav><h1>A restaurant workday.<br>A fictional guest preview.</h1><p class=\"note\">SAMPLE ONLY. All names, messages, figures and actions below are invented. This browser-only preview does not connect a restaurant, send WhatsApp, make bookings or save customer data. Ready to use your own restaurant workspace? <a href=\"/signup\">Create an account</a> or <a href=\"/login\">sign in</a>.</p><section><h2>1. Inspect an enquiry</h2><label for=\"scenario\">Choose a sample message</label><select id=\"scenario\"><option value=\"booking\">Booking request</option><option value=\"hours\">Opening-hours enquiry</option><option value=\"complaint\">Customer complaint</option></select><p id=\"message\">Fictional guest: Do you have a table for two at 19:00?</p><button id=\"prepare\">Prepare example reply</button><div id=\"reply\" aria-live=\"polite\"></div></section><section><h2>2. Review a quiet-night opportunity</h2><p>Fictional Tuesday: 8 covers versus a sample target of 20. This is a sample, not connected till data or verified lost revenue.</p><button id=\"campaign\">Review sample campaign</button><div id=\"campaign-result\" aria-live=\"polite\"></div></section><section><h2>3. Review the local activity log</h2><p>No messages leave this page. Refreshing clears this session.</p><ul id=\"log\"><li>Guest preview opened. No restaurant connected.</li></ul><button id=\"reset\">Reset sample</button></section><p>Production use requires a restaurant account, its authorised WhatsApp connection, opt-in controls and a tested activation. No live AI or revenue recovery is proven by this preview.</p></main><script>const $=id=>document.getElementById(id);const data={booking:['Fictional guest: Do you have a table for two at 19:00?','Thanks. I can record your request for two at 19:00. The restaurant must confirm availability.'],hours:['Fictional guest: What time do you close?','Our sample kitchen closes at 21:00. These are invented opening hours for this preview.'],complaint:['Fictional guest: My order arrived cold.','I am sorry your order arrived cold. I will pass this to the restaurant manager for human review.']};function log(t){let l=document.createElement('li');l.textContent=t;$('log').append(l)}$('scenario').onchange=()=>{$('message').textContent=data[$('scenario').value][0];$('reply').replaceChildren()};$('prepare').onclick=()=>{$('reply').replaceChildren();let p=document.createElement('p');p.textContent='EXAMPLE DRAFT: '+data[$('scenario').value][1];let b=document.createElement('button');b.textContent='Record reviewed locally (do not send)';b.onclick=()=>{b.disabled=true;b.textContent='Reviewed locally. Nothing sent.';log('Sample reply reviewed: '+$('scenario').value+'. No message sent.')};$('reply').append(p,b)};$('campaign').onclick=()=>{$('campaign-result').textContent='SAMPLE DRAFT: Tuesday supper offer for opted-in guests. A manager must review the offer, audience, consent and capacity before any real campaign. Nothing sent.';log('Fictional quiet-night campaign reviewed. No recipients selected or contacted.')};$('reset').onclick=()=>location.reload();</script></html>\n";
// worker.mjs
var PUBLIC = "https://flavourly.nahalabs.co.za";
var UPSTREAM = "https://8e5facdc.flavourly-stranger-preview.pages.dev";
var worker_default = {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.origin !== PUBLIC) return new Response("Not found", { status: 404 });
    if ([...incoming.searchParams.keys()].some((key) => /^(password|passwd|passcode|pwd)$/i.test(key))) {
      return new Response(null, { status: 303, headers: { location: incoming.origin + incoming.pathname, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
    }
    if(incoming.pathname === '/claim' || incoming.pathname.startsWith('/claim/')) return new Response(null,{status:302,headers:{location:PUBLIC + '/', 'cache-control':'no-store'}});
    if(incoming.pathname === '/demo' && ['GET','HEAD'].includes(request.method)) return Response.redirect(PUBLIC + '/try' + incoming.search, 302);
    if(incoming.pathname === '/try' && ['GET','HEAD'].includes(request.method)) return new Response(request.method === 'HEAD' ? null : GUEST_DEMO,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.set("x-forwarded-host", incoming.host);
    headers.set("x-forwarded-proto", "https");
    if (headers.get("origin") === PUBLIC) headers.set("origin", UPSTREAM);
    const referer = headers.get("referer");
    if (referer && new URL(referer).origin === PUBLIC) headers.set("referer", referer.replace(PUBLIC, UPSTREAM));
    const response = await fetch(UPSTREAM + incoming.pathname + incoming.search, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? void 0 : request.body,
      redirect: "manual"
    });
    const out = new Headers(response.headers);
    const location = out.get("location");
    if (location && (location === UPSTREAM || location.startsWith(UPSTREAM + "/") || location.startsWith(UPSTREAM + "?"))) out.set("location", location.replace(UPSTREAM, PUBLIC));
    const cookies = response.headers.getSetCookie();
    if (cookies.length) {
      out.delete("set-cookie");
      for (const cookie of cookies) out.append("set-cookie", cookie.replace(/;\s*Domain=(?:\.)?flavourly-2-lovable\.lovable\.app(?=;|$)/ig, ""));
    }
    if (!incoming.pathname.startsWith("/assets/")) out.set("cache-control", "private, no-store");
    if(incoming.pathname.startsWith('/assets/routes-') && incoming.pathname.endsWith('.js')) {
      let js=await response.text();
      js=js.replace("(0,x.jsx)(h,{asChild:!0,size:`lg`,className:`rounded-full px-7 text-base shadow-[var(--shadow-lift)]`,children:(0,x.jsx)(r,{to:`/claim/$slug`,params:{slug:`marble-jhb`},children:`See what Flavourly finds`})})",'null');
      out.set('cache-control','no-store');out.delete('content-length');out.delete('etag');
      return new Response(js,{status:response.status,headers:out});
    }
    const result = new Response(response.body, { status: response.status, statusText: response.statusText, headers: out });
    if (incoming.pathname === "/login" && (out.get("content-type") || "").includes("text/html")) {
      return new HTMLRewriter().on("form", { element(form) {
        form.setAttribute("method", "post");
      } }).transform(result);
    }
    if(['/', '/login', '/signup'].includes(incoming.pathname) && (out.get('content-type')||'').includes('text/html')) return new HTMLRewriter().on('a[href^="/claim/"]',{element(e){e.remove()}}).on('body',{element(e){e.prepend('<aside style="padding:16px;background:#fff2c2;color:#20251c;font:16px system-ui;text-align:center">Free recovery workspace: create a new account. Previous accounts and menus have not been copied from the paused service. <a href="/try" style="color:#184b30;font-weight:bold">Explore a fictional guest workspace</a>.</aside>',{html:true})}}).transform(result);
    return result;
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
