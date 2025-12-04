// ==UserScript==
// @name         SubscribeStar Export
// @namespace    export-fullhead
// @version      1.1.6
// @updateURL    https://github.com/Kamdar-Wolf/Skripty/raw/refs/heads/SubscribeStar/Export.user.js
// @downloadURL  https://github.com/Kamdar-Wolf/Skripty/raw/refs/heads/SubscribeStar/Export.user.js
// @match        https://subscribestar.adult/*
// @match        https://subscribestar.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      subscribestar.adult
// @connect      subscribestar.com
// @connect      assets.subscribestar.com
// @connect      d3ts7pb9ldoin4.cloudfront.net
// @connect      ss-uploads-prod.b-cdn.net
// @run-at       document-idle
// ==/UserScript==

(function(){
  'use strict';

  /* ================== Mount & UI ================== */
  const STORE_TOGGLES = 'ssx_toggles_v1';
  let LIVE_LAYOUT = null;
  let DIR_HANDLE = null;
  let mounted = false;
  let hostEl = null;
  let shadow = null;
  let panelEl = null;
  let resizeObs = null;
  let trHandle = null;
  let isResizingTR = false;
  let trStartX = 0, trStartY = 0, trStartW = 0, trStartH = 0;

  function getToggles(){
    try{ return GM_getValue(STORE_TOGGLES, { useFs:false, newOnly:true, limit:20, newestFirst:true, panelW:null, panelH:null }); }
    catch{ return {useFs:false,newOnly:true,limit:20,newestFirst:true,panelW:null,panelH:null}; }
  }
  function setToggles(next){ try{ GM_setValue(STORE_TOGGLES, next); }catch{} }
  function updateToggles(part){ const cur=getToggles(); setToggles({ ...cur, ...part }); }
  function readPanelSize(){ if(!panelEl) return {}; const r=panelEl.getBoundingClientRect(); return { panelW:`${Math.round(r.width)}px`, panelH:`${Math.round(r.height)}px` }; }
  function applyPanelSize(){ const t=getToggles(); if(panelEl){ if(t.panelW) panelEl.style.width=t.panelW; if(t.panelH) panelEl.style.height=t.panelH; } }
  function watchPanelResize(){ if(!panelEl || !window.ResizeObserver) return; if(resizeObs) resizeObs.disconnect(); resizeObs=new ResizeObserver((entries)=>{ const e=entries[0]; if(!e) return; const w=Math.round(e.contentRect.width); const h=Math.round(e.contentRect.height); updateToggles({ panelW:`${w}px`, panelH:`${h}px` }); }); resizeObs.observe(panelEl); }

  /* ====== Vlastní resize z pravého horního rohu ====== */
  function initTopRightResize(){
    if(!shadow || !panelEl) return;
    trHandle = shadow.querySelector('.resize-tr');
    if(!trHandle) return;
    trHandle.addEventListener('mousedown', startTopRightResize);
  }

  function startTopRightResize(e){
    e.preventDefault();
    e.stopPropagation();
    if(!panelEl) return;
    isResizingTR = true;
    const r = panelEl.getBoundingClientRect();
    trStartX = e.clientX;
    trStartY = e.clientY;
    trStartW = r.width;
    trStartH = r.height;

    window.addEventListener('mousemove', doTopRightResize, true);
    window.addEventListener('mouseup', stopTopRightResize, true);
  }

  function doTopRightResize(e){
    if(!isResizingTR || !panelEl) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - trStartX;      // doprava => širší, doleva => užší
    const dy = trStartY - e.clientY;      // nahoru => vyšší, dolů => nižší
    const newW = Math.max(260, trStartW + dx);
    const newH = Math.max(180, trStartH + dy);
    panelEl.style.width = newW + 'px';
    panelEl.style.height = newH + 'px';
  }

  function stopTopRightResize(e){
    if(!isResizingTR) return;
    e.preventDefault();
    e.stopPropagation();
    isResizingTR = false;
    window.removeEventListener('mousemove', doTopRightResize, true);
    window.removeEventListener('mouseup', stopTopRightResize, true);
    updateToggles(readPanelSize());
  }

  function ensureMounted(){
    if (mounted) return;
    hostEl = document.createElement('div');
    hostEl.className = 'ssg-wrap';
    shadow = hostEl.attachShadow({mode:'open'});

    document.body.appendChild(hostEl);
    Object.assign(hostEl.style, {
      position: 'fixed', left: '16px', bottom: '16px', zIndex: '2147483647'
    });

    shadow.innerHTML = `
      <style>
        :host{ all: initial; }
        .panel{
          position: relative;
          font: 13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial;
          color:#111; background:#fafafa; border:1px solid #e5e7eb; border-radius:10px;
          padding:12px; min-width: 320px; max-width: 90vw; box-shadow: 0 6px 18px rgba(0,0,0,.12);
          resize: both; overflow: auto; box-sizing: border-box; display:flex; flex-direction:column; gap:10px;
          width: var(--ssx-panel-w, 360px); height: var(--ssx-panel-h, auto);
        }
        .resize-tr{
          position:absolute;
          top:4px;
          right:6px;
          width:16px;
          height:16px;
          cursor: nesw-resize;
          border-radius:3px;
          background:transparent;
        }
        .resize-tr::after{
          content:"";
          position:absolute;
          inset:3px;
          border-top:1px solid #9ca3af;
          border-right:1px solid #9ca3af;
          opacity:.7;
          pointer-events:none;
        }
        .resize-tr:hover::after{ opacity:1; }
        .row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px; width:100%; }
        .row:last-child{ margin-bottom:0; }
        .row > *{ flex: 0 1 auto; }
        button{ background:#111; color:#fff; border-radius:8px; padding:9px 12px; cursor:pointer; font-weight:600; border:0; }
        .row button{ flex:1 1 0; }
        button:disabled{ opacity:.6; cursor:default; }
        label{ display:inline-flex; align-items:center; gap:6px; padding:4px 6px; border-radius:6px; background:#fff; border:1px solid #e5e7eb; }
        input[type="checkbox"]{ width:16px; height:16px; cursor:pointer; }
        input[type="number"]{ width:90px; padding:6px 8px; border:1px solid #e5e7eb; border-radius:6px; }
        .log{ max-height:300px; overflow:auto; padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px; background:#0e0e10; color:#ddd; font:12px/1.35 Consolas,monospace; width:100%; box-sizing:border-box; flex:1 1 auto; }
        .ok{ color:#4caf50 } .warn{ color:#ffb300 } .err{ color:#f44336 }
        .hdr{ font-weight:700; margin-bottom:8px; }
        .small{ opacity:.7; font-size:12px; }
      </style>
      <div class="panel">
        <div class="resize-tr" title="Změnit velikost panelu"></div>
        <div class="hdr">SubscribeStar Export</div>
        <div class="row">
          <button id="pick">Vybrat složku</button>
          <label><input id="usefs" type="checkbox"> Ukládat do složky</label>
          <label><input id="newonly" type="checkbox" checked> Jen nové</label>
          <label>Limit: <input id="limit" type="number" min="1" step="1" value="20"></label>
          <button id="order" title="Přepíná pořadí stahování">Pořadí</button>
        </div>
        <div class="row">
          <button id="runDetail">Stáhnout aktuální feed</button>
          <button id="runList">Stáhnout LIST (/posts/*)</button>
        </div>
        <div class="row small">Detail = aktuální /posts/{id}.  List = projít odkazy na této stránce a každý /posts/{id} stáhnout samostatně.</div>
        <div id="log" class="log"></div>
      </div>
    `;

    panelEl = shadow.querySelector('.panel');
    applyPanelSize();
    watchPanelResize();
    initTopRightResize();

    wireUI();
    mounted = true;
    log('UI připraveno. Otevři detail /posts/{id} nebo list autora.', 'ok');
  }

  function watchForSPA(){
    // Reakce na pushState/replaceState/popstate (SPA navigace)
    const _ps = history.pushState;
    history.pushState = function(...args){ const r = _ps.apply(this,args); setTimeout(()=>{ ensureMounted(); }, 50); return r; };
    const _rs = history.replaceState;
    history.replaceState = function(...args){ const r = _rs.apply(this,args); setTimeout(()=>{ ensureMounted(); }, 50); return r; };
    window.addEventListener('popstate', ()=>{ setTimeout(()=>{ ensureMounted(); }, 50); });

    // Pozorování DOM změn (lazy load sekcí)
    const mo = new MutationObserver(()=>{});
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  /* ================== UI logic ================== */
  let btnPick, cbUseFs, cbNew, inpLim, btnDetail, btnList, logBox, btnOrder;
  let isNewestFirst = true;
  function $(sel){ return shadow.querySelector(sel); }
  function log(msg, cls){
    const d=document.createElement('div'); if(cls)d.className=cls; d.textContent=msg;
    logBox.appendChild(d); logBox.scrollTop = 1e9;
  }

  function wireUI(){
    btnPick   = $('#pick');
    cbUseFs   = $('#usefs');
    cbNew     = $('#newonly');
    inpLim    = $('#limit');
    btnDetail = $('#runDetail');
    btnList   = $('#runList');
    btnOrder  = $('#order');
    logBox    = $('#log');

    const t = getToggles();
    cbUseFs.checked = !!t.useFs;
    cbNew.checked   = t.newOnly!==false;
    inpLim.value    = String(t.limit ?? 20);
    isNewestFirst   = t.newestFirst!==false;

    function persistToggles(){
      updateToggles({ useFs: cbUseFs.checked, newOnly: cbNew.checked, limit: Number(inpLim.value)||20, newestFirst: isNewestFirst, ...readPanelSize() });
    }

    function refreshOrderLabel(){
      btnOrder.textContent = isNewestFirst ? 'Pořadí: od nejnovějších' : 'Pořadí: od nejstarších';
    }
    refreshOrderLabel();

    [cbUseFs, cbNew].forEach(inp=>{
      inp.addEventListener('click', e=>{ e.stopPropagation(); e.stopImmediatePropagation(); }, true);
      inp.addEventListener('change', ()=>{
        persistToggles();
        log(`Nastavení uloženo: složka=${cbUseFs.checked?'ANO':'NE'}, jen-nové=${cbNew.checked?'ANO':'NE'}`, 'ok');
      });
    });
    inpLim.addEventListener('change', ()=>{
      const v = Math.max(1, Math.floor(Number(inpLim.value)||20));
      inpLim.value = String(v);
      persistToggles();
      log(`Limit uložen: ${v}`, 'ok');
    });

    btnOrder.addEventListener('click', (e)=>{ e.stopPropagation();
      isNewestFirst = !isNewestFirst; refreshOrderLabel(); persistToggles();
      log(`Pořadí stahování: ${isNewestFirst?'od nejnovějších':'od nejstarších'}`,'ok');
    });

    btnPick.addEventListener('click', async (e)=>{ e.stopPropagation();
      try{
        await pickDirectory();
        log('Složka vybrána (Chromium).','ok');
      }catch(err){ log(`Výběr složky: ${err.message||err}`,'warn'); }
    });

    btnDetail.addEventListener('click', async (e)=>{ e.stopPropagation(); disableButtons(true);
      try{ await processDetail(); } finally{ disableButtons(false); }
    });
    btnList.addEventListener('click', async (e)=>{ e.stopPropagation(); disableButtons(true);
      try{ await processList(); } finally{ disableButtons(false); }
    });
  }

  function disableButtons(v){
    btnDetail.disabled = btnList.disabled = !!v;
  }

  /* ================== Utils ================== */
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const abs = (u, base=location.href) => { try { return new URL(u, base).href; } catch { return u; } };
  const extFrom = n => (n.split('?')[0].match(/\.(jpe?g|png|webp|gif|bmp|tiff?|heic|avif)$/i)?.[1]||'jpg').toLowerCase();
  const escapeHtml = s => (s||'').replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));
  const STORE_HASHES = 'ssx_hashes_v1';
  function loadHashes(){ try{ return GM_getValue(STORE_HASHES, {}); }catch{ return {}; } }
  function saveHashes(obj){ try{ GM_setValue(STORE_HASHES, obj); }catch{} }
  function hashText(str){ let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=(h + (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0; } return ('00000000'+h.toString(16)).slice(-8); }
  function extractContentText(doc){
    const root = doc.querySelector('.post__content, .post-content, .post.body, .post-body, .post');
    let txt = root ? (root.textContent||'') : '';
    return txt.replace(/\s+/g,' ').trim();
  }
  function xfetch(url, type='text'){
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'GET', url: abs(url),
        responseType: type,
        onload: r => (r.status>=200&&r.status<300) ? resolve(r.response) : reject(new Error(`${r.status}`)),
        onerror: ()=>reject(new Error('XHR error')), ontimeout: ()=>reject(new Error('timeout'))
      });
    });
  }
  async function blobToDataURL(blob){ return await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(new Error('FileReader')); fr.readAsDataURL(blob); }); }

  /* -------- Folder picker (Chromium) -------- */
  async function pickDirectory(){
    if (!('showDirectoryPicker' in window)) throw new Error('Folder picker není podporován tímto prohlížečem');
    DIR_HANDLE = await window.showDirectoryPicker({ id:'ss-export' });
    cbUseFs.checked = true; updateToggles({ useFs:true, newOnly: cbNew.checked, limit: Number(inpLim.value)||20, newestFirst: isNewestFirst, ...readPanelSize() });
  }
  async function writeToDir(pathName, blob){
    if (!DIR_HANDLE) throw new Error('Složka není vybrána');
    const safe = pathName.replace(/[\\/]+/g,'_');
    const fh = await DIR_HANDLE.getFileHandle(safe, { create:true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
  }
  async function fsExists(name){
    if (!DIR_HANDLE) return false;
    try{ await DIR_HANDLE.getFileHandle(name.replace(/[\\/]+/g,'_'), { create:false }); return true; }catch{ return false; }
  }
  function saveBlobStd(name, blob){
    const u = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u), 1500);
  }
  async function saveFile(name, blob){
    if (cbUseFs.checked && DIR_HANDLE){
      try{ await writeToDir(name, blob); return; }
      catch(e){ log(`FS save selhalo → běžné stahování: ${e.message||e}`,'warn'); }
    }
    saveBlobStd(name, blob);
  }
  function saveHTML(name, html){ return saveFile(name, new Blob([html], {type:'text/html;charset=utf-8'})); }

  /* -------- Datum → text pro TITLE -------- */
  function parseCZ(stamp){
    if(!stamp) return null;
    const m = stamp.trim().replace(/\s+/g,' ')
      .match(/([A-Za-zÁ-ž]{3,})\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(dopoledne|odpoledne)/i);
    if(!m) return null;
    const map={'led':1,'úno':2,'uno':2,'bře':3,'bre':3,'dub':4,'kvě':5,'kve':5,'čvn':6,'cvn':6,'čvc':7,'cvc':7,'srp':8,'zář':9,'zar':9,'říj':10,'rij':10,'lis':11,'pro':12};
    const norm=s=>{const k=s.toLowerCase().slice(0,3); const a=k.normalize('NFKD').replace(/[^\x00-\x7F]/g,''); return map[k]||map[a]||null;};
    const mon = norm(m[1]); if(!mon) return null;
    let h = parseInt(m[4],10); const mm=m[5]; const ap=(m[6]||'').toLowerCase();
    if(ap==='odpoledne' && h<12) h+=12; if(ap==='dopoledne' && h===12) h=0;
    const pad = n=>String(n).padStart(2,'0');
    return `${m[3]}-${pad(mon)}-${pad(parseInt(m[2],10))} ${pad(h)}.${mm}`;
  }

  /* -------- Layout měření (pro centrování) -------- */
  function px(v, fb){ const n=parseFloat(v); return Number.isFinite(n)?`${Math.round(n)}px`:(fb??null); }
  function measureLayout(){
    const sec = document.querySelector('.section.for-single_post, .for-single_post.section');
    const sb  = document.querySelector('.section-body');
    const F='15px';
    const secW = sec ? Math.round(sec.getBoundingClientRect().width)+'px' : null;
    return {
      secPL : sec ? px(getComputedStyle(sec).paddingLeft, F)  : F,
      secPR : sec ? px(getComputedStyle(sec).paddingRight, F) : F,
      sbPL  : sb  ? px(getComputedStyle(sb).paddingLeft, null)  : null,
      sbPR  : sb  ? px(getComputedStyle(sb).paddingRight, null) : null,
      secW
    };
  }

  /* -------- HEAD + center CSS -------- */
  async function buildHeadFrom(doc){
    const head = doc.head.cloneNode(true);
    head.querySelectorAll('[href]').forEach(n=>n.setAttribute('href', abs(n.getAttribute('href'), doc.baseURI)));
    head.querySelectorAll('[src]').forEach(n=>n.setAttribute('src', abs(n.getAttribute('src'), doc.baseURI)));

    const allowed = new Set(['assets.subscribestar.com', new URL(location.href).host]);
    const links = Array.from(head.querySelectorAll('link[rel="stylesheet"][href]'));
    for(const ln of links){
      const href = ln.getAttribute('href'); if(!href) continue;
      let ok=false; try{ ok = allowed.has(new URL(href).host); }catch{}
      if(!ok) continue;
      try{
        const css = await xfetch(href,'text'); const st = doc.createElement('style'); st.textContent = css; ln.replaceWith(st);
        log(`Inline CSS: ${href}`,'ok');
      }catch{}
      await sleep(5);
    }

    const o = LIVE_LAYOUT || {};
    const fit = doc.createElement('style');
    fit.textContent = `
      :root, html, body{ margin:0; padding:0; width:100%; min-width:0 !important; max-width:1000px !important; box-sizing:border-box; }
      *, *::before, *::after{ box-sizing:border-box; }
      body{ display:block !important; margin-left:auto !important; margin-right:auto !important; overflow-x:hidden !important; }
      #app, .site-wrapper, .site, #root{ max-width:1000px !important; margin:0 auto !important; width:100% !important; }
      .ssx-center{ max-width:1000px !important; width:100% !important; margin:0 auto !important; padding:0 16px; }
      .ssx-center > *{ max-width:100%; width:100% !important; margin-left:auto !important; margin-right:auto !important; }
      /* media fit */
      .section-body img, .section-body video, .section-body canvas, .section-body iframe,
      .post-uploads img, .trix-content img, .post-content img, .post__content img { max-width:100% !important; height:auto !important; }
      /* centrovat hlavičku i hlavní sekci */
      #HEADER, header, .HEADER, .site-header { margin-left:auto !important; margin-right:auto !important; text-align:center !important; display:block; }
      .section.for-single_post, .for-single_post.section, .post.wrapper.is-single, .post.wrapper {
        margin-left:auto !important; margin-right:auto !important;
        max-width:1000px !important; width:100% !important;
        padding-left:${o.secPL||'15px'} !important; padding-right:${o.secPR||'15px'} !important;
      }
      ${o.sbPL||o.sbPR ? `.section-body { ${o.sbPL?`padding-left:${o.sbPL} !important;`:''} ${o.sbPR?`padding-right:${o.sbPR} !important;`:''} }` : ''}
      /* preview v .post-uploads.for-youtube */
      .post-uploads.for-youtube .preview .preview__link img{ display:block; width:100%; height:auto; }
      .post-uploads.for-youtube .preview .preview__filename{ margin-top:6px; font:12px/1.3 system-ui,Segoe UI,Roboto,Arial; word-break:break-word; }
    `;
    head.appendChild(fit);

    const titleTxt = (doc.title||'Post').replace(/[&<>\"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
    const prepend = ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width,initial-scale=1">', `<title>${titleTxt}</title>`].join('\n');
    return `<head>\n${prepend}\n${head.innerHTML}\n</head>`;
  }

  /* -------- Čistka a absolutizace -------- */
  function cleanupClone(clone, baseURI){
    clone.querySelectorAll('.ssg-wrap').forEach(n=>n.remove());
    clone.querySelectorAll('.post-warning_mature').forEach(n=>n.remove());
    clone.querySelectorAll('.vertical_more_menu.is-small').forEach(n=>n.remove());
    clone.querySelectorAll('.comments-row.for-new_comment.for-single_post, .comments-row.for-new_comment').forEach(n=>n.remove());
    // smazat obrázkový .post-uploads, ale zachovat/vytvořit .for-youtube
    clone.querySelectorAll('.post-uploads:not(.for-youtube)').forEach(n=>n.remove());
    clone.querySelectorAll('[href]').forEach(n=>n.setAttribute('href', abs(n.getAttribute('href'), baseURI)));
    clone.querySelectorAll('[src]').forEach(n=>n.setAttribute('src', abs(n.getAttribute('src'), baseURI)));
  }

  /* -------- Galerie / originály -------- */
  function extractItemsFrom(node){
    const out=[]; node.querySelectorAll('[data-gallery]').forEach(n=>{ try{ const arr=JSON.parse(n.getAttribute('data-gallery')||'[]'); if(Array.isArray(arr)) arr.forEach(it=>{ if(it && typeof it==='object') out.push(it); }); }catch{} });
    return out;
  }
  async function resolveOriginalUrl(item){
    if (item?.url && /\/post_uploads\?payload=/.test(item.url)) return abs(item.url);
    const first = item?.url || (item?.id ? `/post_uploads/${item.id}` : null); if(!first) return null;
    try{
      const html=await xfetch(first,'text');
      const d=new DOMParser().parseFromString(html,'text/html');
      const a=d.querySelector('a.gallery-image_original_link');
      return a?.href ? abs(a.href, d.baseURI) : abs(first, d.baseURI);
    }catch{ return abs(first); }
  }
  function injectIntoForYouTube(cloneRoot, galleryObjs){
    let cont = cloneRoot.querySelector('.post-uploads.for-youtube');
    if (!cont){
      const host = cloneRoot.querySelector('.post__content, .post-content, .post-body, .post.wrapper, .post') || cloneRoot;
      cont = document.createElement('div'); cont.className = 'post-uploads for-youtube'; host.appendChild(cont);
    }
    cont.innerHTML = '';
    (galleryObjs||[]).forEach(g=>{
      const p = document.createElement('div'); p.className = 'preview';
      const a = document.createElement('a'); a.className='preview__link'; a.href=encodeURI(g.localName); a.setAttribute('download','');
      const img = document.createElement('img'); img.src=g.dataURL; img.alt=g.filename; a.appendChild(img);
      const name = document.createElement('div'); name.className='preview__filename';
      name.innerHTML = `<a href="${encodeURI(g.localName)}" download>${escapeHtml(g.filename)}</a>`;
      p.append(a, name); cont.appendChild(p);
    });
  }

  /* ================== Pomocníci: názvy ================== */
  function stableHtmlName(id){ return `post-${id}.html`; }
  function humanTitleFrom(doc, id){
    const stamp = (doc.querySelector('.section-title_date')||doc.querySelector('.post-date, .post-date a'))?.textContent?.trim() || '';
    return parseCZ(stamp) || `post-${id}`;
  }

  /* ================== STAHOVÁNÍ JEDNOHO POSTU ================== */
  async function downloadPostById(id){
    const html = await xfetch(`/posts/${id}`,'text');
    const fetched = new DOMParser().parseFromString(html,'text/html');

    const store = loadHashes();
    const h = hashText(extractContentText(fetched));
    const htmlName = stableHtmlName(id);
    const niceBase = humanTitleFrom(fetched,id);

    // „Jen nové“: přeskočit, pokud již máme hash uložený
    if (cbNew.checked && store[id] && store[id].hash === h){
      log(`Přeskočeno (dříve staženo & beze změny): #${id} ⇒ ${store[id].name||htmlName}`,'warn');
      return;
    }

    log(`Zpracovávám feed #${id} ⇒ ${htmlName}`);

    // obrázky
    let items = extractItemsFrom(fetched);
    if(!items.length){
      try{
        const up=await xfetch(`/posts/${id}/uploads`,'text');
        const frag=new DOMParser().parseFromString(up,'text/html');
        items = extractItemsFrom(frag);
      }catch{}
    }
    const galleryObjs=[];
    if(items.length){
      let i=1;
      for(const it of items){
        const orig = await resolveOriginalUrl(it); if(!orig) continue;
        try{
          const blob = await xfetch(orig,'blob');
          const ext=extFrom(it.original_filename||orig);
          const localName = `${niceBase}_${i}.${ext}`;
          await saveFile(localName, blob);
          const dataURL = await blobToDataURL(blob);
          galleryObjs.push({ index:i, filename:(it.original_filename||`image_${i}.${ext}`), localName, dataURL });
          log(`IMG ${localName}`,'ok'); i++;
        }catch(e){ log(`Chyba IMG: ${e.message||e}`,'warn'); }
        await sleep(50);
      }
    }

    LIVE_LAYOUT = measureLayout();
    const headHTML = await buildHeadFrom(fetched);

    const root =
      fetched.querySelector('.section.for-single_post, .for-single_post.section') ||
      fetched.querySelector('.post.wrapper.is-single') ||
      fetched.querySelector('.post.wrapper') ||
      fetched.body;

    const clone = root.cloneNode(true);
    cleanupClone(clone, fetched.baseURI);
    if (galleryObjs.length) injectIntoForYouTube(clone, galleryObjs);

    const bodyInner = `<div class="ssx-center">${clone.outerHTML}</div>`;
    const finalHTML = [
      '<!doctype html>',
      `<html lang="${fetched.documentElement.getAttribute('lang')||'cs'}">`,
      headHTML,
      '<body>',
      bodyInner,
      '</body></html>'
    ].join('\n');

    await saveHTML(htmlName, finalHTML);
    log(`HTML ${htmlName}${galleryObjs.length?` + IMG x${galleryObjs.length}`:''}`,'ok');

    const store2 = loadHashes();
    store2[id] = { hash:h, name:htmlName, t:Date.now() }; saveHashes(store2);
  }

  /* ================== DETAIL tlačítko ================== */
  async function processDetail(){
    const m = location.pathname.match(/\/posts\/(\d+)/);
    if(!m){ log('Nejsi na /posts/{id}.','warn'); return; }
    const id = m[1];
    await downloadPostById(id);
    log('Hotovo (detail).','ok');
  }

  /* ================== LIST – podle odkazů /posts/* ================== */
  function collectPostIdsFromLinks(maxCount){
    const ids = [];
    const seen = new Set();
    const hostAllow = new Set(['subscribestar.adult','www.subscribestar.adult','subscribestar.com','www.subscribestar.com']);
    const candidates = Array.from(document.querySelectorAll('a[href], [data-post-id], [data-id]'));

    function pushId(id){
      if(!id) return; const norm=String(id).trim();
      if(!/^[0-9]+$/.test(norm)) return;
      if(seen.has(norm)) return;
      seen.add(norm); ids.push(norm);
    }

    for (const el of candidates){
      if (maxCount && ids.length >= maxCount) break;
      const attrId = el.getAttribute('data-post-id') || el.getAttribute('data-id');
      pushId(attrId);

      const href = el.getAttribute('href');
      if(!href) continue;
      try{
        const u = new URL(href, document.baseURI);
        if (!hostAllow.has(u.host)) continue;
        const m = u.pathname.match(/\/posts\/(\d+)(?=\/|$)/);
        if (m) pushId(m[1]);
        else {
          // nová struktura: /{autor}/posts/{id} nebo /link/{autor}/posts/{id}
          const m2 = u.pathname.match(/\/posts\/([0-9]+)/);
          if (m2) pushId(m2[1]);
        }
      }catch{ /* ignore malformed */ }
    }
    return maxCount ? ids.slice(0,maxCount) : ids;
  }

  async function processList(){
    const desired = Math.max(1, Math.floor(Number(inpLim.value)||20));
    let ids = collectPostIdsFromLinks(desired);

    async function clickPostsMore(){
      const btn = document.querySelector('.posts-more, .posts__more, [data-role="posts-more"], [data-action="posts-more"]');
      if (!btn) return false;
      const before = document.querySelectorAll('a[href*="/posts/"]').length;
      btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      try{ btn.click&&btn.click(); }catch{}
      const t0 = Date.now();
      while(Date.now()-t0<4000){
        await sleep(300);
        const now = document.querySelectorAll('a[href*="/posts/"]').length;
        if (now > before) return true;
      }
      return false;
    }

    async function scrollForMore(){
      const before = collectPostIdsFromLinks().length;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior:'smooth' });
      const t0 = Date.now();
      while(Date.now()-t0<2600){
        await sleep(350);
        const now = collectPostIdsFromLinks().length;
        if (now > before) return true;
      }
      return false;
    }

    // pokud nemáme dost, zkus načíst víc karet
    let guard = 0;
    while(ids.length < desired && guard++ < 12){
      const clicked = await clickPostsMore();
      const scrolled = await scrollForMore();
      ids = collectPostIdsFromLinks(desired);
      if (ids.length >= desired) break;
      if (!clicked && !scrolled) break;
    }

    if (!ids.length){
      log('Na stránce nejsou odkazy ve formátu /posts/{id}.','warn');
      return;
    }

    if (!isNewestFirst) ids = ids.slice().reverse();

    log(`Ke stažení (podle odkazů): ${ids.length} postů (limit ${desired}). Pořadí: ${isNewestFirst?'nejnovější → nejstarší':'nejstarší → nejnovější'}.`);
    for (const id of ids){
      try{ await downloadPostById(id); }
      catch(e){ log(`Chyba u #${id}: ${e.message||e}`,'err'); }
      await sleep(80);
    }
    log('Hotovo (list).','ok');
  }

  /* ================== Start ================== */
  ensureMounted();
  watchForSPA();
})();
