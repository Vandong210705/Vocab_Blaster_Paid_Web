(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");

  const access = {
    config: null,
    token: localStorage.getItem("vocabBlasterAccessToken") || "",
    pendingId: localStorage.getItem("vocabBlasterPendingPayment") || "",
    pollTimer: null,
    startAfterPayment: false
  };

  const ui = {
    score: $("score"), combo: $("combo"), level: $("level"), lives: $("lives"),
    typingWord: $("typingWord"), typingMeaning: $("typingMeaning"), typingBar: $("typingBar"),
    imeSink: $("imeSink"), toast: $("toast"), panel: $("wordPanel"), wordInput: $("wordInput"),
    wordCount: $("wordCount"), separatorInput: $("separatorInput"), studyDirection: $("studyDirection"),
    formatPattern: $("formatPattern"), formatExamples: $("formatExamples"), maxEnemies: $("maxEnemies"),
    difficulty: $("difficulty"), customSpeedWrap: $("customSpeedWrap"), customSpeed: $("customSpeed"), infiniteLives: $("infiniteLives"),
    speedValue: $("speedValue"), speak: $("speakEnglish"), voicePreset: $("voicePreset"), gameOver: $("gameOver"),
    choiceDock: $("choiceDock"), choice1: $("choice1"), choice2: $("choice2"), choice3: $("choice3"), choice4: $("choice4"),
    pauseScreen: $("pauseScreen"), finalScore: $("finalScore"), finalKills: $("finalKills"),
    finalAccuracy: $("finalAccuracy"), finalCombo: $("finalCombo"), payQr: $("payQr"), payQrEmpty: $("payQrEmpty")
  };

  const SAMPLE = `abandon|từ bỏ\nability|khả năng\nabroad|ở nước ngoài\nabsolute|tuyệt đối\nacademic|thuộc học thuật\naccept|chấp nhận\naccident|tai nạn\nachieve|đạt được\nactive|năng động\nadventure|cuộc phiêu lưu\nadvice|lời khuyên\nafford|có đủ khả năng chi trả\nagree|đồng ý\nallow|cho phép\namazing|đáng kinh ngạc\nancient|cổ xưa\nannounce|thông báo\nanxious|lo lắng\napologize|xin lỗi\nappear|xuất hiện\napply|áp dụng, nộp đơn\narrive|đến nơi\nattention|sự chú ý\navoid|tránh\nbehavior|hành vi\nbelieve|tin tưởng\nbrave|dũng cảm\nbreathe|hít thở\ncareful|cẩn thận\nchallenge|thử thách\nchoose|lựa chọn\ncomfortable|thoải mái\ncompare|so sánh\ncomplete|hoàn thành\nconfident|tự tin\ncongratulations|chúc mừng\ncontinue|tiếp tục\ndangerous|nguy hiểm\ndecide|quyết định\ndevelop|phát triển\ndifferent|khác nhau\ndiscover|khám phá\neducation|giáo dục\nencourage|khuyến khích\nenvironment|môi trường\nexample|ví dụ\nexercise|bài tập, tập thể dục\nexperience|kinh nghiệm\nexplain|giải thích\nfamous|nổi tiếng\nfuture|tương lai\nimprove|cải thiện\nimportant|quan trọng\ninjure|làm bị thương\nknowledge|kiến thức\nopportunity|cơ hội\npractice|luyện tập\nremember|ghi nhớ\nsuccess|thành công\nsupport|hỗ trợ\ntake off|cất cánh\nunderstand|hiểu\nvictory|chiến thắng`;

  const SKINS = ["🐔","🐥","🦆","🐷","🐸","🐵","🐼","🐱","👻","👽","🤖","🐙","🦀","🐡","🦄","🐧","🦖","🦕","🐲","🦊","🐰","🐝","🦋","🦇"];
  const DIFF = {
    easy: {speed: 22, spawn: 1900, lives: 5},
    normal: {speed: 36, spawn: 1450, lives: 3},
    hard: {speed: 55, spawn: 1050, lives: 3}
  };

  // Khoảng cách dọc tối thiểu giữa 2 từ đang rơi.
  // Mục tiêu: không còn cảnh 2 từ dính sát nhau khi rơi xuống.
  const MIN_ENEMY_VERTICAL_GAP = 145;


  // ===== MEMORY BOOST: active recall + spaced repetition =====
  // Thuật toán ghi nhớ chạy ngầm: từ chưa vững sẽ được ưu tiên lặp lại.
  // Bộ đếm và lịch ôn không hiển thị cho người học.
  // theo số lượt: 3 -> 8 -> 20 -> 50, rồi chuyển sang các mốc thời gian dài hơn.
  const MEMORY_STORAGE_KEY = "vocabBlasterMemoryV4";
  const MEMORY_TURN_KEY_PREFIX = "vocabBlasterMemoryTurnV4:";
  const MEMORY_CRAM_CORRECTS = 3;
  // Từ cần củng cố KHÔNG chiếm toàn bộ màn chơi.
  // Chỉ cần 3 lần đúng; giữa các lần sẽ xen 3 -> 7 -> 12 từ khác.
  // Sau khi đủ 3 lần đúng, từ đó lùi xa hơn để nhường chỗ cho nhiều từ mới.
  const MEMORY_CRAM_GAPS = [3, 7, 12];
  const MEMORY_REVIEW_GAPS = [25, 60, 120, 250];
  // Custom mixed interaction theo hướng học.
  // Anh→Việt: chủ yếu chọn nghĩa Việt; lâu lâu hiện Việt để gõ English.
  // Việt→Anh: chủ yếu hiện Việt để gõ English; thỉnh thoảng chọn nghĩa Việt.
  const CUSTOM_CHOICE_CHANCE_EN_VI = 0.78;
  const CUSTOM_CHOICE_CHANCE_VI_EN = 0.28;

  const MEMORY_LONG_INTERVALS = [
    10*60*1000,          // 10 phút
    12*60*60*1000,       // 12 giờ
    24*60*60*1000,       // 1 ngày
    3*24*60*60*1000,     // 3 ngày
    7*24*60*60*1000,     // 7 ngày
    14*24*60*60*1000,    // 14 ngày
    30*24*60*60*1000     // 30 ngày
  ];

  const game = {
    running:false, paused:false, score:0, combo:0, maxCombo:0, level:1, lives:3, kills:0,
    correctKeys:0, wrongKeys:0, enemies:[], bullets:[], particles:[], floaters:[], stars:[], clouds:[],
    vocabulary:[], usedBag:[], typed:"", spawnTimer:0, lastTime:0, nextEnemyId:1, sound:true, muzzle:0,
    memory:{}, memoryTurn:0, focusCramKey:"", recentWordKeys:[], studyMode:"typing",
    choiceTargetId:0,
    w:0, h:0
  };

  function moneyVND(n){ return new Intl.NumberFormat("vi-VN").format(Number(n||0)) + "₫"; }

  const ENCOURAGE_RETRY = [
    "🌱 Cố lên! Mình thử lại một lần nữa nha",
    "✨ Sắp nhớ rồi đó, tiếp tục nhé!",
    "💪 Bạn làm được mà, thử thêm lần nữa!",
    "🌟 Mỗi lần thử là nhớ thêm một chút!",
    "🚀 Tiếp tục nào, đang tiến bộ rất tốt!",
    "🧠 Não đang ghi nhớ rồi, mình làm tiếp nha!",
    "💛 Bình tĩnh nha, từ này sẽ quen rất nhanh!",
    "🎯 Thử lại nhé, lần tới sẽ trúng thôi!",
    "🌈 Giữ nhịp nào, bạn đang học tốt lắm!",
    "🔥 Tiếp tục! Mình chinh phục từ này luôn!"
  ];

  const ENCOURAGE_MISS = [
    "🌱 Mình gặp lại từ này thêm vài lần nha!",
    "✨ Tốt lắm, nhìn lại nghĩa một chút rồi tiếp tục!",
    "💪 Cứ tiếp tục, bạn đang nhớ dần rồi!",
    "🌟 Thêm một lần gặp là thêm một lần nhớ!",
    "🧠 Não đang làm quen với từ này rồi đó!",
    "💛 Cứ nhẹ nhàng tiếp tục nha, bạn làm được!",
    "🚀 Mình học tiếp thôi, từ này sắp quen rồi!",
    "🎯 Ghi nhớ nghĩa này rồi mình gặp lại sau nha!"
  ];

  const ENCOURAGE_CORRECT = [
    "🌟 Tuyệt lắm! Giữ nhịp này nha!",
    "🔥 Quá tốt! Tiếp tục nào!",
    "✨ Chính xác! Não đang nhớ rất nhanh!",
    "💪 Hay lắm! Thêm một từ đã quen hơn!",
    "🚀 Đỉnh! Mình chinh phục tiếp nhé!",
    "🎯 Chuẩn rồi! Cứ thế phát huy!",
    "🌈 Tốt lắm! Bạn đang tiến bộ từng từ!",
    "💛 Tuyệt vời! Tiếp tục giữ phong độ nha!"
  ];

  function randomEncouragement(list){
    return list[Math.floor(Math.random()*list.length)];
  }
  function norm(s){ return String(s||"").normalize("NFC").toLowerCase().trim().replace(/\s+/g," "); }
  function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
  function direction(){
    const v=ui.studyDirection.value;
    return (v==="en-vi"||v==="vi-en") ? v : "typing";
  }
  function typingMode(){
    // Custom mixed không bao giờ yêu cầu gõ tiếng Việt.
    if(ui.difficulty?.value==="custom") return "en";
    return direction()==="en-vi" ? "vi" : "en";
  }

  async function api(url, options={}){
    const res = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || "API error");
    return data;
  }

  function setQr(url){
    if(url){
      ui.payQr.src = url;
      ui.payQr.classList.remove("hidden");
      ui.payQrEmpty.classList.add("hidden");
    }else{
      ui.payQr.removeAttribute("src");
      ui.payQr.classList.add("hidden");
      ui.payQrEmpty.classList.remove("hidden");
    }
  }

  async function loadAccessConfig(){
    try{
      access.config = await api("/api/config");
      $("payPrice").textContent = moneyVND(access.config.priceVnd);$("payAccessSummary").textContent = access.config.accessMode==="minutes"?`Quyền chơi ${access.config.playMinutes} phút`:"Quyền chơi vĩnh viễn";
      $("payBank").textContent = access.config.bankName || "Chưa cấu hình";
      $("payAccount").textContent = access.config.bankAccount || "Chưa cấu hình";
      $("payAccountName").textContent = access.config.bankAccountName || "Chưa cấu hình";
      return access.config;
    }catch(e){ console.warn(e); return null; }
  }

  async function hasValidAccess(){
    await loadAccessConfig();
    if(access.config?.freePlay) return true;
    if(!access.token) return false;
    try{
      const r = await api("/api/access/verify?token="+encodeURIComponent(access.token));
      return !!r.valid;
    }catch(_){
      access.token="";
      localStorage.removeItem("vocabBlasterAccessToken");
      return false;
    }
  }

  async function requireAccess(){
    if(await hasValidAccess()) return true;
    showPaymentGate();
    return false;
  }

  async function showPaymentGate(){
    await loadAccessConfig();
    $("paymentGate").classList.remove("hidden");
    if(game.running) pause(true);
    if(access.pendingId){
      $("payCreateBox").classList.add("hidden");
      $("payInfoBox").classList.remove("hidden");
      startPaymentPolling(access.pendingId);
    }else{
      $("payCreateBox").classList.remove("hidden");
      $("payInfoBox").classList.add("hidden");
      setQr("");
    }
  }

  function closePaymentGate(){ $("paymentGate").classList.add("hidden"); }
  async function showSupportGate(){
    await loadAccessConfig();
    const c=access.config||{};
    $("supportGate").classList.remove("hidden");
    $("supportBank").textContent=c.bankName||"Chưa cấu hình";
    $("supportAccount").textContent=c.bankAccount||"Chưa cấu hình";
    $("supportAccountName").textContent=c.bankAccountName||"Chưa cấu hình";
    $("supportAmount").textContent=moneyVND(c.priceVnd||0);
    if(c.supportQrUrl){
      $("supportQr").src=c.supportQrUrl;
      $("supportQr").classList.remove("hidden");
      $("supportQrEmpty").classList.add("hidden");
    }else{
      $("supportQr").removeAttribute("src");
      $("supportQr").classList.add("hidden");
      $("supportQrEmpty").classList.remove("hidden");
    }
  }

  function closeSupportGate(){
    $("supportGate").classList.add("hidden");
  }


  function applyPaymentInfo(p){
    if(!p) return;
    $("payBank").textContent = p.bankName || access.config?.bankName || "-";
    $("payAccount").textContent = p.bankAccount || access.config?.bankAccount || "-";
    $("payAccountName").textContent = p.bankAccountName || access.config?.bankAccountName || "-";
    $("payAmount").textContent = moneyVND(p.amount ?? access.config?.priceVnd ?? 0);
    $("payDuration").textContent = (p.accessMode||access.config?.accessMode)==="minutes"?`${p.playMinutes||access.config?.playMinutes||0} phút`:"Vĩnh viễn";
    $("payNote").textContent = p.note || "-";
    setQr(p.qrUrl || "");
  }

  async function createPayment(){
    try{
      const p = await api("/api/payment/create",{method:"POST",body:"{}"});
      access.pendingId = p.id;
      localStorage.setItem("vocabBlasterPendingPayment",p.id);
      $("payCreateBox").classList.add("hidden");
      $("payInfoBox").classList.remove("hidden");
      applyPaymentInfo(p);
      startPaymentPolling(p.id);
    }catch(e){ toast("💡 Mình thử lại nhé • "+e.message); }
  }

  function startPaymentPolling(id){
    clearInterval(access.pollTimer);
    checkPayment(id);
    access.pollTimer = setInterval(()=>checkPayment(id),1800);
  }

  async function checkPayment(id){
    try{
      const p = await api("/api/payment/status?id="+encodeURIComponent(id));
      applyPaymentInfo(p);
      if(p.status === "paid" && p.token){
        clearInterval(access.pollTimer);
        access.token = p.token;
        localStorage.setItem("vocabBlasterAccessToken",p.token);
        localStorage.removeItem("vocabBlasterPendingPayment");
        access.pendingId = "";
        closePaymentGate();
        toast("✅ Đã nhận thanh toán — mở game!");
        if(access.startAfterPayment){
          access.startAfterPayment = false;
          start();
        }else if(game.running){
          pause(false);
        }
      }
    }catch(_){ }
  }

  function rawSeparator(){ return ui.separatorInput.value; }
  function activeSeparator(){ return rawSeparator()==="\\t" ? "\t" : rawSeparator(); }
  function visibleSeparator(){ return activeSeparator()==="\t" ? "<TAB>" : activeSeparator(); }

  function detectSeparator(text){
    const lines = String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length) return "";
    const chosen = activeSeparator();
    if(chosen && lines.some(line=>line.indexOf(chosen)>0)) return chosen;
    const candidates = [":","|","\t","=>","<->","###",";","="];
    let best="", score=0;
    for(const sep of candidates){
      const n = lines.reduce((a,line)=>a+(line.indexOf(sep)>0?1:0),0);
      if(n>score){ best=sep; score=n; }
    }
    return score ? best : "";
  }

  function parseVocabulary(text){
    text = String(text||"").trim();
    if(!text) return [];

    if(text[0]==="[" || text[0]==="{"){
      try{
        const data=JSON.parse(text), arr=Array.isArray(data)?data:(data.words||[]);
        return arr.map(x=>({
          en:String(x.en??x.english??x.word??"").trim(),
          vi:String(x.vi??x.vietnamese??x.meaning??"").trim()
        })).filter(x=>x.en&&x.vi);
      }catch(_){ }
    }

    const sep = detectSeparator(text);
    if(!sep) return [];
    const rows=[];
    for(const raw of text.split(/\r?\n/)){
      const line=raw.trim();
      if(!line || line.startsWith("#")) continue;
      const i=line.indexOf(sep);
      if(i<=0) continue;
      const en=line.slice(0,i).trim().replace(/^["']|["']$/g,"");
      const vi=line.slice(i+sep.length).trim().replace(/^["']|["']$/g,"");
      if(!en||!vi) continue;
      rows.push({en,vi});
    }

    const seen=new Set();
    return rows.filter(x=>{
      const key=norm(x.en)+"|"+norm(x.vi);
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function updateFormatPreview(){
    const sep=visibleSeparator() || "(chưa nhập)";
    ui.formatPattern.textContent=`english${sep}nghĩa tiếng Việt`;
    ui.formatExamples.innerHTML=`abandon${esc(sep)}từ bỏ<br>ability${esc(sep)}khả năng<br>take off${esc(sep)}cất cánh`;
  }

  function countWords(){
    const detected=detectSeparator(ui.wordInput.value);
    if(detected && detected!==activeSeparator()){
      ui.separatorInput.value = detected==="\t" ? "\\t" : detected;
      updateFormatPreview();
    }
    const n=parseVocabulary(ui.wordInput.value).length;
    ui.wordCount.textContent=`${n} từ/cụm từ hợp lệ`;
    ui.wordCount.style.color=n?"#72e2ff":"#ff6b7e";
  }

  function saveWords(){
    localStorage.setItem("vocabBlasterWords",ui.wordInput.value);
    localStorage.setItem("vocabBlasterSeparator",rawSeparator());
    localStorage.setItem("vocabBlasterStudyModeV2",direction());
    localStorage.setItem("vocabBlasterMaxEnemies",ui.maxEnemies.value);
    localStorage.setItem("vocabBlasterDifficulty",ui.difficulty.value);
    localStorage.setItem("vocabBlasterCustomSpeed",ui.customSpeed.value);
    localStorage.setItem("vocabBlasterInfiniteLives",String(ui.infiniteLives.checked));
    localStorage.setItem("vocabBlasterSpeak",String(ui.speak.checked));
    localStorage.setItem("vocabBlasterVoicePreset",ui.voicePreset.value);
    toast("💾 Đã lưu bộ từ và cài đặt");
  }

  function loadSaved(){
    ui.separatorInput.value=localStorage.getItem("vocabBlasterSeparator")||":";
    ui.studyDirection.value=localStorage.getItem("vocabBlasterStudyModeV2")||"typing";
    ui.wordInput.value=localStorage.getItem("vocabBlasterWords")||SAMPLE;
    ui.maxEnemies.value=localStorage.getItem("vocabBlasterMaxEnemies")||"6";
    ui.difficulty.value=localStorage.getItem("vocabBlasterDifficulty")||"normal";
    ui.customSpeed.value=localStorage.getItem("vocabBlasterCustomSpeed")||"28";
    ui.speedValue.textContent=ui.customSpeed.value;
    ui.infiniteLives.checked=localStorage.getItem("vocabBlasterInfiniteLives")==="true";
    ui.speak.checked=localStorage.getItem("vocabBlasterSpeak")!=="false";
    ui.voicePreset.value=localStorage.getItem("vocabBlasterVoicePreset")||"female";
    updateCustomSpeedVisibility();
    updateFormatPreview();
    countWords();
  }

  function toast(t){
    ui.toast.textContent=t; ui.toast.classList.add("show");
    clearTimeout(toast.t); toast.t=setTimeout(()=>ui.toast.classList.remove("show"),1600);
  }

  function updateCustomSpeedVisibility(){
    ui.customSpeedWrap.classList.toggle("hidden",ui.difficulty.value!=="custom");
    ui.speedValue.textContent=ui.customSpeed.value;
  }

  function currentCfg(){
    if(ui.difficulty.value==="custom") return {speed:+ui.customSpeed.value,spawn:1450,lives:3,uniform:true,infiniteLives:!!ui.infiniteLives.checked};
    return {...DIFF[ui.difficulty.value],uniform:false};
  }

  // Toàn bộ cơ chế lặp lại / recall / spaced repetition chỉ chạy ở Tùy chỉnh.
  // Easy / Normal / Hard là game thuần: đi hết bộ từ ngẫu nhiên rồi mới trộn vòng mới.
  function memoryLearningEnabled(){
    return ui.difficulty.value==="custom";
  }

  function resize(){
    const r=canvas.getBoundingClientRect(), dpr=Math.max(1,Math.min(2,devicePixelRatio||1));
    canvas.width=Math.round(r.width*dpr); canvas.height=Math.round(r.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0); game.w=r.width; game.h=r.height;
    game.stars=Array.from({length:90},()=>({x:Math.random()*game.w,y:Math.random()*game.h,r:Math.random()*1.8+.3,a:Math.random()*.7+.2,s:Math.random()*8+3}));
    game.clouds=Array.from({length:6},(_,i)=>({x:Math.random()*game.w,y:60+Math.random()*Math.max(120,game.h*.45),size:45+Math.random()*60,speed:4+Math.random()*7,emoji:i%2?"☁️":"🌫️"}));
  }

  function loadMemoryStore(){
    try{
      const x=JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY)||"{}");
      return x && typeof x==="object" ? x : {};
    }catch(_){ return {}; }
  }

  function saveMemoryStore(){
    try{
      // Chặn localStorage phình vô hạn: chỉ giữ tối đa 3500 mục gần đây nhất.
      const entries=Object.entries(game.memory||{}).sort((a,b)=>(b[1]?.lastAt||0)-(a[1]?.lastAt||0)).slice(0,3500);
      localStorage.setItem(MEMORY_STORAGE_KEY,JSON.stringify(Object.fromEntries(entries)));
    }catch(_){ }
  }

  function loadMemoryTurn(mode){
    const n=Number(localStorage.getItem(MEMORY_TURN_KEY_PREFIX+(mode||direction()))||0);
    return Number.isFinite(n)&&n>=0?n:0;
  }

  function saveMemoryTurn(){
    try{ localStorage.setItem(MEMORY_TURN_KEY_PREFIX+(game.studyMode||direction()),String(game.memoryTurn||0)); }catch(_){ }
  }

  function memoryKey(item){
    return `${game.studyMode||direction()}|${norm(item.en)}|${norm(item.vi)}`;
  }

  function memoryState(item, create=true){
    const key=memoryKey(item);
    let s=game.memory[key];
    if(!s && create){
      s=game.memory[key]={
        en:item.en,vi:item.vi,correct:0,fail:0,cramRemaining:0,
        cramGapIndex:0,cramDueTurn:0,
        gapIndex:-1,dueTurn:0,longIndex:-1,dueAt:0,lastAt:0,lastFailAt:0,mastered:false
      };
    }
    if(s){
      s.en=item.en; s.vi=item.vi;
      if(!Number.isFinite(s.cramGapIndex)) s.cramGapIndex=0;
      if(!Number.isFinite(s.cramDueTurn)) s.cramDueTurn=0;
    }
    return s||null;
  }

  function itemForMemoryKey(key){
    return game.vocabulary.find(x=>memoryKey(x)===key)||null;
  }

  function isMemoryKeyActive(key){
    return game.enemies.some(e=>!e.dead && e.memoryKey===key);
  }

  function choosePendingCram(){
    // Có thể có nhiều từ đang cần củng cố.
    // Chỉ gọi lại một từ khi đã xen đủ số lượt khác theo MEMORY_CRAM_GAPS.
    // Nếu từ đó đang rơi trên màn hình, bỏ qua nó để các từ khác vẫn tiếp tục xuất hiện.
    const candidates=[];
    for(const item of game.vocabulary){
      const key=memoryKey(item), s=memoryState(item,false);
      if(!s || s.cramRemaining<=0) continue;
      if(isMemoryKeyActive(key)) continue;
      if((s.cramDueTurn||0)>game.memoryTurn) continue;
      candidates.push({key,item,s});
    }
    candidates.sort((a,b)=>
      (a.s.cramDueTurn||0)-(b.s.cramDueTurn||0) ||
      (b.s.fail||0)-(a.s.fail||0) ||
      (a.s.lastAt||0)-(b.s.lastAt||0)
    );
    return candidates[0]||null;
  }

  function dueReviewCandidate(){
    const now=Date.now(), due=[];
    for(const item of game.vocabulary){
      const key=memoryKey(item), s=memoryState(item,false);
      if(!s || isMemoryKeyActive(key) || s.cramRemaining>0) continue;
      if(s.gapIndex>=0 && s.dueTurn<=game.memoryTurn){
        due.push({item,key,s,kind:"review",order:s.dueTurn,weak:s.fail||0});
      }else if(s.dueAt>0 && s.dueAt<=now){
        due.push({item,key,s,kind:"long",order:s.dueAt,weak:s.fail||0});
      }
    }
    due.sort((a,b)=>a.order-b.order || b.weak-a.weak || (a.s.lastAt||0)-(b.s.lastAt||0));
    return due[0]||null;
  }

  function refillNormalBag(){
    // Easy / Normal / Hard: KHÔNG dùng thuật toán memory.
    // Mỗi từ đi qua một vòng ngẫu nhiên; chỉ khi hết cả bag mới trộn lại.
    if(!memoryLearningEnabled()){
      game.usedBag=game.vocabulary.filter(item=>!isMemoryKeyActive(memoryKey(item)));
      for(let i=game.usedBag.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [game.usedBag[i],game.usedBag[j]]=[game.usedBag[j],game.usedBag[i]];
      }
      return;
    }

    // Custom: dùng recall + spaced repetition.
    const now=Date.now();
    const eligible=game.vocabulary.filter(item=>{
      const key=memoryKey(item), s=memoryState(item,false);
      if(isMemoryKeyActive(key)) return false;
      if(!s) return true;
      if(s.cramRemaining>0) return false;
      if(s.gapIndex>=0) return false;
      if(s.dueAt>now) return false;
      return true;
    });
    const pool=eligible.length?eligible:game.vocabulary.filter(item=>!isMemoryKeyActive(memoryKey(item)));
    game.usedBag=[...pool];
    for(let i=game.usedBag.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [game.usedBag[i],game.usedBag[j]]=[game.usedBag[j],game.usedBag[i]];
    }
  }

  function randomWord(){
    // Easy / Normal / Hard: game thuần, không ưu tiên từ fail,
    // không lặp recall, không spaced repetition.
    if(!memoryLearningEnabled()){
      let guard=0;
      while(guard++<12){
        if(!game.usedBag.length) refillNormalBag();
        if(!game.usedBag.length) break;
        const item=game.usedBag.pop();
        if(!isMemoryKeyActive(memoryKey(item))){
          return {...item,_memoryKind:"normal"};
        }
      }
      const fallback=game.vocabulary.find(item=>!isMemoryKeyActive(memoryKey(item)));
      return fallback ? {...fallback,_memoryKind:"normal"} : null;
    }

    // Custom: từ yếu tới hạn sẽ được xen khéo léo cùng các từ khác.
    const cram=choosePendingCram();
    if(cram) return {...cram.item,_memoryKind:"cram"};

    const due=dueReviewCandidate();
    if(due) return {...due.item,_memoryKind:due.kind};

    let guard=0;
    while(guard++<8){
      if(!game.usedBag.length) refillNormalBag();
      if(!game.usedBag.length) break;
      const item=game.usedBag.pop();
      const key=memoryKey(item);
      if(!isMemoryKeyActive(key)) return {...item,_memoryKind:"normal"};
    }

    const relaxed=game.vocabulary.find(item=>{
      const key=memoryKey(item), s=memoryState(item,false);
      return !isMemoryKeyActive(key) && (!s || s.cramRemaining<=0);
    });
    if(relaxed) return {...relaxed,_memoryKind:"filler"};

    const tiny=game.vocabulary.find(item=>!isMemoryKeyActive(memoryKey(item)));
    return tiny ? {...tiny,_memoryKind:"cram"} : null;
  }

  function scheduleFailure(item, advanceTurn=false){
    if(!item || !memoryLearningEnabled()) return;
    if(advanceTurn){ game.memoryTurn++; saveMemoryTurn(); }
    const key=memoryKey(item), s=memoryState(item,true);
    s.fail=(s.fail||0)+1;
    s.cramRemaining=MEMORY_CRAM_CORRECTS;
    s.cramGapIndex=0;
    // Sau khi chưa nhớ: xen ít nhất 1 từ khác rồi mới đưa từ này trở lại.
    s.cramDueTurn=game.memoryTurn+MEMORY_CRAM_GAPS[0];
    s.gapIndex=-1; s.dueTurn=0; s.longIndex=-1; s.dueAt=0;
    s.mastered=false; s.lastAt=Date.now(); s.lastFailAt=Date.now();
    game.focusCramKey="";
    saveMemoryStore();
  }

  function scheduleCorrect(e){
    if(!memoryLearningEnabled()){
      return randomEncouragement(ENCOURAGE_CORRECT);
    }
    game.memoryTurn++; saveMemoryTurn();
    const item={en:e.en,vi:e.vi}, key=e.memoryKey||memoryKey(item), s=memoryState(item,true);
    s.correct=(s.correct||0)+1; s.lastAt=Date.now();

    if(s.cramRemaining>0){
      s.cramRemaining=Math.max(0,s.cramRemaining-1);
      if(s.cramRemaining>0){
        // Đúng một lần chưa có nghĩa là đã nhớ lâu.
        // Xen ngày càng nhiều từ khác: 7 -> 12 lượt trước lần recall kế tiếp.
        s.cramGapIndex=Math.min((s.cramGapIndex||0)+1,MEMORY_CRAM_GAPS.length-1);
        s.cramDueTurn=game.memoryTurn+MEMORY_CRAM_GAPS[s.cramGapIndex];
      }else{
        s.cramGapIndex=0;
        s.cramDueTurn=0;
        game.focusCramKey="";
        s.gapIndex=0;
        s.dueTurn=game.memoryTurn+MEMORY_REVIEW_GAPS[0];
      }
    }else if(e.memoryKind==="review" && s.gapIndex>=0){
      const next=s.gapIndex+1;
      if(next<MEMORY_REVIEW_GAPS.length){
        s.gapIndex=next;
        s.dueTurn=game.memoryTurn+MEMORY_REVIEW_GAPS[next];
      }else{
        s.gapIndex=-1; s.dueTurn=0; s.longIndex=0;
        s.dueAt=Date.now()+MEMORY_LONG_INTERVALS[0];
      }
    }else if(e.memoryKind==="long" && s.dueAt>0){
      const next=Math.min((s.longIndex<0?0:s.longIndex)+1,MEMORY_LONG_INTERVALS.length-1);
      s.longIndex=next;
      s.dueAt=Date.now()+MEMORY_LONG_INTERVALS[next];
      if(next>=4) s.mastered=true;
    }else if(e.memoryKind!=="filler"){
      s.gapIndex=1;
      s.dueTurn=game.memoryTurn+MEMORY_REVIEW_GAPS[1];
      s.dueAt=0; s.longIndex=-1;
    }

    saveMemoryStore();
    return randomEncouragement(ENCOURAGE_CORRECT);
  }

  function editDistance(a,b){
    a=norm(a);b=norm(b);
    const dp=Array.from({length:b.length+1},(_,j)=>j);
    for(let i=1;i<=a.length;i++){
      let prev=dp[0]; dp[0]=i;
      for(let j=1;j<=b.length;j++){
        const old=dp[j];
        dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
        prev=old;
      }
    }
    return dp[b.length];
  }

  function likelyFailedEnemy(raw){
    const typed=norm(raw), active=game.enemies.filter(e=>!e.dead&&e.inputKind!=="choice");
    if(!active.length || !typed) return null;
    if(active.length===1) return active[0];
    const ranked=active.map(e=>{
      const target=norm(e.answer), d=editDistance(typed,target), ratio=d/Math.max(typed.length,target.length,1);
      return {e,ratio};
    }).sort((a,b)=>a.ratio-b.ratio || b.e.y-a.e.y);
    return ranked[0].ratio<=0.65 ? ranked[0].e : null;
  }


  function customTaskFor(item){
    const mode=direction();
    const alreadyHasChoice=game.enemies.some(e=>!e.dead&&e.inputKind==="choice");

    // Tập gõ trong Custom: vẫn đơn giản English -> gõ English.
    if(mode==="typing"){
      return {
        inputKind:"type",
        taskMode:"type-copy-en",
        display:item.en,
        answer:item.en,
        meaning:item.vi,
        answerLang:"en"
      };
    }

    // Anh -> Việt:
    // Phần lớn: English rơi -> NHẤN 1/4 nghĩa tiếng Việt.
    // Lâu lâu: tiếng Việt rơi -> bắt buộc GÕ English.
    if(mode==="en-vi"){
      const useChoice=!alreadyHasChoice && Math.random()<CUSTOM_CHOICE_CHANCE_EN_VI;
      if(useChoice){
        return {
          inputKind:"choice",
          taskMode:"choice-vi",
          display:item.en,
          answer:item.vi,
          meaning:item.en,
          answerLang:"vi"
        };
      }
      return {
        inputKind:"type",
        taskMode:"type-from-vi",
        display:item.vi,
        answer:item.en,
        meaning:item.vi,
        answerLang:"en"
      };
    }

    // Việt -> Anh:
    // Chủ yếu: tiếng Việt rơi -> bắt buộc GÕ English.
    // Thỉnh thoảng: English rơi -> NHẤN 1/4 nghĩa tiếng Việt.
    const useChoice=!alreadyHasChoice && Math.random()<CUSTOM_CHOICE_CHANCE_VI_EN;
    if(useChoice){
      return {
        inputKind:"choice",
        taskMode:"choice-vi",
        display:item.en,
        answer:item.vi,
        meaning:item.en,
        answerLang:"vi"
      };
    }
    return {
      inputKind:"type",
      taskMode:"type-from-vi",
      display:item.vi,
      answer:item.en,
      meaning:item.vi,
      answerLang:"en"
    };
  }

  function pickChoiceDistractor(item, answerLang){
    const answer=answerLang==="vi" ? item.vi : item.en;
    const pool=game.vocabulary.filter(v=>{
      const x=answerLang==="vi" ? v.vi : v.en;
      return norm(x)!==norm(answer);
    });
    if(!pool.length) return answerLang==="vi" ? "một nghĩa khác" : "another word";
    const other=pool[Math.floor(Math.random()*pool.length)];
    return answerLang==="vi" ? other.vi : other.en;
  }

  function makeChoiceOptions(item, task){
    const correct=task.answer;
    const used=new Set([norm(correct)]);
    const wrongs=[];

    const pool=[...game.vocabulary].sort(()=>Math.random()-.5);
    for(const v of pool){
      const text=task.answerLang==="vi" ? v.vi : v.en;
      const key=norm(text);
      if(!key || used.has(key)) continue;
      used.add(key);
      wrongs.push(text);
      if(wrongs.length===3) break;
    }

    while(wrongs.length<3){
      wrongs.push(task.answerLang==="vi" ? "nghĩa khác" : "another word");
    }

    const arr=[
      {text:correct,correct:true},
      {text:wrongs[0],correct:false},
      {text:wrongs[1],correct:false},
      {text:wrongs[2],correct:false}
    ];

    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function displayText(item){
    return direction()==="vi-en" ? item.vi : item.en;
  }
  function answerText(item){
    if(direction()==="en-vi") return item.vi;
    return item.en;
  }
  function meaningText(item){
    return direction()==="vi-en" ? item.en : item.vi;
  }

  function spawn(){
    if(!game.running||game.paused) return false;
    const active=game.enemies.filter(e=>!e.dead);
    const max=Math.max(1,+ui.maxEnemies.value||1);
    if(active.length>=max) return false;

    // Không sinh từ mới nếu từ gần mép trên nhất chưa đi xuống đủ xa.
    // Đây là khoảng cách thật theo pixel, không chỉ dựa vào timer.
    const spawnY=-58-Math.random()*18;
    if(active.length){
      const topmostY=Math.min(...active.map(e=>e.y));
      if(topmostY-spawnY<MIN_ENEMY_VERTICAL_GAP) return false;
    }

    const item=randomWord(); if(!item) return false;
    const cfg=currentCfg(), size=46+Math.random()*16, margin=95;
    const x=margin+Math.random()*Math.max(50,game.w-margin*2);
    const speed=cfg.uniform ? cfg.speed : cfg.speed*(1+(game.level-1)*.08)*(.88+Math.random()*.24);

    let task;
    if(memoryLearningEnabled()){
      task=customTaskFor(item);
    }else{
      task={
        inputKind:"type", taskMode:"normal",
        display:displayText(item), answer:answerText(item), meaning:meaningText(item),
        answerLang:typingMode()
      };
    }

    const enemy={
      id:game.nextEnemyId++, en:item.en, vi:item.vi,
      display:task.display, answer:task.answer, meaning:task.meaning, target:norm(task.answer),
      inputKind:task.inputKind, taskMode:task.taskMode, answerLang:task.answerLang,
      memoryKey:memoryKey(item), memoryKind:item._memoryKind||"normal",
      skin:SKINS[Math.floor(Math.random()*SKINS.length)], x, y:spawnY,
      vx:(Math.random()-.5)*24, vy:speed, size, wobble:Math.random()*Math.PI*2, dead:false, hitFlash:0, angle:0
    };
    if(enemy.inputKind==="choice"){
      enemy.choiceOptions=makeChoiceOptions(item,task);
    }
    game.enemies.push(enemy);
    return true;
  }

  function nextSpawnDelay(cfg){
    // Ngẫu nhiên nhưng luôn có khoảng cách tối thiểu giữa hai từ.
    const base=Math.max(950,cfg.spawn-(game.level-1)*55);
    return base*(0.90+Math.random()*0.35);
  }

  function start(){
    const vocab=parseVocabulary(ui.wordInput.value);
    if(vocab.length<1){ toast("🌱 Thêm ít nhất 1 cặp từ rồi mình bắt đầu nhé"); return; }
    saveWords();
    const cfg=currentCfg();
    const studyMode=memoryLearningEnabled() ? "custom-mixed" : direction();
    Object.assign(game,{vocabulary:vocab,usedBag:[],enemies:[],bullets:[],particles:[],floaters:[],score:0,combo:0,maxCombo:0,level:1,kills:0,correctKeys:0,wrongKeys:0,typed:"",spawnTimer:0,nextEnemyId:1,infiniteLives:!!cfg.infiniteLives,lives:cfg.infiniteLives?Infinity:cfg.lives,running:true,paused:false,memory:loadMemoryStore(),memoryTurn:loadMemoryTurn(studyMode),focusCramKey:"",recentWordKeys:[],studyMode,choiceTargetId:0});
    ui.gameOver.classList.add("hidden"); ui.pauseScreen.classList.add("hidden"); ui.panel.classList.remove("open");
    clearTyped(); hud(); typingUI();
    // Chỉ thả 1 từ đầu tiên. Các từ sau luôn cách nhau một khoảng ngẫu nhiên.
    spawn();
    game.spawnTimer=nextSpawnDelay(cfg);
    setTimeout(focusTyping,50);
  }

  function hud(){
    ui.score.textContent=game.score.toLocaleString(); ui.combo.textContent=game.combo; ui.level.textContent=game.level; ui.lives.textContent=game.infiniteLives?"∞":game.lives;
  }

  function typingUI(){
    if(!game.running){
      ui.typingWord.textContent="Chọn bộ từ rồi bắt đầu";
      ui.typingMeaning.textContent="Enter = bắn mục tiêu";
      return;
    }
    if(memoryLearningEnabled()){
      const choice=activeChoiceEnemy();
      if(choice){
        ui.typingWord.textContent=game.typed || "Chọn 1 trong 4 đáp án";
        ui.typingMeaning.textContent=choice.answerLang==="vi"
          ? "English → chọn nghĩa tiếng Việt"
          : "Chọn đáp án đúng";
      }else{
        ui.typingWord.textContent=game.typed || "Gõ English rồi Enter";
        ui.typingMeaning.textContent=direction()==="vi-en"
          ? "Tiếng Việt → gõ English"
          : direction()==="en-vi"
            ? "Lâu lâu tiếng Việt xuất hiện → gõ English"
            : "English → gõ English";
      }
      return;
    }
    const mode=direction();
    if(mode==="typing"){
      ui.typingWord.textContent=game.typed || "Gõ lại từ English đang hiện rồi Enter...";
      ui.typingMeaning.textContent="⌨️ Tập gõ: thấy English → gõ đúng English";
    }else if(mode==="en-vi"){
      ui.typingWord.textContent=game.typed || "Gõ nghĩa tiếng Việt rồi Enter...";
      ui.typingMeaning.textContent="🇬🇧 → 🇻🇳 Dịch nghĩa: thấy English → gõ Tiếng Việt";
    }else{
      ui.typingWord.textContent=game.typed || "Gõ từ English rồi Enter...";
      ui.typingMeaning.textContent="🇻🇳 → 🇬🇧 Dịch nghĩa: thấy Tiếng Việt → gõ English";
    }
  }

  function clearTyped(){ game.typed=""; ui.imeSink.value=""; typingUI(); }

  function findEnemyByTyped(){
    const answer=norm(game.typed); if(!answer) return null;
    const list=game.enemies.filter(e=>!e.dead&&e.inputKind!=="choice"&&norm(e.answer)===answer).sort((a,b)=>b.y-a.y);
    return list[0]||null;
  }

  function submitTyped(){
    if(!game.running||game.paused) return;
    if(!norm(game.typed)){ clearTyped(); focusTyping(); return; }
    const e=findEnemyByTyped();
    if(e){
      game.correctKeys++; shoot(e); e.hitFlash=.12; kill(e); clearTyped();
      ui.typingMeaning.textContent=`✅ ${e.en} = ${e.vi}`;
      setTimeout(()=>{typingUI();focusTyping();},900);
    }else{
      const failed=likelyFailedEnemy(game.typed);
      if(failed) scheduleFailure({en:failed.en,vi:failed.vi},false);
      wrong(); clearTyped();
      ui.typingMeaning.textContent=randomEncouragement(ENCOURAGE_RETRY);
      setTimeout(()=>{typingUI();focusTyping();},800);
    }
  }

  function typeChar(ch){ if(!game.running||game.paused) return; game.typed+=ch; typingUI(); }
  function wrong(){ game.wrongKeys++; game.combo=0; sfx("encourage"); hud(); }

  function activeChoiceEnemy(){
    if(!memoryLearningEnabled() || !game.running || game.paused) return null;
    return game.enemies
      .filter(e=>!e.dead&&e.inputKind==="choice")
      .sort((a,b)=>b.y-a.y)[0] || null;
  }

  function syncChoiceDock(){
    const e=activeChoiceEnemy();
    if(!e){
      game.choiceTargetId=0;
      ui.choiceDock.classList.add("hidden");
      return;
    }

    game.choiceTargetId=e.id;
    const opts=e.choiceOptions||[];
    if(opts.length<4){
      ui.choiceDock.classList.add("hidden");
      return;
    }

    const cards=[ui.choice1,ui.choice2,ui.choice3,ui.choice4];
    cards.forEach((card,i)=>{
      card.textContent=opts[i].text;
      card.dataset.value=opts[i].text;
      card.dataset.correct=String(!!opts[i].correct);
      card.dataset.targetId=String(e.id);
    });

    ui.choiceDock.classList.remove("hidden");
  }

  function chooseAnswer(card){
    if(!game.running || game.paused || !memoryLearningEnabled()) return;

    const targetId=Number(card.dataset.targetId||0);
    if(!targetId) return;

    const e=game.enemies.find(x=>x.id===targetId && !x.dead && x.inputKind==="choice");
    if(!e) return;

    const value=card.dataset.value || card.textContent || "";
    const correct=card.dataset.correct==="true";

    if(correct && norm(value)===norm(e.answer)){
      game.correctKeys++;
      shoot(e);
      e.hitFlash=.12;
      // Dùng đúng luồng kill() như khi gõ đúng:
      // vẫn cộng điểm, cập nhật memory và đọc English nếu bật nút loa.
      kill(e);
      ui.typingMeaning.textContent=`✅ ${e.en} = ${e.vi}`;
      setTimeout(()=>{typingUI();focusTyping();},700);
    }else{
      // Chọn sai = coi như CHƯA THUỘC.
      // Mục tiêu biến mất ngay để người học không thể bấm mò cho tới đáp án đúng.
      e.dead=true;
      game.choiceTargetId=0;
      ui.choiceDock.classList.add("hidden");

      // Ghi nhận như một lần chưa nhớ và đưa từ vào cơ chế học lại hiện tại.
      // advanceTurn=true vì lượt này đã kết thúc hoàn toàn.
      scheduleFailure({en:e.en,vi:e.vi},true);
      wrong();

      // Không cộng điểm, không tính đúng, không gọi scheduleCorrect().
      // Chỉ tạo hiệu ứng biến mất nhẹ.
      explode(e.x,e.y);

      // Hiện lại cặp Anh = Việt theo hướng tích cực để người học biết đáp án,
      // sau đó từ này sẽ quay lại theo lịch memory.
      game.floaters.push({
        x:game.w/2,
        y:Math.max(120,game.h-215),
        text:`🌱 ${e.en} = ${e.vi}`,
        sub:randomEncouragement(ENCOURAGE_MISS),
        life:4.5,maxLife:4.5,learning:true
      });

      ui.typingMeaning.textContent=`🌱 ${e.en} = ${e.vi}`;
      setTimeout(()=>typingUI(),900);
    }
  }

  for(const card of [ui.choice1,ui.choice2,ui.choice3,ui.choice4]){
    card.addEventListener("click",()=>chooseAnswer(card));
  }


  function shooterPos(){ return {x:game.w/2,y:game.h-132}; }
  function shoot(e){
    const p=shooterPos(); game.muzzle=.09;
    game.bullets.push({x:p.x+34,y:p.y-18,tx:e.x,ty:e.y,life:.16,maxLife:.16}); sfx("shot");
  }


  function englishVoices(){
    if(!("speechSynthesis" in window)) return [];
    return speechSynthesis.getVoices().filter(v=>{
      const lang=String(v.lang||"").toLowerCase();
      return lang.startsWith("en");
    });
  }

  function pickVoice(preset){
    const voices=englishVoices();
    if(!voices.length) return null;

    const femaleNames=[
      "zira","samantha","jenny","aria","ava","victoria","karen","moira",
      "tessa","susan","hazel","female","google us english"
    ];
    const maleNames=[
      "david","mark","guy","george","daniel","alex","fred","tom",
      "ryan","brian","male"
    ];

    const findByNames=names=>voices.find(v=>{
      const n=String(v.name||"").toLowerCase();
      return names.some(k=>n.includes(k));
    });

    if(preset==="male"){
      return findByNames(maleNames)
        || voices.find(v=>String(v.lang||"").toLowerCase()==="en-us")
        || voices[0];
    }

    // Chế độ trẻ em: ưu tiên giọng nam/trẻ, sau đó mới fallback.
    // Mục tiêu là chất giọng bé trai sáng, vui, dễ thương kiểu "Hobin",
    // không phải chỉ lấy giọng nữ rồi tăng pitch.
    if(preset==="child"){
      const childBoyNames=[
        "ryan","guy","davis","tony","jason","joey","andrew",
        "oliver","jamie","boy","kid","child","young"
      ];
      return findByNames(childBoyNames)
        || findByNames(maleNames)
        || voices.find(v=>String(v.lang||"").toLowerCase()==="en-us")
        || voices[0];
    }

    return findByNames(femaleNames)
      || voices.find(v=>String(v.lang||"").toLowerCase()==="en-us")
      || voices[0];
  }

  function speakEnglishWord(text){
    if(!ui.speak.checked || !("speechSynthesis" in window)) return;
    try{
      speechSynthesis.cancel();
      const preset=ui.voicePreset?.value || "female";
      const u=new SpeechSynthesisUtterance(text);
      u.lang="en-US";
      u.voice=pickVoice(preset);

      if(preset==="male"){
        u.rate=.88;
        u.pitch=.78;
      }else if(preset==="child"){
        // Bé trai dễ thương: sáng, lanh, hơi nhanh; không bị the thé.
        u.rate=1.03;
        u.pitch=1.24;
      }else{
        u.rate=.90;
        u.pitch=1.05;
      }

      u.volume=1;
      speechSynthesis.speak(u);
    }catch(_){ }
  }

  function kill(e){
    e.dead=true; game.kills++; game.combo++; game.maxCombo=Math.max(game.maxCombo,game.combo); game.level=1+Math.floor(game.kills/10);
    const gain=100+e.target.length*12+Math.min(20,game.combo)*8; game.score+=gain; explode(e.x,e.y);
    const memoryNote=scheduleCorrect(e);
    game.floaters.push({
      x:game.w/2,y:Math.max(120,game.h-215),
      text:`💡 ${e.en} = ${e.vi}`,
      sub:memoryNote || `+${gain} • Ghi nhớ`,
      life:4.5,maxLife:4.5,learning:true
    });
    speakEnglishWord(e.en);
    sfx("boom"); hud();
  }

  function explode(x,y){
    for(let i=0;i<24;i++){
      const a=Math.random()*Math.PI*2,sp=50+Math.random()*150;
      game.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.65+Math.random()*.45,size:2+Math.random()*5,hue:Math.random()<.5?48:330});
    }
    game.particles.push({x,y,vx:0,vy:-20,life:.7,size:30,hue:0,emoji:"💥"});
  }

  function miss(e){
    e.dead=true;
    game.combo=0;
    // Khi từ đi qua vùng học, hệ thống âm thầm đánh dấu để ưu tiên ôn lại.
    // Người học chỉ thấy lời động viên, không thấy trạng thái/bộ đếm nội bộ.
    scheduleFailure({en:e.en,vi:e.vi},true);
    if(!game.infiniteLives) game.lives--;
    game.floaters.push({
      x:game.w/2,y:Math.max(120,game.h-215),
      text:`🌱 ${e.en} = ${e.vi}`,
      sub:randomEncouragement(ENCOURAGE_MISS),
      life:4.5,maxLife:4.5,learning:true
    });
    sfx("encourage");
    hud();
    if(!game.infiniteLives && game.lives<=0) end();
  }

  function end(){
    game.running=false; game.paused=false; ui.imeSink.blur();
    ui.choiceDock.classList.add("hidden");
    const total=game.correctKeys+game.wrongKeys,acc=total?Math.round(game.correctKeys/total*100):100;
    ui.finalScore.textContent=game.score.toLocaleString(); ui.finalKills.textContent=game.kills; ui.finalAccuracy.textContent=`${acc}%`; ui.finalCombo.textContent=game.maxCombo;
    ui.gameOver.classList.remove("hidden");
  }

  function pause(force){
    if(!game.running) return;
    game.paused=typeof force==="boolean"?force:!game.paused;
    ui.pauseScreen.classList.toggle("hidden",!game.paused); $("btnPause").textContent=game.paused?"▶️":"⏸️";
    if(game.paused){ui.choiceDock.classList.add("hidden");}
    if(!game.paused) setTimeout(focusTyping,0);
  }

  function sfx(type){
    if(!game.sound) return;
    try{
      const AC=AudioContext||webkitAudioContext; if(!sfx.ctx)sfx.ctx=new AC();
      const ac=sfx.ctx,o=ac.createOscillator(),g=ac.createGain(); o.connect(g);g.connect(ac.destination);
      const map={shot:[620,.04,"square"],boom:[120,.12,"sawtooth"],wrong:[170,.10,"square"],miss:[90,.20,"triangle"],encourage:[520,.08,"sine"]},[f,d,w]=map[type]||map.shot;
      o.type=w;o.frequency.setValueAtTime(f,ac.currentTime);if(type==="boom")o.frequency.exponentialRampToValueAtTime(55,ac.currentTime+d);
      g.gain.setValueAtTime(.055,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.start();o.stop(ac.currentTime+d);
    }catch(_){ }
  }

  function update(dt){
    for(const s of game.stars){s.y+=s.s*dt;if(s.y>game.h){s.y=0;s.x=Math.random()*game.w;}}
    for(const c of game.clouds){c.x+=c.speed*dt;if(c.x>game.w+100)c.x=-120;}
    if(!game.running||game.paused) return;
    const cfg=currentCfg(); game.spawnTimer-=dt*1000;
    if(game.spawnTimer<=0){
      const didSpawn=spawn();
      game.spawnTimer=didSpawn ? nextSpawnDelay(cfg) : 180;
    }
    const missLine=game.h-168;
    for(const e of game.enemies){
      if(e.dead)continue; e.wobble+=dt*2.3;e.angle=Math.sin(e.wobble)*.09;e.x+=(e.vx+Math.sin(e.wobble)*14)*dt;e.y+=e.vy*dt;
      if(e.x<55){e.x=55;e.vx=Math.abs(e.vx);}if(e.x>game.w-55){e.x=game.w-55;e.vx=-Math.abs(e.vx);}e.hitFlash=Math.max(0,e.hitFlash-dt);
    }

    // Từ sinh sau có thể nhanh hơn từ phía dưới và đuổi kịp.
    // Ép khoảng cách dọc tối thiểu trong SUỐT lúc rơi để chúng không dính sát nhau.
    const falling=game.enemies.filter(e=>!e.dead).sort((a,b)=>b.y-a.y); // dưới -> trên
    for(let i=1;i<falling.length;i++){
      const below=falling[i-1], above=falling[i];
      const highestAllowedY=below.y-MIN_ENEMY_VERTICAL_GAP;
      if(above.y>highestAllowedY) above.y=highestAllowedY;
    }

    for(const e of game.enemies){
      if(!e.dead && e.y>missLine) miss(e);
    }
    game.enemies=game.enemies.filter(e=>!e.dead||Math.random()>.97);
    for(const b of game.bullets)b.life-=dt;game.bullets=game.bullets.filter(b=>b.life>0);
    for(const p of game.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;}game.particles=game.particles.filter(p=>p.life>0);
    for(const f of game.floaters){
      f.life-=dt;
      f.y-=(f.learning?24:18)*dt;
      if(f.learning)f.y=Math.max(95,Math.min(game.h-190,f.y));
    }
    game.floaters=game.floaters.filter(f=>f.life>0);
    game.muzzle=Math.max(0,game.muzzle-dt);
  }

  function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}

  function background(t){
    const g=ctx.createLinearGradient(0,0,0,game.h);g.addColorStop(0,"#10173b");g.addColorStop(.48,"#151735");g.addColorStop(1,"#08101f");ctx.fillStyle=g;ctx.fillRect(0,0,game.w,game.h);
    for(const s of game.stars){ctx.globalAlpha=s.a*(.75+.25*Math.sin(t*.002+s.x));ctx.fillStyle="#d9eeff";ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;ctx.font="70px serif";ctx.globalAlpha=.12;for(const c of game.clouds)ctx.fillText(c.emoji,c.x,c.y);ctx.globalAlpha=1;
    ctx.fillStyle="#111b2c";ctx.beginPath();ctx.moveTo(0,game.h);for(let x=0;x<=game.w;x+=80)ctx.lineTo(x,game.h-105-Math.sin(x*.013)*30-Math.sin(x*.027)*12);ctx.lineTo(game.w,game.h);ctx.closePath();ctx.fill();
    const lg=ctx.createLinearGradient(0,0,game.w,0);lg.addColorStop(0,"rgba(64,224,255,0)");lg.addColorStop(.5,"rgba(64,224,255,.45)");lg.addColorStop(1,"rgba(64,224,255,0)");ctx.fillStyle=lg;ctx.fillRect(0,game.h-160,game.w,2);
  }

  function drawEnemy(e){
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);
    if(e.id===game.choiceTargetId && e.inputKind==="choice"){
      ctx.shadowColor="#fff16a";ctx.shadowBlur=24;
    }else if(e.hitFlash>0){
      ctx.shadowColor="#fff";ctx.shadowBlur=25;
    }
    ctx.font=`${e.size}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(e.skin,0,0);
    ctx.font=`800 ${Math.max(14,Math.min(20,16+e.target.length*.06))}px Segoe UI,Arial`;const tw=ctx.measureText(e.display).width,bw=Math.max(64,tw+26),bh=32;
    rr(-bw/2,e.size*.5,bw,bh,10,"rgba(5,7,18,.90)","rgba(255,255,255,.16)");ctx.fillStyle="#fff";ctx.fillText(e.display,0,e.size*.5+bh/2+1);ctx.restore();
  }

  function drawBullets(){
    for(const b of game.bullets){const p=1-b.life/b.maxLife,x=b.x+(b.tx-b.x)*p,y=b.y+(b.ty-b.y)*p;ctx.strokeStyle="rgba(73,225,255,.7)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle="#fff";ctx.shadowColor="#45eaff";ctx.shadowBlur=14;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  }

  function drawParticles(){for(const p of game.particles){ctx.globalAlpha=Math.max(0,p.life/.8);if(p.emoji){ctx.font=`${p.size}px serif`;ctx.fillText(p.emoji,p.x,p.y);}else{ctx.fillStyle=`hsl(${p.hue} 95% 60%)`;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;}
  function drawFloaters(){
    ctx.textAlign="center";
    for(const f of game.floaters){
      ctx.globalAlpha=Math.min(1,f.life*.9);
      if(f.learning){
        const maxW=Math.max(260,Math.min(game.w-28,720));
        ctx.font="900 24px Segoe UI,Arial";
        const boxW=Math.max(260,Math.min(maxW,ctx.measureText(f.text).width+42));
        const boxH=74;
        const x=Math.max(boxW/2+12,Math.min(game.w-boxW/2-12,f.x));
        const y=Math.max(56,Math.min(game.h-195,f.y));
        rr(x-boxW/2,y-36,boxW,boxH,15,"rgba(5,9,24,.97)","rgba(255,235,90,.82)");
        ctx.shadowColor="#000";ctx.shadowBlur=12;
        ctx.fillStyle="#fff36a";ctx.fillText(f.text,x,y-6,boxW-24);
        ctx.font="800 14px Segoe UI,Arial";
        ctx.fillStyle="#fff";ctx.fillText(f.sub,x,y+20,boxW-24);
        ctx.shadowBlur=0;
      }else{
        ctx.font="900 23px Segoe UI,Arial";
        ctx.shadowColor="#000";ctx.shadowBlur=10;
        ctx.fillStyle="#fff36a";ctx.fillText(f.text,f.x,f.y);
        ctx.font="700 13px Segoe UI,Arial";
        ctx.fillStyle="#fff";ctx.fillText(f.sub,f.x,f.y+20);
        ctx.shadowBlur=0;
      }
    }
    ctx.globalAlpha=1;
  }

  function cannon(){
    const {x,y}=shooterPos();ctx.save();ctx.translate(x,y);
    const glow=ctx.createRadialGradient(0,20,5,0,20,65);glow.addColorStop(0,"rgba(65,225,255,.24)");glow.addColorStop(1,"rgba(65,225,255,0)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,20,65,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(10,17,40,.82)";ctx.strokeStyle="rgba(82,226,255,.45)";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,42,55,14,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font="66px 'Segoe UI Emoji',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("🧑‍🚀",-8,0);
    ctx.save();ctx.translate(32,-8);ctx.rotate(-.17);ctx.font="44px 'Segoe UI Emoji',sans-serif";ctx.fillText("🔫",0,0);ctx.restore();
    if(game.muzzle>0){ctx.font="36px serif";ctx.fillText("💥",62,-26);}
    ctx.restore();
  }

  function draw(t){
    if(!game.w||!game.h)return;
    syncChoiceDock();
    ctx.clearRect(0,0,game.w,game.h);
    background(t);
    for(const e of game.enemies)if(!e.dead)drawEnemy(e);
    drawBullets();drawParticles();drawFloaters();cannon();
  }
  function loop(t){const dt=Math.min(.033,(t-game.lastTime)/1000||0);game.lastTime=t;update(dt);draw(t);requestAnimationFrame(loop);}

  function englishCharFromCode(ev){
    if(/^Key[A-Z]$/.test(ev.code)) return ev.code.slice(3).toLowerCase();
    if(/^Digit[0-9]$/.test(ev.code)) return ev.code.slice(5);
    if(ev.code==="Space") return " ";
    if(ev.code==="Minus") return "-";
    if(ev.code==="Quote") return "'";
    return null;
  }

  function focusTyping(){
    if(!game.running||game.paused||ui.panel.classList.contains("open")) return;
    if(typingMode()==="vi"){
      ui.imeSink.value=game.typed;ui.imeSink.focus({preventScroll:true});
      try{ui.imeSink.setSelectionRange(ui.imeSink.value.length,ui.imeSink.value.length);}catch(_){ }
    }else{
      if(document.activeElement===ui.imeSink)ui.imeSink.blur();
      const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))a.blur();
    }
  }

  ui.imeSink.addEventListener("input",()=>{
    if(typingMode()!=="vi"||!game.running||game.paused)return;
    game.typed=ui.imeSink.value.normalize("NFC");typingUI();
  });
  ui.imeSink.addEventListener("compositionend",()=>{
    if(typingMode()!=="vi")return;game.typed=ui.imeSink.value.normalize("NFC");typingUI();
  });
  ui.imeSink.addEventListener("keydown",ev=>{
    if(typingMode()!=="vi"||!game.running||game.paused)return;
    if(ev.key==="Enter"){ev.preventDefault();game.typed=ui.imeSink.value.normalize("NFC");submitTyped();}
  });

  document.addEventListener("keydown",ev=>{
    if(ui.panel.classList.contains("open"))return;
    if(ev.key==="Escape"){ev.preventDefault();pause();return;}
    if(!game.running||game.paused)return;
    if(typingMode()==="vi"){if(document.activeElement!==ui.imeSink)setTimeout(focusTyping,0);return;}
    if(ev.key==="Enter"){ev.preventDefault();submitTyped();return;}
    if(ev.key==="Backspace"){ev.preventDefault();if(game.typed.length){game.typed=game.typed.slice(0,-1);typingUI();}return;}
    const ch=englishCharFromCode(ev);if(ch!==null){ev.preventDefault();typeChar(ch);}
  });

  $("btnStart").onclick=async()=>{
    access.startAfterPayment=true;
    if(await requireAccess()){access.startAfterPayment=false;start();}
  };
  $("btnWords").onclick=()=>{if(game.running)pause(true);ui.panel.classList.add("open");};
  $("btnCloseWords").onclick=()=>{ui.panel.classList.remove("open");if(game.running)pause(false);setTimeout(focusTyping,0);};
  $("btnPause").onclick=()=>pause();
  $("btnResume").onclick=()=>pause(false);
  $("btnRestart").onclick=async()=>{access.startAfterPayment=true;if(await requireAccess()){access.startAfterPayment=false;start();}};
  $("btnSound").onclick=()=>{game.sound=!game.sound;$("btnSound").textContent=game.sound?"🔊":"🔇";};
  $("btnAccess").onclick=()=>{access.startAfterPayment=false;showSupportGate();};
  $("btnCloseSupport").onclick=closeSupportGate;
  $("btnCreatePayment").onclick=createPayment;
  $("btnClosePayment").onclick=closePaymentGate;

  $("btnSample").onclick=()=>{
    const sep=activeSeparator()||"|";
    ui.wordInput.value=SAMPLE.split("\n").map(line=>{
      const i=line.indexOf("|");if(i<0)return line;
      const en=line.slice(0,i),vi=line.slice(i+1);
      return `${en}${sep}${vi}`;
    }).join("\n");
    countWords();toast("🎲 Đã nạp bộ từ mẫu");
  };
  $("btnSaveWords").onclick=saveWords;

  ui.wordInput.addEventListener("input",countWords);
  ui.separatorInput.addEventListener("input",()=>{updateFormatPreview();countWords();});
  ui.studyDirection.addEventListener("change",()=>{clearTyped();updateFormatPreview();countWords();localStorage.setItem("vocabBlasterStudyModeV2",direction());setTimeout(focusTyping,0);});
  ui.difficulty.addEventListener("change",()=>{
    updateCustomSpeedVisibility();
    localStorage.setItem("vocabBlasterDifficulty",ui.difficulty.value);
    if(ui.difficulty.value!=="custom"){
      ui.choiceDock.classList.add("hidden");
    }
  });
  ui.customSpeed.addEventListener("input",()=>{ui.speedValue.textContent=ui.customSpeed.value;localStorage.setItem("vocabBlasterCustomSpeed",ui.customSpeed.value);});
  ui.maxEnemies.addEventListener("change",()=>localStorage.setItem("vocabBlasterMaxEnemies",ui.maxEnemies.value));
  ui.infiniteLives.addEventListener("change",()=>localStorage.setItem("vocabBlasterInfiniteLives",String(ui.infiniteLives.checked)));
  ui.speak.addEventListener("change",()=>localStorage.setItem("vocabBlasterSpeak",String(ui.speak.checked)));
  ui.voicePreset.addEventListener("change",()=>localStorage.setItem("vocabBlasterVoicePreset",ui.voicePreset.value));

  $("fileInput").addEventListener("change",async ev=>{
    const f=ev.target.files?.[0];if(!f)return;
    try{ui.wordInput.value=await f.text();countWords();toast(`📂 Đã đọc ${f.name}`);}catch(_){toast("💡 Chọn lại tệp giúp mình nha");}
  });

  window.addEventListener("resize",resize);
  // Khi cần học lại từ đầu, mở Console và chạy: vocabBlasterResetMemory()
  window.vocabBlasterResetMemory=()=>{
    localStorage.removeItem(MEMORY_STORAGE_KEY);
    for(const m of ["typing","en-vi","vi-en","custom-mixed"]) localStorage.removeItem(MEMORY_TURN_KEY_PREFIX+m);
    game.memory={}; game.memoryTurn=0; game.focusCramKey=""; game.usedBag=[];
    toast("🧠 Đã xóa tiến độ ghi nhớ");
  };

  loadSaved();loadAccessConfig();resize();typingUI();requestAnimationFrame(loop);
})();
