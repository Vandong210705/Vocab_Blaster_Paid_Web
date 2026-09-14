const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_KEY = "vandong123";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "change-this-token-secret";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "change-this-webhook-secret";
const SEPAY_WEBHOOK_SECRET = process.env.SEPAY_WEBHOOK_SECRET || "";

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const CFG_FILE = path.join(ROOT, "config.json");
const PAY_FILE = path.join(DATA, "payments.json");

fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(PAY_FILE)) fs.writeFileSync(PAY_FILE, "[]");

const defaultConfig = {
  priceVnd: 1000,
  accessMode: "permanent",
  playMinutes: 60,
  freePlay: true,
  bankName: "",
  bankAccount: "",
  bankAccountName: ""
};
if (!fs.existsSync(CFG_FILE)) fs.writeFileSync(CFG_FILE, JSON.stringify(defaultConfig, null, 2));

function readJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return fallback } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)) }
function config() { return { ...defaultConfig, ...readJSON(CFG_FILE, {}) } }
function payments() { return readJSON(PAY_FILE, []) }
function savePayments(x) { writeJSON(PAY_FILE, x) }
function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
function readBodyText(req) { return new Promise((resolve, reject) => { let s = ""; req.on("data", c => { s += c; if (s.length > 1e6) req.destroy() }); req.on("end", () => resolve(s)); req.on("error", reject) }) }
async function bodyJSON(req) { const s = await readBodyText(req); return s ? JSON.parse(s) : {} }
function randomId() { return crypto.randomBytes(6).toString("hex").toUpperCase() }
function hmac(s) { return crypto.createHmac("sha256", TOKEN_SECRET).update(s).digest("base64url") }
function makeToken(paymentId, exp, permanent = false) {
  const payload = Buffer.from(JSON.stringify({ paymentId, exp: exp ?? null, permanent: !!permanent })).toString("base64url");
  return payload + "." + hmac(payload);
}
function verifyToken(token) {
  try {
    const [payload, sig] = String(token || "").split(".");
    if (!payload || !sig) return false;
    const a = Buffer.from(sig), b = Buffer.from(hmac(payload));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.permanent === true) return true;
    return Number(data.exp) > Date.now();
  } catch { return false }
}

function normalizeBankName(name) {
  return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
const BANK_IDS = {
  vietcombank: "970436", vcb: "970436",
  vietinbank: "970415", ctg: "970415",
  bidv: "970418",
  agribank: "970405", vba: "970405",
  mbbank: "970422", mb: "970422",
  techcombank: "970407", tcb: "970407",
  acb: "970416",
  vpbank: "970432",
  tpbank: "970423",
  sacombank: "970403", stb: "970403",
  vib: "970441",
  shb: "970443",
  ocb: "970448",
  msb: "970426"
};
function resolveBankId(name) {
  return BANK_IDS[normalizeBankName(name)] || "";
}
function buildVietQr(c, amount, note) {
  const bankId = resolveBankId(c.bankName);
  if (!bankId || !c.bankAccount) return "";
  const acc = encodeURIComponent(String(c.bankAccount).replace(/\s+/g, ""));
  const q = new URLSearchParams({
    amount: String(Number(amount) || 0),
    addInfo: String(note || ""),
    accountName: String(c.bankAccountName || "")
  });
  return `https://img.vietqr.io/image/${bankId}-${acc}-compact2.png?${q.toString()}`;
}
function publicConfig() {
  const c = config();
  return {
    priceVnd: c.priceVnd,
    accessMode: c.accessMode === "minutes" ? "minutes" : "permanent",
    playMinutes: c.playMinutes,
    freePlay: !!c.freePlay,
    bankName: c.bankName,
    bankAccount: c.bankAccount,
    bankAccountName: c.bankAccountName,
    supportQrUrl: buildVietQr(c, c.priceVnd, "UNGHO VOCAB")
  };
}
function paymentPublic(p, c) {
  return {
    id: p.id, status: p.status, amount: p.amount, note: p.note,
    accessMode: p.accessMode || c.accessMode || "permanent",
    playMinutes: p.playMinutes || c.playMinutes || 60,
    bankName: c.bankName, bankAccount: c.bankAccount, bankAccountName: c.bankAccountName,
    qrUrl: buildVietQr(c, p.amount, p.note)
  };
}
function grantAccess(p, c = config()) {
  const mode = (p.accessMode || c.accessMode) === "minutes" ? "minutes" : "permanent";
  p.accessMode = mode;
  if (mode === "permanent") {
    p.accessPermanent = true;
    p.accessExpiresAt = null;
  } else {
    const mins = Math.max(1, Math.round(Number(p.playMinutes || c.playMinutes || 60)));
    p.playMinutes = mins;
    p.accessPermanent = false;
    if (!p.accessExpiresAt) p.accessExpiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();
  }
}
function tokenForPayment(p) {
  if (p.accessPermanent === true || p.accessMode === "permanent") return makeToken(p.id, null, true);
  const exp = Date.parse(p.accessExpiresAt || "");
  if (Number.isFinite(exp) && exp > Date.now()) return makeToken(p.id, exp, false);
  return null;
}
function mime(p) { return { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" }[path.extname(p).toLowerCase()] || "application/octet-stream" }
function serveStatic(req, res, url) { let rel = decodeURIComponent(url.pathname); if (rel === "/") rel = "/index.html"; const file = path.normalize(path.join(PUBLIC, rel)); if (!file.startsWith(PUBLIC)) return send(res, 403, { error: "Forbidden" }); fs.stat(file, (err, st) => { if (err || !st.isFile()) return send(res, 404, { error: "Not found" }); res.writeHead(200, { "Content-Type": mime(file) }); fs.createReadStream(file).pipe(res) }) }

function safeEqual(a, b) { const A = Buffer.from(String(a || "")), B = Buffer.from(String(b || "")); return A.length === B.length && crypto.timingSafeEqual(A, B) }
function verifySepayHmac(raw, req) {
  if (!SEPAY_WEBHOOK_SECRET) return true; // cho test; production nên luôn đặt secret
  const signature = req.headers["x-sepay-signature"] || "";
  const timestamp = Number(req.headers["x-sepay-timestamp"] || 0);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", SEPAY_WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest("hex");
  return safeEqual(signature, expected);
}
function handleIncomingBankTransaction(payload) {
  const type = String(payload.transferType ?? payload.transfer_type ?? "").toLowerCase();
  if (type !== "in" && type !== "credit") return { matched: false, reason: "not incoming" };
  const amount = Number(payload.transferAmount ?? payload.amount ?? 0);
  const content = String(payload.content ?? payload.transaction_content ?? "");
  const code = String(payload.code ?? payload.payment_code ?? "");
  const txid = String(payload.id ?? payload.transaction_id ?? payload.referenceCode ?? payload.reference_code ?? "");
  const ps = payments();
  if (txid && ps.some(p => String(p.sepayTransactionId || "") === txid)) return { matched: true, duplicate: true };
  const pending = ps.find(p => p.status === "pending" && Number(p.amount) === amount && (code === p.note || content.toLowerCase().includes(String(p.note).toLowerCase())));
  if (!pending) return { matched: false, reason: "no pending payment" };
  pending.status = "paid"; pending.paidAt = new Date().toISOString(); pending.sepayTransactionId = txid || null; pending.bankGateway = payload.gateway ?? payload.bank_brand_name ?? null; grantAccess(pending, config()); savePayments(ps);
  return { matched: true, id: pending.id };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
    if (req.method === "GET" && url.pathname === "/api/config") return send(res, 200, publicConfig());

    if (req.method === "POST" && url.pathname === "/api/payment/create") {
      const c = config();
      if (c.freePlay) return send(res, 200, { freePlay: true });
      if (Number(c.priceVnd) <= 0) return send(res, 400, { error: "Giá thanh toán chưa hợp lệ" });
      if (!c.bankAccount || !resolveBankId(c.bankName)) return send(res, 400, { error: "Admin chưa cấu hình đúng ngân hàng hoặc số tài khoản" });
      const id = randomId(), now = Date.now();
      const mode = c.accessMode === "minutes" ? "minutes" : "permanent";
      const mins = Math.max(1, Math.round(Number(c.playMinutes || 60)));
      const p = {
        id,
        amount: Number(c.priceVnd),
        note: `VOCAB${id}`,
        status: "pending",
        accessMode: mode,
        playMinutes: mins,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
        paidAt: null
      };
      const ps = payments(); ps.unshift(p); savePayments(ps);
      return send(res, 200, paymentPublic(p, c));
    }

    if (req.method === "GET" && url.pathname === "/api/payment/status") {
      const id = url.searchParams.get("id"), c = config(), ps = payments(), p = ps.find(x => x.id === id);
      if (!p) return send(res, 404, { error: "Không tìm thấy giao dịch" });
      if (p.status === "paid" && p.accessPermanent !== true && !p.accessExpiresAt) {
        grantAccess(p, c); savePayments(ps);
      }
      const out = paymentPublic(p, c);
      if (p.status === "paid") {
        const token = tokenForPayment(p);
        if (token) out.token = token;
      }
      return send(res, 200, out);
    }

    if (req.method === "GET" && url.pathname === "/api/access/verify") return send(res, 200, { valid: verifyToken(url.searchParams.get("token")) });

    if (req.method === "GET" && url.pathname === "/api/admin/config") {
      if (url.searchParams.get("key") !== ADMIN_KEY) return send(res, 401, { error: "Sai ADMIN_KEY" });
      return send(res, 200, { ...config(), sepayWebhookReady: !!SEPAY_WEBHOOK_SECRET });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/config") {
      const b = await bodyJSON(req);
      if (b.key !== ADMIN_KEY) return send(res, 401, { error: "Sai ADMIN_KEY" });
      const c = config();

      if (typeof b.bankName === "string") c.bankName = b.bankName.trim();
      if (typeof b.bankAccount === "string") c.bankAccount = b.bankAccount.trim();
      if (typeof b.bankAccountName === "string") c.bankAccountName = b.bankAccountName.trim();
      if (Number.isFinite(Number(b.priceVnd)) && Number(b.priceVnd) >= 0) c.priceVnd = Math.round(Number(b.priceVnd));

      c.accessMode = b.accessMode === "minutes" ? "minutes" : "permanent";
      if (c.accessMode === "minutes") {
        if (!Number.isFinite(Number(b.playMinutes)) || Number(b.playMinutes) < 1) return send(res, 400, { error: "Số phút phải từ 1 trở lên" });
        c.playMinutes = Math.round(Number(b.playMinutes));
      } else {
        c.playMinutes = Math.max(1, Math.round(Number(c.playMinutes || 60)));
      }

      c.freePlay = !!b.freePlay;
      delete c.bankId;
      delete c.paymentNotePrefix;
      writeJSON(CFG_FILE, c);
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/qr-preview") {
      const b = await bodyJSON(req);
      if (b.key !== ADMIN_KEY) return send(res, 401, { error: "Sai ADMIN_KEY" });
      const c = {
        bankName: String(b.bankName || "").trim(),
        bankAccount: String(b.bankAccount || "").trim(),
        bankAccountName: String(b.bankAccountName || "").trim()
      };
      const bankId = resolveBankId(c.bankName);
      if (!bankId) return send(res, 400, { error: "Chưa nhận diện được ngân hàng. Hãy nhập tên như Vietcombank, BIDV, MBBank, Techcombank..." });
      if (!c.bankAccount) return send(res, 400, { error: "Chưa nhập số tài khoản" });
      const amount = Math.max(0, Math.round(Number(b.priceVnd) || 0));
      const qrUrl = buildVietQr(c, amount, "VOCABTEST");
      return send(res, 200, { qrUrl, bankName: c.bankName, bankAccount: c.bankAccount, bankAccountName: c.bankAccountName, amount });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/payments") {
      if (url.searchParams.get("key") !== ADMIN_KEY) return send(res, 401, { error: "Sai ADMIN_KEY" });
      return send(res, 200, payments().slice(0, 200));
    }

    if (req.method === "POST" && url.pathname === "/api/admin/approve") {
      const b = await bodyJSON(req); if (b.key !== ADMIN_KEY) return send(res, 401, { error: "Sai ADMIN_KEY" });
      const ps = payments(), p = ps.find(x => x.id === b.id); if (!p) return send(res, 404, { error: "Không tìm thấy giao dịch" });
      p.status = "paid"; p.paidAt = new Date().toISOString(); grantAccess(p, config()); savePayments(ps); return send(res, 200, { ok: true });
    }

    // Webhook thật cho SePay. Production nên đặt SEPAY_WEBHOOK_SECRET và chọn HMAC-SHA256 trên SePay.
    if (req.method === "POST" && url.pathname === "/api/payment/sepay") {
      const raw = await readBodyText(req);
      if (!verifySepayHmac(raw, req)) return send(res, 401, { success: false, message: "Invalid SePay signature" });
      let payload; try { payload = raw ? JSON.parse(raw) : {} } catch { return send(res, 400, { success: false, message: "Invalid JSON" }) }
      handleIncomingBankTransaction(payload);
      return send(res, 200, { success: true });
    }

    // Webhook generic cũ vẫn giữ để test nội bộ/manual automation.
    if (req.method === "POST" && url.pathname === "/api/payment/webhook") {
      const b = await bodyJSON(req); if (b.secret !== WEBHOOK_SECRET) return send(res, 401, { error: "Bad webhook secret" });
      const ps = payments(), p = ps.find(x => x.id === String(b.id || "")); if (!p) return send(res, 404, { error: "Payment not found" });
      if (String(b.status).toLowerCase() === "paid" && Number(b.amount) === Number(p.amount)) { p.status = "paid"; p.paidAt = new Date().toISOString(); grantAccess(p, config()); savePayments(ps) }
      return send(res, 200, { ok: true, status: p.status });
    }

    return serveStatic(req, res, url);
  } catch (e) { console.error(e); return send(res, 500, { error: "Server error" }) }
});

server.listen(PORT, HOST, () => {
  console.log(`Vocab Blaster: http://localhost:${PORT}`);
  console.log(`Admin:         http://localhost:${PORT}/admin.html`);
  console.log(`SePay webhook: http://localhost:${PORT}/api/payment/sepay`);
  if (ADMIN_KEY === "change-me-now") console.log("WARNING: Hãy đặt biến môi trường ADMIN_KEY trước khi public.");
  if (!SEPAY_WEBHOOK_SECRET) console.log("WARNING: Chưa đặt SEPAY_WEBHOOK_SECRET; webhook SePay đang ở chế độ test không HMAC.");
});
