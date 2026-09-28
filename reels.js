/* MAZE APP — Reels модуль.
 * Эхний ачаалалтыг хөнгөлөхийн тулд index.html үүнийг Reels-ийг анх нээх үед л ачаална (loadReels).
 * index.html-ийн глобал хувьсагч/функцүүдийг (S, FS, db, R, RL_*, mapReel, toast, ...) шууд ашиглана. */
(function(){const st=document.createElement('style');st.textContent=`
#rl{position:absolute;inset:0;z-index:15;background:#000;color:#fff;display:flex;flex-direction:column}
.rlbar{position:absolute;left:0;right:0;top:0;z-index:3;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 18px;background:linear-gradient(rgba(0,0,0,.55),transparent);pointer-events:none}
.rlbar>*{pointer-events:auto}
.rlbar b{font-size:19px;font-weight:700;margin-right:auto}
#rl .ib{color:#fff;background:rgba(255,255,255,.16);border-color:transparent}
.rls{flex:1;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior:contain;scrollbar-width:none}
.rls::-webkit-scrollbar{display:none}
.rli{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;background:#000}
.rlp,.rlv{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.rlv{opacity:0;transition:opacity .2s}.rlv.on{opacity:1}
.rlt{position:absolute;inset:0;z-index:1}
.rli.rlld .rlt::before{content:"";position:absolute;left:50%;top:50%;width:38px;height:38px;margin:-19px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}
.rli.paused .rlt::after{content:"";position:absolute;left:50%;top:50%;width:0;height:0;margin:-30px 0 0 -18px;border-style:solid;border-width:30px 0 30px 48px;border-color:transparent transparent transparent rgba(255,255,255,.85);filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))}
.rli.err .rlt::after{content:"Видеог ачаалж чадсангүй";position:absolute;left:0;right:0;top:50%;text-align:center;opacity:.8}
.rlside{position:absolute;right:8px;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:2;display:flex;flex-direction:column;gap:14px;align-items:center}
.rlside button{display:flex;flex-direction:column;align-items:center;gap:3px;color:#fff;font-size:12px;font-weight:600;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6));min-width:48px}
.rlside button.on{color:var(--like)}
.rlcap{position:absolute;left:0;right:64px;bottom:0;z-index:2;padding:40px 14px calc(20px + env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,rgba(0,0,0,.6));font-size:14px;pointer-events:none}
.rlu{display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:6px;cursor:pointer;max-width:100%;pointer-events:auto;width:max-content}
.rlvc{display:inline-flex;align-items:center;gap:3px}
.rlu span.mute{color:rgba(255,255,255,.7);font-weight:400;font-size:12px}
.rlcap p{margin:0;overflow-wrap:anywhere;max-height:4.4em;overflow:hidden}
.rlpg{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.2);z-index:3}.rlpg i{display:block;height:100%;width:0;background:#fff}
.rlhp{position:absolute;left:50%;top:50%;z-index:2;font-size:96px;pointer-events:none;animation:dlikePop .8s ease-out forwards}
.rlempty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:rgba(255,255,255,.8)}
.rlempty .btn{margin-top:14px}
#rprev video{width:100%;max-height:260px;border-radius:16px;background:#000;display:block}
.rlsnd{position:absolute;left:50%;top:calc(74px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:4;display:none;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font-weight:600;font-size:14px;white-space:nowrap}
#rl.amute .rlsnd{display:flex}
.rlprog{height:6px;border-radius:3px;background:var(--line);overflow:hidden}.rlprog i{display:block;height:100%;width:0;background:var(--grad);transition:width .3s}
`;document.head.appendChild(st)})();

const fmtDur=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const rlSlide=i=>document.querySelector(`#rls .rli[data-i="${i}"]`);
// R.autoMuted: хөтөч дуутай автоматаар тоглуулахыг хориглосон тул дуугүй болсон (iOS). Дараагийн товшилт дууг асаана
const rlMuteUpd=()=>{const b=$('#rlmute');if(b)b.innerHTML=ic(R.mute?'mute':'speaker',22);const el=$('#rl');if(el)el.classList.toggle('amute',!!(R.mute&&R.autoMuted))};
// товшилтын дотор (синхрон) дуу асаана — iOS нь товшилтоос гадуур дуу асаахыг зөвшөөрдөггүй
function reelUnmute(){R.autoMuted=false;R.mute=false;const v=R.v;if(v){v.muted=false;if(v.src){const s=v.parentElement;if(s)s.classList.remove('paused');v.play().catch(()=>{})}}rlMuteUpd()}
// startId: тухайн reel-ээс эхэлнэ (хуваалцсан холбоос, хайлт, мэдэгдэл)
function reelOpen(startId){
  if(R.on){if(startId)reelReload(startId);return}R.on=true;
  const el=document.createElement('div');el.id='rl';el.setAttribute('role','dialog');el.setAttribute('aria-label','Reels');
  el.innerHTML=`<div class="rlbar"><button class="ib" data-a="rlclose" aria-label="Буцах">${ic('back',24)}</button><b>Reels</b><button class="ib" data-a="rlmute" id="rlmute" aria-label="Дуу асаах/унтраах">${ic(R.mute?'mute':'speaker',22)}</button><button class="ib" data-a="rladd" aria-label="Reel нэмэх">${ic('plus',22)}</button></div><button class="rlsnd" data-a="rlunmute">🔇 Дуу асаахын тулд дарна уу</button><div class="rls" id="rls"></div>`;
  $('#app').appendChild(el);
  const v=R.v=document.createElement('video');v.className='rlv';v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='auto';
  v.addEventListener('playing',()=>{const s=v.parentElement;v.classList.add('on');if(s)s.classList.remove('rlld','paused')});
  v.addEventListener('timeupdate',()=>{const s=v.parentElement,b=s&&s.querySelector('.rlpg i'),d=isFinite(v.duration)&&v.duration||(R.list[R.cur]||{}).dur;if(b&&d)b.style.width=Math.min(100,v.currentTime/d*100)+'%'});
  R.io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&e.intersectionRatio>=.6)reelActivate(+e.target.dataset.i)}),{root:$('#rls'),threshold:[.6]});
  reelReload(startId);
}
function reelClose(){
  if(!R.on)return;R.on=false;R.cur=-1;clearTimeout(rlTapT);
  if(R.io){R.io.disconnect();R.io=null}
  if(R.v){R.v.pause();R.v.removeAttribute('src');try{R.v.load()}catch(_){}R.v=null}
  const el=$('#rl');if(el)el.remove();
}
// R.gen: дахин ачаалах бүрд нэмэгдэнэ — өмнөх ачаалалтын хоцорсон хариу шинэ жагсаалтад орохгүй
async function reelReload(startId){
  const g=R.gen=(R.gen||0)+1;
  Object.assign(R,{list:[],last:null,done:false,cur:-1,busy:false});
  if(R.io)R.io.disconnect();if(R.v){R.v.pause();R.v.remove()}
  const b=$('#rls');if(b){b.scrollTop=0;b.innerHTML=`<div class="rlempty">${loader()}</div>`}
  if(startId)try{const sn=await FS.getDoc(FS.doc(db,'reels',startId)),r=sn.exists()?mapReel(sn):null;if(!R.on||R.gen!==g)return;
    if(r&&r.n>0&&!hid(r.uid)){R.list.push(r);reelAppend(0)}else toast('Reel олдсонгүй (устгагдсан байж магадгүй)',3000)}catch(e){console.warn('reel open',e)}
  if(R.gen===g)reelMore();
}
async function reelMore(){
  if(R.busy||R.done||!R.on)return;R.busy=true;
  const {collection,query,orderBy,limit,startAfter,getDocs}=FS,N=8,g=R.gen;let again=false;
  try{
    const q=R.last?query(collection(db,'reels'),orderBy('createdAt','desc'),startAfter(R.last),limit(N)):query(collection(db,'reels'),orderBy('createdAt','desc'),limit(N));
    const sn=await getDocs(q);if(!R.on||R.gen!==g)return;
    if(sn.docs.length<N)R.done=true;if(sn.docs.length)R.last=sn.docs[sn.docs.length-1];
    const add=sn.docs.map(mapReel).filter(r=>r.n>0&&!hid(r.uid)&&!R.list.some(x=>x.id===r.id)),at=R.list.length;
    R.list.push(...add);reelAppend(at);
    again=!R.done&&R.list.length-R.cur<3;                          // бүгд шүүгдсэн бол дараагийн хэсгийг авна
  }catch(e){if(R.gen!==g)return;onErr(e);const b=$('#rls');if(b&&!R.list.length)b.innerHTML='<div class="rlempty">Reels-ийг уншиж чадсангүй. Интернэтээ шалгана уу.</div>'}
  finally{if(R.gen===g)R.busy=false}
  if(again)reelMore();
}
function reelSide(r,i){const lk=r.likes.includes(S.me.uid);
  return `<button data-a="rllike" data-i="${i}" class="${lk?'on':''}" aria-label="Лайк" aria-pressed="${lk}">${ic('heart',32,lk)}<span>${r.likes.length||''}</span></button><button data-a="rlcm" data-i="${i}" aria-label="Сэтгэгдэл">${ic('chat',30)}<span>${r.cc||''}</span></button><button data-a="rlbm" data-i="${i}" class="${S.bm.has(r.id)?'on':''}" aria-label="Хадгалах">${ic('bookmark',28,S.bm.has(r.id))}</button><button data-a="rlshare" data-i="${i}" aria-label="Хуваалцах">${ic('share',28)}</button><button data-a="rlmenu" data-i="${i}" aria-label="Цэс">${ic('more',28)}</button>`}
function reelHTML(r,i){
  const nm=(U.get(r.uid)||{}).name||r.name;
  return `<section class="rli rlld" data-i="${i}">${r.poster?`<img class="rlp" src="${r.poster}" alt="">`:''}<div class="rlt" data-a="rltap" data-i="${i}"></div><div class="rlside">${reelSide(r,i)}</div><div class="rlcap"><div class="rlu" data-a="rluser" data-id="${esc(r.uid)}" data-n="${esc(nm)}" role="button">${av(r.uid,nm,34)}<span>${esc(nm)}</span><span class="mute">${ago(r.t)}</span><span class="mute rlvc">${ic('eye',14)}${fmtN(r.vc)}</span></div>${r.cap?`<p>${hashLink(esc(r.cap))}</p>`:''}</div><div class="rlpg"><i></i></div></section>`;
}
function reelAppend(at){
  const box=$('#rls');if(!box||!R.io)return;
  if(!R.list.length){if(R.done)box.innerHTML=`<div class="rlempty"><div>Одоохондоо reel алга.<br><button class="btn" data-a="rladd">${ic('plus',18)} Анхны reel-ээ нэмэх</button></div></div>`;return}
  if(at===0)box.innerHTML='';
  box.insertAdjacentHTML('beforeend',R.list.slice(at).map((r,k)=>reelHTML(r,at+k)).join(''));
  box.querySelectorAll('.rli').forEach(s=>{if(+s.dataset.i>=at)R.io.observe(s)});
}
function reelRedraw(){const box=$('#rls');if(!box||!R.io)return;if(!R.list.length){reelReload();return}R.io.disconnect();R.cur=-1;if(R.v){R.v.pause();R.v.remove()}reelAppend(0)}
function reelSideUpd(i){const s=rlSlide(i),r=R.list[i],e=s&&s.querySelector('.rlside');if(e&&r)e.innerHTML=reelSide(r,i)}
// видеоны хэсгүүдийг татаж нэг blob болгоно (сүүлийн хэдийг санана)
function reelSrc(r){
  if(R.cache.has(r.id))return R.cache.get(r.id);
  const p=(async()=>{
    const sn=await FS.getDocs(FS.collection(db,'reels',r.id,'c'));
    const parts=sn.docs.filter(d=>/^\d+$/.test(d.id)&&+d.id<r.n&&d.data().u===r.uid).sort((a,b)=>a.id-b.id).map(d=>d.data().d.toUint8Array());
    if(parts.length!==r.n)throw new Error('incomplete');
    return URL.createObjectURL(new Blob(parts,{type:r.mime}));
  })();
  p.catch(()=>R.cache.delete(r.id));R.cache.set(r.id,p);
  if(R.cache.size>6){const [k,old]=R.cache.entries().next().value;R.cache.delete(k);old.then(u=>setTimeout(()=>URL.revokeObjectURL(u),1000),()=>{})}
  return p;
}
async function reelActivate(i){
  if(!R.on||R.cur===i)return;const r=R.list[i],sl=rlSlide(i),v=R.v;if(!r||!sl||!v)return;
  R.cur=i;v.pause();v.classList.remove('on');
  const old=v.parentElement;if(old&&old!==sl){old.classList.remove('paused');const b=old.querySelector('.rlpg i');if(b)b.style.width='0'}
  sl.insertBefore(v,sl.querySelector('.rlt'));sl.classList.remove('err','paused');sl.classList.add('rlld');
  if(i>=R.list.length-3)reelMore();
  let url;try{url=await reelSrc(r)}catch(e){console.warn('reel',e);if(R.cur===i){sl.classList.remove('rlld');sl.classList.add('err')}return}
  if(!R.on||R.cur!==i)return;
  if(v.src!==url)v.src=url;else v.currentTime=0;
  v.muted=R.mute;reelPlay();
  clearTimeout(R.vT);R.vT=setTimeout(()=>{if(R.on&&R.cur===i)reelView(r,i)},2000);
  const nx=R.list[i+1];if(nx)reelSrc(nx).catch(()=>{});
}
// дуутай автоматаар тоглуулахыг хөтөч хориглосон бол дуугүй тоглуулна (дууны товчоор асаана)
// 2 секунд үзсэн бол үзсэн тоог +1 (өөрийн reel-ийг тоолохгүй, нэг сессэд нэг удаа)
function reelView(r,i){
  if(r.uid===S.me.uid||R.seen.has(r.id))return;R.seen.add(r.id);r.vc=(r.vc||0)+1;
  const e=rlSlide(i)&&rlSlide(i).querySelector('.rlvc');if(e)e.innerHTML=ic('eye',14)+fmtN(r.vc);
  FS.updateDoc(FS.doc(db,'reels',r.id),{vc:FS.increment(1)}).catch(e=>console.warn('reel view',e&&e.code));
}
function reelPlay(){const v=R.v;if(!v||!v.src)return;const p=v.play();
  if(p&&p.catch)p.catch(e=>{if(e&&e.name==='NotAllowedError'&&!v.muted){R.mute=true;R.autoMuted=true;v.muted=true;rlMuteUpd();v.play().catch(()=>{})}})}
function reelPause(){if(R.v&&!R.v.paused){R.v.pause();const s=R.v.parentElement;if(s)s.classList.add('paused')}}
let rlTapT=0,rlTapAt=0;
function reelTap(i){
  if(R.autoMuted){reelUnmute();return}
  const now=Date.now();clearTimeout(rlTapT);
  if(now-rlTapAt<300){rlTapAt=0;reelHeart(i).catch(e=>{console.error(e);toast('Лайк дарж чадсангүй')});return}
  rlTapAt=now;
  rlTapT=setTimeout(()=>{const v=R.v,sl=rlSlide(i);if(!v||R.cur!==i||!v.src||!sl)return;
    if(v.paused){sl.classList.remove('paused');reelPlay()}else{v.pause();sl.classList.add('paused')}},300);  // давхар товшилтын хугацаатай ижил
}
async function reelHeart(i){const sl=rlSlide(i),r=R.list[i];if(!sl||!r)return;
  const h=document.createElement('div');h.className='rlhp';h.textContent='❤️';sl.appendChild(h);setTimeout(()=>h.remove(),900);
  try{navigator.vibrate&&navigator.vibrate(12)}catch(_){}
  if(!r.likes.includes(S.me.uid))await reelLike(i);
}
async function reelLike(i){const r=R.list[i];if(!r)return;const me=S.me.uid,on=!r.likes.includes(me);
  r.likes=on?[...r.likes,me]:r.likes.filter(u=>u!==me);reelSideUpd(i);
  try{await FS.updateDoc(FS.doc(db,'reels',r.id),{likes:on?FS.arrayUnion(me):FS.arrayRemove(me)});if(on&&r.uid!==me)pushPing({kind:'like',k:'r',id:r.id})}
  catch(e){r.likes=on?r.likes.filter(u=>u!==me):[...r.likes,me];reelSideUpd(i);throw e}
}
function reelComments(i){
  const r=R.list[i];if(!r)return;
  openSheet(`<h3>💬 Сэтгэгдэл</h3><div id="rlcms" style="display:flex;flex-direction:column;gap:8px">${loader(true)}</div><form class="cmf" data-f="rcomment" data-id="${esc(r.id)}"><input placeholder="Сэтгэгдэл бичих" aria-label="Сэтгэгдэл бичих" autocomplete="off" maxlength="500"><button class="btn sm" type="submit">Илгээх</button></form>`);
  return reelCmLoad(r);
}
async function reelCmLoad(r){
  const {collection,query,orderBy,limit,getDocs}=FS;let h;
  try{const sn=await getDocs(query(collection(db,'reels',r.id,'comments'),orderBy('createdAt','asc'),limit(100)));
    const cs=sn.docs.map(d=>{const x=d.data();return {id:d.id,uid:x.uid,name:x.name||'',text:x.text||''}}).filter(c=>!hid(c.uid));
    h=cs.length?cs.map(c=>`<div class="cm">${av(c.uid,c.name,30)}<div class="bb"><b>${esc(c.name)}</b>${hashLink(esc(c.text))}</div>${c.uid===S.me.uid||r.uid===S.me.uid||S.admin?`<button class="cmx" data-a="cmdel" data-k="r" data-p="${esc(r.id)}" data-id="${esc(c.id)}" aria-label="Сэтгэгдэл устгах">${ic('trash',15)}</button>`:''}</div>`).join(''):'<p class="mute" style="margin:0">Одоохондоо сэтгэгдэл алга. Анхных нь болоорой!</p>'}
  catch(e){console.warn('reel comments',e);h='<p class="mute" style="margin:0">Сэтгэгдлийг уншиж чадсангүй.</p>'}
  const e=$('#rlcms');if(e)e.innerHTML=h;
}
async function reelDelete(r){
  const {collection,getDocs,writeBatch,doc,deleteDoc}=FS;
  const refs=[...(await getDocs(collection(db,'reels',r.id,'comments'))).docs.map(d=>d.ref),...Array.from({length:r.n},(_,i)=>doc(db,'reels',r.id,'c',String(i)))];
  for(let i=0;i<refs.length;i+=400){const bt=writeBatch(db);refs.slice(i,i+400).forEach(x=>bt.delete(x));await bt.commit()}
  await deleteDoc(doc(db,'reels',r.id));
  const c=R.cache.get(r.id);if(c){R.cache.delete(r.id);c.then(u=>setTimeout(()=>URL.revokeObjectURL(u),1000),()=>{})}
}
/* --- reel нэмэх --- */
function reelAddSheet(){
  reelPause();reelDraftClear();
  openSheet(`<h3>🎬 Reel нэмэх</h3><div id="rprev"></div><label class="chip" style="align-self:flex-start">${ic('video',18)}Видео сонгох<input type="file" id="rfile" accept="video/*" class="vh"></label><span class="mute" style="font-size:12px">Хамгийн ихдээ ${RL_MAX} секунд. Урт бол эхний ${RL_MAX} секунд нь орно.</span><label>Тайлбар<textarea id="rcap" maxlength="300" placeholder="Юу хуваалцах вэ? (#таг)"></textarea></label><div id="rlst" class="mute" style="font-size:13px;display:flex;flex-direction:column;gap:6px"></div><button class="btn" data-a="rpub">Нийтлэх</button>`);
}
function reelDraftClear(){const d=R.draft;if(!d||R.up)return;R.draft=null;for(const v of [d.v,d.v2])try{if(v){v.pause();v.removeAttribute('src');v.remove()}}catch(_){}URL.revokeObjectURL(d.url)}
// сонгосон видеог уншиж: хугацаа, хэмжээ, нүүр зураг (poster)
async function reelLoad(file){
  if(!/^video\//.test(file.type)&&!/\.(mp4|mov|m4v|webm)$/i.test(file.name))throw new Error('type');
  const url=URL.createObjectURL(file),v=document.createElement('video');
  v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='auto';v.src=url;
  try{
    await new Promise((ok,no)=>{const t=setTimeout(()=>no(new Error('timeout')),20000);v.onloadedmetadata=()=>{clearTimeout(t);ok()};v.onerror=()=>{clearTimeout(t);no(new Error('decode'))}});
    if(!v.videoWidth||!v.videoHeight)throw new Error('novideo');
    const dur=isFinite(v.duration)&&v.duration>0?v.duration:RL_MAX+1;
    await new Promise(ok=>{const t=setTimeout(ok,4000);v.onseeked=()=>{clearTimeout(t);ok()};v.currentTime=Math.min(.3,dur/2)});v.onseeked=null;
    const k=Math.min(1,480/Math.max(v.videoWidth,v.videoHeight)),cv=document.createElement('canvas');cv.width=Math.round(v.videoWidth*k);cv.height=Math.round(v.videoHeight*k);
    const x=cv.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,cv.width,cv.height);
    let poster='';try{x.drawImage(v,0,0,cv.width,cv.height);for(const q of [.72,.6,.48,.36]){poster=cv.toDataURL('image/jpeg',q);if(poster.length<55000)break}}catch(_){}
    if(poster.length>=60000)poster='';
    // жижиг mp4/webm-г шууд байршуулна, бусдыг (том, .mov г.м) шахна
    // iPhone-ийн .mov зэрэг жижиг видеог шахахгүйгээр (дуу, чанартай нь) шууд байршуулна
    const raw=file.size<=RL_RAW&&dur<=RL_MAX+.5;
    return {file,url,v,dur,w:v.videoWidth,h:v.videoHeight,poster,raw};
  }catch(e){URL.revokeObjectURL(url);throw e}
}
async function reelFreshVideo(d){
  const v=d.v2=document.createElement('video');v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.preload='auto';v.src=d.url;
  const p=$('#rprev');if(p){d.v.remove();p.appendChild(v)}                      // iOS нь DOM-оос гадуурх видеог тоглуулахгүй байж болно
  await new Promise((ok,no)=>{const t=setTimeout(()=>no(Object.assign(new Error('stall'),{code:'stall'})),15000);v.onloadedmetadata=()=>{clearTimeout(t);ok()};v.onerror=()=>{clearTimeout(t);no(new Error('decode'))}});
  return v;
}
// видеог canvas + MediaRecorder-оор ~1Mbps, 540p болгож шахна.
// Дууг видеоны элементээс биш, файлаас нь задалж (decodeAudioData) AudioBuffer-ээр нэмнэ: iOS Safari дээр
// видеоны дууг AudioContext руу чиглүүлбэл тоглуулалт гацдаг эсвэл дуу нь чимээгүй бичигддэг.
// Видео өөрөө үргэлж дуугүй тоглоно (зөвшөөрөл хэрэггүй). ac: товшилтын дотор үүсгэсэн AudioContext (iOS-д заавал), null бол дуугүй.
const RL_ADEC=250e6;                                                    // үүнээс том файлын дууг (санах ой хэтрэхээс сэргийлж) задлахгүй
async function reelEncode(d,onp,v0,ac){
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  const mime=window.MediaRecorder&&MediaRecorder.isTypeSupported&&types.find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime||!HTMLCanvasElement.prototype.captureStream)throw Object.assign(new Error('norec'),{code:'norec'});
  let abuf=null;
  if(ac&&d.file.size<=RL_ADEC)try{abuf=await ac.decodeAudioData(await d.file.arrayBuffer())}catch(e){console.warn('reel audio decode',e)} // дуугүй видео бол энд алдаа гарна
  const v=v0||d.v,k=Math.min(1,540/Math.min(d.w,d.h),960/Math.max(d.w,d.h)),w=Math.max(2,Math.round(d.w*k/2)*2),h=Math.max(2,Math.round(d.h*k/2)*2);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,w,h);
  const st=cv.captureStream(30);let src=null;
  if(abuf)try{if(ac.state!=='running')await ac.resume();const dst=ac.createMediaStreamDestination();src=ac.createBufferSource();src.buffer=abuf;src.connect(dst);dst.stream.getAudioTracks().forEach(t=>st.addTrack(t))}
  catch(e){console.warn('reel audio',e);src=null}
  const type=mime.split(';')[0],mr=new MediaRecorder(st,{mimeType:mime,videoBitsPerSecond:1e6,audioBitsPerSecond:96e3}),parts=[];
  mr.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};
  const lim=Math.min(d.dur,RL_MAX);
  v.loop=false;v.muted=true;v.pause();v.currentTime=0;
  mr.start(1000);
  return new Promise((ok,no)=>{
    let fin=false,lastT=-1,stall=Date.now(),aOn=false;
    const end=err=>{if(fin)return;fin=true;clearInterval(iv);v.pause();const at=v.currentTime;try{if(src&&aOn)src.stop()}catch(_){}
      mr.onstop=()=>{st.getTracks().forEach(t=>t.stop());
        if(err)return no(err);const blob=new Blob(parts,{type});
        blob.size?ok({blob,mime:type,dur:Math.min(lim,at||lim),audio:!!src}):no(new Error('empty'))};
      try{mr.stop()}catch(e){no(e)}};
    const draw=()=>{if(fin)return;try{x.drawImage(v,0,0,w,h)}catch(_){}onp(Math.min(1,v.currentTime/lim));
      if(v.currentTime>=lim-.05)return end();
      v.requestVideoFrameCallback?v.requestVideoFrameCallback(draw):requestAnimationFrame(draw)};
    v.onended=()=>end();
    const iv=setInterval(()=>{if(v.currentTime!==lastT){lastT=v.currentTime;stall=Date.now()}else if(Date.now()-stall>10000)end(Object.assign(new Error('stall'),{code:'stall'}))},1000);
    // видео тоглож эхэлсэн мөчөөс дууг тэр байрлалаас нь эхлүүлнэ (синк)
    v.play().then(()=>{if(src&&!fin){try{src.start(0,Math.min(v.currentTime,abuf.duration));aOn=true}catch(e){console.warn('reel audio start',e)}}draw()},e=>end(e||new Error('play')));
  });
}
async function reelUpload(d,enc,cap,onp){
  const {doc,collection,setDoc,deleteDoc,serverTimestamp,Bytes}=FS,uid=S.me.uid,ref=doc(collection(db,'reels'));
  const u8=new Uint8Array(await enc.blob.arrayBuffer()),n=Math.ceil(u8.length/RL_CH);
  if(n>RL_MAXCH)throw Object.assign(new Error('big'),{code:'big'});
  try{
    for(let i=0;i<n;i++){await setDoc(doc(db,'reels',ref.id,'c',String(i)),{u:uid,d:Bytes.fromUint8Array(u8.subarray(i*RL_CH,(i+1)*RL_CH))});onp((i+1)/(n+1))}
    const rd={uid,name:S.me.name,cap,n,mime:enc.mime.slice(0,80),dur:Math.max(.1,Math.round(Math.min(enc.dur,RL_MAX)*10)/10),w:d.w,h:d.h,likes:[],cc:0,kw:kwOf(cap,S.me.name),createdAt:serverTimestamp()};const mn=mnOf(cap);if(mn.length)rd.mn=mn;
    if(d.poster)rd.poster=d.poster;
    await setDoc(ref,rd);onp(1);if(rd.mn)pushPing({kind:'mention',k:'r',id:ref.id,to:rd.mn});
  }catch(e){for(let i=0;i<n;i++)deleteDoc(doc(db,'reels',ref.id,'c',String(i))).catch(()=>{});throw e}
}
async function reelPublish(btn){
  const d=R.draft;if(!d){toast('Эхлээд видео сонгоно уу');return}
  if(R.up)return;R.up=true;btn.disabled=true;
  const cap=(($('#rcap')||{}).value||'').trim().slice(0,300);
  const bar=(l,p)=>{const e=$('#rlst');if(e)e.innerHTML=`<span>${l} ${Math.round(p*100)}% · Дуустал энэ цонхыг хаахгүй байна уу</span><div class="rlprog"><i style="width:${Math.round(p*100)}%"></i></div>`};
  let ok=false,stage=d.raw?'байршуулах':'шахах',ac=null;
  // AudioContext-ийг товшилтын дотор (await-аас өмнө) үүсгэнэ — iOS үүнээс хойш үүсгэсэн context-ийг дуугүй барьдаг
  if(!d.raw)try{const AC=window.AudioContext||window.webkitAudioContext;ac=new AC();ac.resume().catch(()=>{})}catch(e){console.warn('reel audio ctx',e);ac=null}
  try{
    let enc;
    if(d.raw)enc={blob:d.file,mime:d.file.type||'video/mp4',dur:d.dur};
    else{
      try{enc=await reelEncode(d,p=>bar('Видеог шахаж байна…',p),null,ac)}
      catch(e){if(!e||e.code==='norec')throw e;console.warn('reel encode, retry',e);
        // тоглуулалт гацвал шинэ video элементээр нэг удаа дахин оролдоно
        const lbl='Дахин шахаж байна…';bar(lbl,0);
        enc=await reelEncode(d,p=>bar(lbl,p),await reelFreshVideo(d),ac)}
      if(!enc.audio)toast('Энэ видеоны дууг уншиж чадсангүй тул дуугүй нийтлэгдэнэ',3500);
    }
    if(enc.blob.size>RL_CH*RL_MAXCH)throw Object.assign(new Error('big'),{code:'big'});
    stage='байршуулах';
    await reelUpload(d,enc,cap,p=>bar('Байршуулж байна…',p));
    ok=true;toast('Reel нийтлэгдлээ 🎬');
  }catch(e){console.error('reel publish',e);const c=e&&e.code;
    toast(c==='norec'?'Энэ төхөөрөмж видео шахахыг дэмжихгүй байна. 8MB-аас бага, 60 секундээс богино mp4 видео сонгоно уу.':c==='big'?'Видео хэт том байна. Илүү богино видео сонгоно уу.':c==='permission-denied'?'Эрх хүрэхгүй байна. Firestore-ийн дүрмээ (rules) шинэчилнэ үү.':'Reel нийтэлж чадсангүй ('+stage+': '+String(c||(e&&(e.name!=='Error'&&e.name||e.message))||'алдаа').slice(0,60)+'). Дахин оролдоно уу.',8000);
    const e2=$('#rlst');if(e2)e2.textContent=d.raw?'':'Видеог дахин сонгоно уу.';}
  finally{R.up=false;btn.disabled=false;if(ac)ac.close().catch(()=>{})}
  // шахсан видеоны элемент дахин ашиглагдахгүй тул ноорогийг цэвэрлэнэ
  if(ok||!d.raw){reelDraftClear();const p=$('#rprev');if(p)p.innerHTML=''}
  if(ok){if($('#rprev'))closeOv();if(R.on)reelReload()}
}
