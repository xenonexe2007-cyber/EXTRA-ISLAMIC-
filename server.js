const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const crypto = require("crypto");
const path = require("path");

const TOKEN = (process.env.BOT_TOKEN || "").trim();
const WEBAPP_URL = (process.env.WEBAPP_URL || "").trim();
const PORT = Number(process.env.PORT || 10000);
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!TOKEN) {
  console.error("Missing BOT_TOKEN environment variable.");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

function validTelegramInitData(initData) {
  if (!initData || typeof initData !== "string") return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !Number.isFinite(authDate)) return false;

  // Reject stale initData older than 24 hours.
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 86400) return false;

  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key !== "hash") pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(calculatedHash, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

// Mini App user verification endpoint. Public prayer/Quran data remains available without Telegram auth.
app.post("/api/telegram-auth", (req, res) => {
  const initData = req.body && req.body.initData;
  if (!validTelegramInitData(initData)) {
    return res.status(401).json({ ok: false, error: "Telegram session could not be verified." });
  }
  const params = new URLSearchParams(initData);
  let user = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch {}
  return res.json({ ok: true, user: user ? { id: user.id, first_name: user.first_name || "" } : null });
});

const CITY_MAP = {
  "Jhenaidah, Bangladesh": { city: "Jhenaidah", country: "Bangladesh", lat: 23.5448, lon: 89.1539 },
  "Dhaka, Bangladesh": { city: "Dhaka", country: "Bangladesh", lat: 23.8103, lon: 90.4125 },
  "Chattogram, Bangladesh": { city: "Chittagong", country: "Bangladesh", lat: 22.3569, lon: 91.7832 },
  "Khulna, Bangladesh": { city: "Khulna", country: "Bangladesh", lat: 22.8456, lon: 89.5403 },
  "Rajshahi, Bangladesh": { city: "Rajshahi", country: "Bangladesh", lat: 24.3745, lon: 88.6042 },
  "Sylhet, Bangladesh": { city: "Sylhet", country: "Bangladesh", lat: 24.8949, lon: 91.8687 },
  "Barishal, Bangladesh": { city: "Barisal", country: "Bangladesh", lat: 22.7010, lon: 90.3535 },
  "Rangpur, Bangladesh": { city: "Rangpur", country: "Bangladesh", lat: 25.7439, lon: 89.2752 },
  "Mymensingh, Bangladesh": { city: "Mymensingh", country: "Bangladesh", lat: 24.7471, lon: 90.4203 }
};

app.get("/api/cities", (req, res) => res.json(Object.keys(CITY_MAP)));

app.get("/api/prayer", async (req, res) => {
  const cityKey = String(req.query.city || "Jhenaidah, Bangladesh");
  const city = CITY_MAP[cityKey];
  if (!city) return res.status(400).json({ error: "Choose a city from the list." });

  // Build the requested date in Bangladesh local time, regardless of Render's server timezone.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", day: "2-digit", month: "2-digit", year: "numeric"
  }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const date = `${part.day}-${part.month}-${part.year}`;
  try {
    // Method 1 = University of Islamic Sciences, Karachi; widely used in South Asia.
    const url = new URL(`https://api.aladhan.com/v1/timings/${date}`);
    url.searchParams.set("latitude", city.lat);
    url.searchParams.set("longitude", city.lon);
    url.searchParams.set("method", "1");
    url.searchParams.set("school", "1"); // Hanafi Asr
    url.searchParams.set("timezonestring", "Asia/Dhaka");
    const response = await fetch(url, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("Prayer time provider returned an error.");
    const json = await response.json();
    if (json.code !== 200 || !json.data || !json.data.timings) throw new Error("Invalid prayer time response.");
    res.set("Cache-Control", "public, max-age=900");
    res.json({
      city: cityKey,
      date: json.data.date,
      timings: json.data.timings,
      method: "University of Islamic Sciences, Karachi (method 1), Hanafi Asr",
      note: "Calculated timings may differ from your local mosque. Confirm with the local mosque or Bangladesh Islamic Foundation timetable."
    });
  } catch (err) {
    console.error("Prayer API:", err.message);
    res.status(502).json({ error: "নামাজের সময় আনা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।" });
  }
});

app.get("/api/quran/surahs", async (req, res) => {
  try {
    const r = await fetch("https://api.alquran.cloud/v1/surah", { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("Quran API error");
    const data = await r.json();
    res.set("Cache-Control", "public, max-age=86400");
    res.json(data.data || []);
  } catch {
    res.status(502).json({ error: "কুরআনের তালিকা লোড করা যায়নি।" });
  }
});

app.get("/api/quran/surah/:number", async (req, res) => {
  const n = Number(req.params.number);
  if (!Number.isInteger(n) || n < 1 || n > 114) return res.status(400).json({ error: "Invalid surah number." });
  try {
    const url = `https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,bn.bengali`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("Quran API error");
    const data = await r.json();
    if (data.code !== 200) throw new Error("Quran API response error");
    res.set("Cache-Control", "public, max-age=86400");
    res.json(data.data);
  } catch {
    res.status(502).json({ error: "এই সূরাটি এখন লোড করা যাচ্ছে না।" });
  }
});

app.get("/health", (req, res) => res.status(200).send("EXTRA ISLAMIC OK"));

bot.onText(/^\/start(?:\s|$)/, async (msg) => {
  const chatId = msg.chat.id;
  const text = "🕌 স্বাগতম EXTRA ISLAMIC-এ!\n\nনামাজের সময়, আল-কুরআন, কিবলা, তসবিহ ও দোয়া দেখতে নিচের বাটনে চাপ দিন।\n\nWelcome to EXTRA ISLAMIC. Open the Islamic dashboard below.";
  const reply_markup = WEBAPP_URL
    ? { inline_keyboard: [[{ text: "🕌 Open EXTRA ISLAMIC", web_app: { url: WEBAPP_URL } }]] }
    : { inline_keyboard: [[{ text: "🌐 Open dashboard", url: "https://core.telegram.org/bots/webapps" }]] };
  await bot.sendMessage(chatId, text, { reply_markup });
});

bot.on("polling_error", (err) => console.error("Telegram polling error:", err.message));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EXTRA ISLAMIC listening on ${PORT}`);
  if (!WEBAPP_URL) console.warn("WEBAPP_URL is not set; /start Mini App button will use a setup link.");
});
