(() => {
  "use strict";

  const access = {
    config: null,
    token: localStorage.getItem("vocabBlasterAccessToken") || "",
    pendingId: localStorage.getItem("vocabBlasterPendingPayment") || "",
    pollTimer: null
  };

  function moneyVND(n) {
    return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "₫";
  }

  async function api(url, options={}) {
    const res = await fetch(url, {
      ...options,
      headers: {"Content-Type":"application/json", ...(options.headers||{})}
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || "API error");
    return data;
  }

  async function loadAccessConfig() {
    try {
      access.config = await api("/api/config");
      document.getElementById("payPrice").textContent = moneyVND(access.config.priceVnd);
      document.getElementById("payBank").textContent = access.config.bankName || "Chưa cấu hình";
      document.getElementById("payAccount").textContent = access.config.bankAccount || "Chưa cấu hình";
      document.getElementById("payAccountName").textContent = access.config.bankAccountName || "Chưa cấu hình";
      return access.config;
    } catch (e) {
      console.warn("Không tải được access config:", e);
      return null;
    }
  }

  async function hasValidAccess() {
    if (!access.config) await loadAccessConfig();
    if (access.config && access.config.freePlay) return true;
    if (!access.token) return false;
    try {
      const r = await api("/api/access/verify?token=" + encodeURIComponent(access.token));
      return !!r.valid;
    } catch (_) {
      localStorage.removeItem("vocabBlasterAccessToken");
      access.token = "";
      return false;
    }
  }

  async function requireAccess() {
    const ok = await hasValidAccess();
    if (ok) return true;
    showPaymentGate();
    return false;
  }

  function showPaymentGate() {
    document.getElementById("paymentGate").classList.remove("hidden");
    if (game.running) pause(true);
    if (access.pendingId) {
      showPendingPayment(access.pendingId);
      startPaymentPolling(access.pendingId);
    }
  }

  function closePaymentGate() {
    document.getElementById("paymentGate").classList.add("hidden");
  }

  function showPendingPayment(id) {
    document.getElementById("payCreateBox").classList.add("hidden");
    document.getElementById("payInfoBox").classList.remove("hidden");
    if (access.config) {
      document.getElementById("payAmount").textContent = moneyVND(access.config.priceVnd);
    }
  }

  async function createPayment() {
    try {
      const p = await api("/api/payment/create", {method:"POST", body:"{}"});
      access.pendingId = p.id;
      localStorage.setItem("vocabBlasterPendingPayment", p.id);
      document.getElementById("payBank").textContent = p.bankName || "-";
      document.getElementById("payAccount").textContent = p.bankAccount || "-";
      document.getElementById("payAccountName").textContent = p.bankAccountName || "-";
      document.getElementById("payAmount").textContent = moneyVND(p.amount);
      document.getElementById("payNote").textContent = p.note;
      showPendingPayment(p.id);
      startPaymentPolling(p.id);
    } catch (e) {
      toast("❌ " + e.message);
    }
  }

  function startPaymentPolling(id) {
    clearInterval(access.pollTimer);
    checkPayment(id);
    access.pollTimer = setInterval(()=>checkPayment(id), 2000);
  }

  async function checkPayment(id) {
    try {
      const p = await api("/api/payment/status?id=" + encodeURIComponent(id));
      if (p.note) document.getElementById("payNote").textContent = p.note;
      if (p.status === "paid" && p.token) {
        clearInterval(access.pollTimer);
        access.token = p.token;
        localStorage.setItem("vocabBlasterAccessToken", p.token);
        localStorage.removeItem("vocabBlasterPendingPayment");
        access.pendingId = "";
        closePaymentGate();
        toast("✅ Thanh toán đã xác nhận — chơi thôi!");
        if (game.running) pause(false);
      }
    } catch (_) {}
  }

  const $=id=>document.getElementById(id),canvas=$("gameCanvas"),ctx=canvas.getContext("2d");
  const ui={score:$("score"),combo:$("combo"),level:$("level"),lives:$("lives"),typingWord:$("typingWord"),typingMeaning:$("typingMeaning"),typingBar:$("typingBar"),toast:$("toast"),panel:$("wordPanel"),wordInput:$("wordInput"),wordCount:$("wordCount"),separatorInput:$("separatorInput"),studyDirection:$("studyDirection"),formatPattern:$("formatPattern"),formatExamples:$("formatExamples"),maxEnemies:$("maxEnemies"),difficulty:$("difficulty"),speak:$("speakEnglish"),gameOver:$("gameOver"),pauseScreen:$("pauseScreen"),finalScore:$("finalScore"),finalKills:$("finalKills"),finalAccuracy:$("finalAccuracy"),finalCombo:$("finalCombo")};
  const SAMPLE=`abandon|từ bỏ\nability|khả năng\nabroad|ở nước ngoài\nabsolute|tuyệt đối\nacademic|thuộc học thuật\naccept|chấp nhận\naccident|tai nạn\nachieve|đạt được\nactive|năng động\nadventure|cuộc phiêu lưu\nadvice|lời khuyên\nafford|có đủ khả năng chi trả\nagree|đồng ý\nallow|cho phép\namazing|đáng kinh ngạc\nancient|cổ xưa\nannounce|thông báo\nanxious|lo lắng\napologize|xin lỗi\nappear|xuất hiện\napply|áp dụng, nộp đơn\narrive|đến nơi\nattention|sự chú ý\navoid|tránh\nbehavior|hành vi\nbelieve|tin tưởng\nbrave|dũng cảm\nbreathe|hít thở\ncareful|cẩn thận\nchallenge|thử thách\nchoose|lựa chọn\ncomfortable|thoải mái\ncompare|so sánh\ncomplete|hoàn thành\nconfident|tự tin\ncongratulations|chúc mừng\ncontinue|tiếp tục\ndangerous|nguy hiểm\ndecide|quyết định\ndevelop|phát triển\ndifferent|khác nhau\ndiscover|khám phá\neducation|giáo dục\nencourage|khuyến khích\nenvironment|môi trường\nexample|ví dụ\nexercise|bài tập, tập thể dục\nexperience|kinh nghiệm\nexplain|giải thích\nfamous|nổi tiếng\nfuture|tương lai\nimprove|cải thiện\nimportant|quan trọng\nknowledge|kiến thức\nopportunity|cơ hội\npractice|luyện tập\nremember|ghi nhớ\nsuccess|thành công\nsupport|hỗ trợ\ntake off|cất cánh\nunderstand|hiểu\nvictory|chiến thắng`;
  const SKINS=["🐔","🐥","🦆","🐷","🐸","🐵","🐼","🐱","👻","👽","🤖","🐙","🦀","🐡","🦄","🐧","🦖","🦕","🐲","🦊","🐰","🐝","🦋","🦇"];
  const DIFF={easy:{speed:25,spawn:1900,lives:5},normal:{speed:38,spawn:1450,lives:3},hard:{speed:55,spawn:1050,lives:3}};
  const game={running:false,paused:false,score:0,combo:0,maxCombo:0,level:1,lives:3,kills:0,correctKeys:0,wrongKeys:0,enemies:[],bullets:[],particles:[],floaters:[],stars:[],clouds:[],vocabulary:[],usedBag:[],lockedId:null,typed:"",spawnTimer:0,lastTime:0,nextEnemyId:1,sound:true,muzzle:0};
  const norm=s=>String(s||"").normalize("NFC").toLowerCase().trim().replace(/\s+/g," ");
  function rawSeparator(){return ui.separatorInput ? ui.separatorInput.value : "|"}
  function separatorValue(raw){return raw==="\\t"?"\t":raw}
  function activeSeparator(){return separatorValue(rawSeparator())}
  function visibleSeparatorFrom(sep){return sep==="\t"?"<TAB>":sep}
  function visibleSeparator(){return visibleSeparatorFrom(activeSeparator())}

  function direction(){return ui.studyDirection?.value==="vi-en"?"vi-en":"en-vi"}

  function detectCommonSeparator(text){
    const lines=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return "";

    const chosen=activeSeparator();
    if(chosen && lines.some(line=>line.includes(chosen)))return chosen;

    const candidates=["|","\t","=>","<->","###",";","="];
    let best="",bestScore=0;

    for(const sep of candidates){
      const score=lines.reduce((n,line)=>n+(line.indexOf(sep)>0?1:0),0);
      if(score>bestScore){
        best=sep;
        bestScore=score;
      }
    }
    return bestScore>0?best:"";
  }

  function parseVocabulary(text){
    text=String(text||"").trim();
    if(!text)return[];

    // JSON vẫn hỗ trợ en/vi bất kể chiều học.
    if(text[0]==="["||text[0]==="{"){
      try{
        const data=JSON.parse(text);
        const arr=Array.isArray(data)?data:(data.words||[]);
        return arr
          .map(x=>({
            en:String(x.en??x.english??x.word??"").trim(),
            vi:String(x.vi??x.vietnamese??x.meaning??"").trim()
          }))
          .filter(x=>x.en&&x.vi);
      }catch(_){}
    }

    // Nếu dấu người dùng chọn không có trong nội dung,
    // tự nhận diện vài dấu phổ biến để không bị 0 từ hợp lệ oan.
    const sep=detectCommonSeparator(text);
    if(!sep)return[];

    const rows=[];
    for(const raw of text.split(/\r?\n/)){
      const line=raw.trim();
      if(!line||line.startsWith("#"))continue;

      const i=line.indexOf(sep);
      if(i<=0)continue;

      const left=line.slice(0,i).trim().replace(/^["']|["']$/g,"");
      const right=line.slice(i+sep.length).trim().replace(/^["']|["']$/g,"");
      if(!left||!right)continue;

      if(direction()==="en-vi"){
        rows.push({en:left,vi:right});
      }else{
        rows.push({en:right,vi:left});
      }
    }

    const seen=new Set();
    return rows.filter(x=>{
      const key=direction()==="en-vi"?norm(x.en):norm(x.vi);
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  function currentTargetText(item){
    return direction()==="en-vi"?item.en:item.vi;
  }

  function currentMeaningText(item){
    return direction()==="en-vi"?item.vi:item.en;
  }

  function updateFormatPreview(){
    const sep=visibleSeparator()||"(chưa nhập)";
    if(direction()==="en-vi"){
      if(ui.formatPattern)ui.formatPattern.textContent=`english${sep}nghĩa tiếng Việt`;
      if(ui.formatExamples)ui.formatExamples.innerHTML=
        `abandon${esc(sep)}từ bỏ<br>ability${esc(sep)}khả năng<br>take off${esc(sep)}cất cánh`;
    }else{
      if(ui.formatPattern)ui.formatPattern.textContent=`tiếng Việt${sep}english`;
      if(ui.formatExamples)ui.formatExamples.innerHTML=
        `từ bỏ${esc(sep)}abandon<br>khả năng${esc(sep)}ability<br>cất cánh${esc(sep)}take off`;
    }
  }

  function countWords(){
    const text=ui.wordInput.value;
    const detected=detectCommonSeparator(text);

    // Nếu hệ thống tự nhận ra dấu phổ biến khác với ô hiện tại,
    // cập nhật ô dấu ngăn cách để người dùng nhìn thấy luôn.
    if(detected && detected!==activeSeparator()){
      ui.separatorInput.value=detected==="\t"?"\\t":detected;
      updateFormatPreview();
    }

    const n=parseVocabulary(text).length;
    ui.wordCount.textContent=`${n} từ/cụm từ hợp lệ`;
    ui.wordCount.style.color=n?"#72e2ff":"#ff6b7e";
  }

  function saveWords(){localStorage.setItem("vocabBlasterWords",ui.wordInput.value);localStorage.setItem("vocabBlasterSeparator",rawSeparator());localStorage.setItem("vocabBlasterMaxEnemies",ui.maxEnemies.value);localStorage.setItem("vocabBlasterDifficulty",ui.difficulty.value);localStorage.setItem("vocabBlasterStudyDirection",direction());localStorage.setItem("vocabBlasterSpeak",String(ui.speak.checked));toast("💾 Đã lưu bộ từ")}
  function loadSaved(){ui.separatorInput.value=localStorage.getItem("vocabBlasterSeparator")||"|";ui.wordInput.value=localStorage.getItem("vocabBlasterWords")||SAMPLE;ui.maxEnemies.value=localStorage.getItem("vocabBlasterMaxEnemies")||"6";ui.difficulty.value=localStorage.getItem("vocabBlasterDifficulty")||"normal";ui.studyDirection.value=localStorage.getItem("vocabBlasterStudyDirection")||"en-vi";ui.speak.checked=localStorage.getItem("vocabBlasterSpeak")!=="false";updateFormatPreview();countWords()}
  function toast(t){ui.toast.textContent=t;ui.toast.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>ui.toast.classList.remove("show"),1500)}
  function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.max(1,Math.min(2,devicePixelRatio||1));canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);game.w=r.width;game.h=r.height;game.stars=Array.from({length:90},()=>({x:Math.random()*game.w,y:Math.random()*game.h,r:Math.random()*1.8+.3,a:Math.random()*.7+.2,s:Math.random()*8+3}));game.clouds=Array.from({length:6},(_,i)=>({x:Math.random()*game.w,y:60+Math.random()*Math.max(120,game.h*.45),size:45+Math.random()*60,speed:4+Math.random()*7,emoji:i%2?"☁️":"🌫️"}))}
  function randomWord(){if(!game.usedBag.length){game.usedBag=[...game.vocabulary];for(let i=game.usedBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[game.usedBag[i],game.usedBag[j]]=[game.usedBag[j],game.usedBag[i]]}}return game.usedBag.pop()}
  function spawn(){if(!game.running||game.paused)return;const max=+ui.maxEnemies.value;if(game.enemies.filter(e=>!e.dead).length>=max)return;const item=randomWord();if(!item)return;const size=46+Math.random()*16,margin=95,x=margin+Math.random()*Math.max(50,game.w-margin*2),base=DIFF[ui.difficulty.value].speed,speed=base*(1+(game.level-1)*.08)*(.8+Math.random()*.4);game.enemies.push({id:game.nextEnemyId++,en:item.en,vi:item.vi,target:norm(currentTargetText(item)),display:currentTargetText(item),meaning:currentMeaningText(item),skin:SKINS[Math.floor(Math.random()*SKINS.length)],x,y:-50-Math.random()*70,vx:(Math.random()-.5)*24,vy:speed,size,wobble:Math.random()*Math.PI*2,dead:false,hitFlash:0,angle:0})}
  function start(){const vocab=parseVocabulary(ui.wordInput.value);if(vocab.length<3){toast(`⚠️ Cần ít nhất 3 cặp từ dùng ngăn cách: ${visibleSeparator()||"(trống)"}`);return}saveWords();Object.assign(game,{vocabulary:vocab,usedBag:[],enemies:[],bullets:[],particles:[],floaters:[],score:0,combo:0,maxCombo:0,level:1,kills:0,correctKeys:0,wrongKeys:0,lockedId:null,typed:"",spawnTimer:0,nextEnemyId:1,lives:DIFF[ui.difficulty.value].lives,running:true,paused:false});ui.gameOver.classList.add("hidden");ui.pauseScreen.classList.add("hidden");ui.panel.classList.remove("open");hud();typingUI();spawn();spawn();spawn();setTimeout(focusTyping,50)}
  function hud(){ui.score.textContent=game.score.toLocaleString();ui.combo.textContent=game.combo;ui.level.textContent=game.level;ui.lives.textContent=game.lives}
  function normalizeTyped(text){return String(text||"").normalize("NFC").toLowerCase().trim().replace(/\s+/g," ")}
  function typingUI(){
    if(!game.running){
      ui.typingWord.textContent="Chọn bộ từ rồi bắt đầu";
      ui.typingMeaning.textContent="Hạ mục tiêu để hiện nghĩa 🇻🇳";
      return;
    }
    ui.typingWord.textContent=game.typed || "Gõ từ/cụm từ rồi nhấn Enter...";
    ui.typingMeaning.textContent="Enter = bắn từ đang hiện trên màn hình";
  }
  function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
  function findEnemyByTyped(){
    const answer=normalizeTyped(game.typed);
    if(!answer)return null;
    const matches=game.enemies.filter(e=>!e.dead&&normalizeTyped(e.display)===answer).sort((a,b)=>b.y-a.y);
    return matches.length?matches[0]:null;
  }
  function clearTyped(){
    game.typed="";
    if(imeInput)imeInput.value="";
    typingUI();
  }
  function submitTyped(){
    if(!game.running||game.paused)return;
    const answer=normalizeTyped(game.typed);
    if(!answer){clearTyped();focusTyping();return}

    const e=findEnemyByTyped();
    if(e){
      game.correctKeys++;
      shoot(e);
      e.hitFlash=.12;
      kill(e);
      clearTyped();
      ui.typingMeaning.textContent=`✅ ${e.display} = ${e.meaning}`;
      setTimeout(()=>{typingUI();focusTyping()},900);
    }else{
      wrong();
      clearTyped();
      ui.typingMeaning.textContent="❌ Sai / không có từ này trên màn hình";
      setTimeout(()=>{typingUI();focusTyping()},650);
    }
  }
  function typeChar(ch){if(!game.running||game.paused)return;game.typed+=ch;typingUI()}
  function wrong(){game.wrongKeys++;game.combo=0;sfx("wrong");ui.typingBar.classList.remove("shake");void ui.typingBar.offsetWidth;ui.typingBar.classList.add("shake");hud()}
  function shoot(e){game.muzzle=.08;game.bullets.push({x:game.w/2,y:game.h-82,tx:e.x,ty:e.y,life:.16,maxLife:.16});sfx("shot")}
  function kill(e){e.dead=true;game.kills++;game.combo++;game.maxCombo=Math.max(game.maxCombo,game.combo);game.level=1+Math.floor(game.kills/10);const gain=100+e.target.length*12+Math.min(20,game.combo)*8;game.score+=gain;explode(e.x,e.y);game.floaters.push({x:e.x,y:e.y-10,text:`💡 ${e.meaning}`,sub:`+${gain} • ${e.display}`,life:1.8,maxLife:1.8});if(ui.speak.checked&&"speechSynthesis"in window){try{speechSynthesis.cancel();const spoken=direction()==="en-vi"?e.en:e.en;const u=new SpeechSynthesisUtterance(spoken);u.lang="en-US";u.rate=.9;speechSynthesis.speak(u)}catch(_){}}sfx("boom");if(game.lockedId===e.id){game.lockedId=null;game.typed=""}hud()}
  function explode(x,y){for(let i=0;i<24;i++){const a=Math.random()*Math.PI*2,sp=50+Math.random()*150;game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.65+Math.random()*.45,size:2+Math.random()*5,hue:Math.random()<.5?48:330})}game.particles.push({x,y,vx:0,vy:-20,life:.7,size:30,hue:0,emoji:"💥"})}
  function miss(e){e.dead=true;game.lives--;game.combo=0;game.floaters.push({x:e.x,y:game.h-125,text:`😵 ${e.display} = ${e.meaning}`,sub:"Lọt mất rồi!",life:2.2,maxLife:2.2});if(game.lockedId===e.id){game.lockedId=null;game.typed="";typingUI()}sfx("miss");hud();if(game.lives<=0)end()}
  function end(){game.running=false;game.paused=false;const total=game.correctKeys+game.wrongKeys,acc=total?Math.round(game.correctKeys/total*100):100;ui.finalScore.textContent=game.score.toLocaleString();ui.finalKills.textContent=game.kills;ui.finalAccuracy.textContent=`${acc}%`;ui.finalCombo.textContent=game.maxCombo;ui.gameOver.classList.remove("hidden")}
  function pause(force){if(!game.running)return;game.paused=typeof force==="boolean"?force:!game.paused;ui.pauseScreen.classList.toggle("hidden",!game.paused);$("btnPause").textContent=game.paused?"▶️":"⏸️";if(!game.paused)setTimeout(focusTyping,0)}
  function sfx(type){if(!game.sound)return;try{const AC=AudioContext||webkitAudioContext;if(!sfx.ctx)sfx.ctx=new AC();const ac=sfx.ctx,o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);const map={shot:[620,.04,"square"],boom:[120,.12,"sawtooth"],wrong:[170,.10,"square"],miss:[90,.20,"triangle"]},[f,d,w]=map[type]||map.shot;o.type=w;o.frequency.setValueAtTime(f,ac.currentTime);if(type==="boom")o.frequency.exponentialRampToValueAtTime(55,ac.currentTime+d);g.gain.setValueAtTime(.055,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.start();o.stop(ac.currentTime+d)}catch(_){}}
  function update(dt){for(const s of game.stars){s.y+=s.s*dt;if(s.y>game.h){s.y=0;s.x=Math.random()*game.w}}for(const c of game.clouds){c.x+=c.speed*dt;if(c.x>game.w+100)c.x=-120}if(!game.running||game.paused)return;const cfg=DIFF[ui.difficulty.value];game.spawnTimer-=dt*1000;const every=Math.max(520,cfg.spawn-(game.level-1)*55);if(game.spawnTimer<=0){spawn();game.spawnTimer=every*(.8+Math.random()*.4)}for(const e of game.enemies){if(e.dead)continue;e.wobble+=dt*2.3;e.angle=Math.sin(e.wobble)*.09;e.x+=(e.vx+Math.sin(e.wobble)*14)*dt;e.y+=e.vy*dt;if(e.x<55){e.x=55;e.vx=Math.abs(e.vx)}if(e.x>game.w-55){e.x=game.w-55;e.vx=-Math.abs(e.vx)}e.hitFlash=Math.max(0,e.hitFlash-dt);if(e.y>game.h-105)miss(e)}game.enemies=game.enemies.filter(e=>!e.dead||Math.random()>.97);for(const b of game.bullets)b.life-=dt;game.bullets=game.bullets.filter(b=>b.life>0);for(const p of game.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt}game.particles=game.particles.filter(p=>p.life>0);for(const f of game.floaters){f.life-=dt;f.y-=18*dt}game.floaters=game.floaters.filter(f=>f.life>0);game.muzzle=Math.max(0,game.muzzle-dt)}
  function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function background(t){const g=ctx.createLinearGradient(0,0,0,game.h);g.addColorStop(0,"#10173b");g.addColorStop(.48,"#151735");g.addColorStop(1,"#08101f");ctx.fillStyle=g;ctx.fillRect(0,0,game.w,game.h);for(const s of game.stars){ctx.globalAlpha=s.a*(.75+.25*Math.sin(t*.002+s.x));ctx.fillStyle="#d9eeff";ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.font="70px serif";ctx.globalAlpha=.12;for(const c of game.clouds)ctx.fillText(c.emoji,c.x,c.y);ctx.globalAlpha=1;ctx.fillStyle="#111b2c";ctx.beginPath();ctx.moveTo(0,game.h);for(let x=0;x<=game.w;x+=80)ctx.lineTo(x,game.h-105-Math.sin(x*.013)*30-Math.sin(x*.027)*12);ctx.lineTo(game.w,game.h);ctx.closePath();ctx.fill();const lg=ctx.createLinearGradient(0,0,game.w,0);lg.addColorStop(0,"rgba(64,224,255,0)");lg.addColorStop(.5,"rgba(64,224,255,.45)");lg.addColorStop(1,"rgba(64,224,255,0)");ctx.fillStyle=lg;ctx.fillRect(0,game.h-92,game.w,2)}
  function drawEnemy(e){const L=e.id===game.lockedId;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);if(L){ctx.strokeStyle="#58efff";ctx.lineWidth=2;ctx.shadowColor="#58efff";ctx.shadowBlur=18;ctx.beginPath();ctx.arc(0,0,e.size*.68,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}if(e.hitFlash>0){ctx.shadowColor="#fff";ctx.shadowBlur=25}ctx.font=`${e.size}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(e.skin,0,0);ctx.font=`800 ${Math.max(14,Math.min(20,16+e.target.length*.06))}px Segoe UI,Arial`;const tw=ctx.measureText(e.display).width,bw=Math.max(64,tw+26),bh=32;rr(-bw/2,e.size*.5,bw,bh,10,L?"rgba(18,36,60,.95)":"rgba(5,7,18,.88)",L?"#55ecff":"rgba(255,255,255,.14)");ctx.fillStyle=L?"#8ef6ff":"#fff";ctx.fillText(e.en,0,e.size*.5+bh/2+1);if(L&&game.typed.length){const p=game.typed.length/e.target.length;rr(-bw/2,e.size*.5+bh+5,bw,5,3,"rgba(255,255,255,.14)");rr(-bw/2,e.size*.5+bh+5,bw*p,5,3,"#5dff9a")}ctx.restore()}
  function drawBullets(){for(const b of game.bullets){const p=1-b.life/b.maxLife,x=b.x+(b.tx-b.x)*p,y=b.y+(b.ty-b.y)*p;ctx.strokeStyle="rgba(73,225,255,.7)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle="#fff";ctx.shadowColor="#45eaff";ctx.shadowBlur=14;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}}
  function drawParticles(){for(const p of game.particles){ctx.globalAlpha=Math.max(0,p.life/.8);if(p.emoji){ctx.font=`${p.size}px serif`;ctx.fillText(p.emoji,p.x,p.y)}else{ctx.fillStyle=`hsl(${p.hue} 95% 60%)`;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1}
  function drawFloaters(){ctx.textAlign="center";for(const f of game.floaters){ctx.globalAlpha=Math.min(1,f.life*.9);ctx.font="900 23px Segoe UI,Arial";ctx.shadowColor="#000";ctx.shadowBlur=10;ctx.fillStyle="#fff36a";ctx.fillText(f.text,f.x,f.y);ctx.font="700 13px Segoe UI,Arial";ctx.fillStyle="#fff";ctx.fillText(f.sub,f.x,f.y+20);ctx.shadowBlur=0}ctx.globalAlpha=1}
  function cannon(){const x=game.w/2,y=game.h-72;ctx.save();ctx.translate(x,y);if(game.muzzle>0){ctx.font="42px serif";ctx.textAlign="center";ctx.fillText("💥",0,-42)}ctx.font="50px 'Segoe UI Emoji',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("😎",0,0);ctx.font="34px 'Segoe UI Emoji',sans-serif";ctx.fillText("🔫",28,-8);ctx.restore()}
  function draw(t){if(!game.w||!game.h)return;ctx.clearRect(0,0,game.w,game.h);background(t);for(const e of game.enemies)if(!e.dead)drawEnemy(e);drawBullets();drawParticles();drawFloaters();cannon()}
  function loop(t){const dt=Math.min(.033,(t-game.lastTime)/1000||0);game.lastTime=t;update(dt);draw(t);requestAnimationFrame(loop)}
  // Input ẩn chỉ dùng cho chế độ Tiếng Việt để UniKey/IME tự ghép dấu.
  const imeInput=document.createElement("input");
  imeInput.type="text";
  imeInput.autocomplete="off";
  imeInput.spellcheck=false;
  imeInput.setAttribute("aria-hidden","true");
  Object.assign(imeInput.style,{
    position:"fixed",left:"-10000px",top:"-10000px",
    width:"1px",height:"1px",opacity:"0",pointerEvents:"none"
  });
  document.body.appendChild(imeInput);

  function typingMode(){return direction()==="vi-en"?"vi":"en"}

  function focusTyping(){
    if(!game.running||game.paused||ui.panel.classList.contains("open"))return;
    if(typingMode()==="vi"){
      imeInput.value=game.typed;
      imeInput.focus({preventScroll:true});
      try{imeInput.setSelectionRange(imeInput.value.length,imeInput.value.length)}catch(_){}
    }else{
      if(document.activeElement===imeInput)imeInput.blur();
      const active=document.activeElement;
      if(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))active.blur();
    }
  }

  function englishCharFromCode(ev){
    // Dùng event.code (phím vật lý), không dùng event.key.
    // Vì vậy UniKey đang bật vẫn gõ được "injure": i n j u r e.
    if(/^Key[A-Z]$/.test(ev.code))return ev.code.slice(3).toLowerCase();
    if(/^Digit[0-9]$/.test(ev.code))return ev.code.slice(5);
    if(ev.code==="Space")return " ";
    if(ev.code==="Minus")return "-";
    if(ev.code==="Quote")return "'";
    return null;
  }

  imeInput.addEventListener("input",()=>{
    if(typingMode()!=="vi"||!game.running||game.paused)return;
    game.typed=imeInput.value.normalize("NFC");
    typingUI();
  });

  imeInput.addEventListener("compositionend",()=>{
    if(typingMode()!=="vi")return;
    game.typed=imeInput.value.normalize("NFC");
    typingUI();
  });

  imeInput.addEventListener("keydown",ev=>{
    if(typingMode()!=="vi"||!game.running||game.paused)return;
    if(ev.key==="Enter"){
      ev.preventDefault();
      game.typed=imeInput.value.normalize("NFC");
      submitTyped();
    }
  });

  document.addEventListener("keydown",ev=>{
    if(ui.panel.classList.contains("open"))return;

    if(ev.key==="Escape"){
      ev.preventDefault();
      pause();
      if(!game.paused)setTimeout(focusTyping,0);
      return;
    }

    if(!game.running||game.paused)return;

    // Tiếng Việt: để input ẩn + UniKey/IME xử lý chữ.
    if(typingMode()==="vi"){
      if(document.activeElement!==imeInput)setTimeout(focusTyping,0);
      return;
    }

    // English: đọc phím vật lý bằng event.code để không bị UniKey biến đổi.
    if(ev.key==="Enter"){
      ev.preventDefault();
      submitTyped();
      return;
    }

    if(ev.key==="Backspace"){
      ev.preventDefault();
      if(game.typed.length){
        game.typed=game.typed.slice(0,-1);
        typingUI();
      }
      return;
    }

    const ch=englishCharFromCode(ev);
    if(ch!==null){
      ev.preventDefault();
      typeChar(ch);
    }
  });
  $("btnStart").onclick=async()=>{if(await requireAccess())start()};$("btnWords").onclick=()=>{if(game.running)pause(true);ui.panel.classList.add("open")};$("btnCloseWords").onclick=()=>{ui.panel.classList.remove("open");if(game.running)pause(false)};$("btnPause").onclick=()=>pause();$("btnResume").onclick=()=>pause(false);$("btnRestart").onclick=async()=>{if(await requireAccess())start()};$("btnSound").onclick=()=>{game.sound=!game.sound;$("btnSound").textContent=game.sound?"🔊":"🔇"};$("btnSample").onclick=()=>{
    const sep=activeSeparator()||"|";
    ui.wordInput.value=SAMPLE.split("\n").map(line=>{
      const i=line.indexOf("|");
      if(i<0)return line;
      const en=line.slice(0,i),vi=line.slice(i+1);
      return direction()==="en-vi"?`${en}${sep}${vi}`:`${vi}${sep}${en}`;
    }).join("\n");
    countWords();
    toast("🎲 Đã nạp bộ từ mẫu");
  };$("btnSaveWords").onclick=saveWords;ui.studyDirection.addEventListener("change",()=>{game.typed="";imeInput.value="";localStorage.setItem("vocabBlasterStudyDirection",direction());updateFormatPreview();countWords();typingUI();setTimeout(focusTyping,0)});ui.wordInput.addEventListener("input",countWords);ui.separatorInput.addEventListener("input",()=>{updateFormatPreview();countWords()});$("fileInput").addEventListener("change",async ev=>{const f=ev.target.files?.[0];if(!f)return;try{ui.wordInput.value=await f.text();countWords();toast(`📂 Đã đọc ${f.name}`)}catch(_){toast("❌ Không đọc được tệp")}});$("btnAccess").onclick=()=>showPaymentGate();$("btnCreatePayment").onclick=createPayment;$("btnClosePayment").onclick=()=>closePaymentGate();window.addEventListener("resize",resize);loadSaved();loadAccessConfig();resize();typingUI();requestAnimationFrame(loop);
})();
