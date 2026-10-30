export type LangCode = "tr" | "en" | "de" | "fr" | "ar";

export const translations: Record<string, Record<LangCode, string>> = {
  home: { tr: "Ana Sayfa", en: "Home", de: "Startseite", fr: "Accueil", ar: "الرئيسية" },
  signalTerminal: { tr: "Sinyal Terminali", en: "Signal Terminal", de: "Signalterminal", fr: "Terminal de signaux", ar: "طرف الإشارات" },
  performance: { tr: "Performans", en: "Performance", de: "Leistung", fr: "Performance", ar: "الأداء" },
  whaleRadar: { tr: "Whale Radar", en: "Whale Radar", de: "Wal-Radar", fr: "Radar Baleine", ar: "رادار الحيتان" },
  exchangeCompare: { tr: "Borsa Karşılaştır", en: "Exchange Compare", de: "Börsenvergleich", fr: "Comparaison d’échange", ar: "مقارنة البورصات" },
  pricing: { tr: "Fiyatlandırma", en: "Pricing", de: "Preise", fr: "Tarification", ar: "التسعير" },
  marketStatus: { tr: "Piyasa Durumu", en: "Market Status", de: "Marktstatus", fr: "État du marché", ar: "حالة السوق" },
  livePrice: { tr: "Canlı Fiyat / Fark", en: "Live Price / Change", de: "Live-Preis / Änderung", fr: "Prix en direct / Variation", ar: "السعر المباشر / التغيير" },
  signals: { tr: "Sinyaller", en: "Signals", de: "Signale", fr: "Signaux", ar: "الإشارات" },
  all: { tr: "Hepsi", en: "All", de: "Alle", fr: "Tous", ar: "الكل" },
  open: { tr: "açık", en: "open", de: "offen", fr: "ouvert", ar: "مفتوح" },
  total: { tr: "toplam", en: "total", de: "gesamt", fr: "total", ar: "المجموع" },
  entry: { tr: "Giriş", en: "Entry", de: "Eintrag", fr: "Entrée", ar: "الدخول" },
  target: { tr: "Hedef", en: "Target", de: "Ziel", fr: "Cible", ar: "الهدف" },
  stop: { tr: "Stop", en: "Stop", de: "Stop", fr: "Stop", ar: "الإيقاف" },
  score: { tr: "Skor", en: "Score", de: "Punktzahl", fr: "Score", ar: "النتيجة" },
  detail: { tr: "Detay", en: "Details", de: "Details", fr: "Détails", ar: "التفاصيل" },
  hideDetail: { tr: "Detayları gizle", en: "Hide Details", de: "Details ausblenden", fr: "Masquer les détails", ar: "إخفاء التفاصيل" },
  waiting: { tr: "Bekliyor", en: "Waiting", de: "Warten", fr: "En attente", ar: "قيد الانتظار" },
  hit: { tr: "Tuttu", en: "Hit", de: "Treffer", fr: "Atteint", ar: "نجح" },
  missed: { tr: "Tutmadı", en: "Missed", de: "Verpasst", fr: "Manqué", ar: "فشل" },
  logout: { tr: "Çıkış Yap", en: "Logout", de: "Abmelden", fr: "Déconnexion", ar: "تسجيل الخروج" },
  signIn: { tr: "Giriş Yap", en: "Sign In", de: "Anmelden", fr: "Se connecter", ar: "تسجيل الدخول" },
  password: { tr: "Şifre", en: "Password", de: "Passwort", fr: "Mot de passe", ar: "كلمة المرور" },
  email: { tr: "E-posta", en: "Email", de: "E-Mail", fr: "E-mail", ar: "البريد الإلكتروني" },
  forgotPassword: { tr: "Şifremi Unuttum", en: "Forgot Password", de: "Passwort vergessen", fr: "Mot de passe oublié", ar: "نسيت كلمة المرور" },
  register: { tr: "Kayıt Ol", en: "Register", de: "Registrieren", fr: "S'inscrire", ar: "التسجيل" },
  loginTitle: { tr: "Giriş", en: "Login", de: "Anmeldung", fr: "Connexion", ar: "تسجيل الدخول" },
  signalTime: { tr: "Sinyal zamanı", en: "Signal time", de: "Signalzeit", fr: "Heure du signal", ar: "وقت الإشارة" },
  loading: { tr: "Yükleniyor", en: "Loading", de: "Lädt", fr: "Chargement", ar: "جارٍ التحميل" },
  noData: { tr: "Henüz veri yok", en: "No data yet", de: "Noch keine Daten", fr: "Aucune donnée pour l’instant", ar: "لا توجد بيانات بعد" },
  refreshInSeconds: { tr: "Sayfa 30 saniyede bir otomatik yenilenir", en: "The page refreshes automatically every 30 seconds", de: "Die Seite wird alle 30 Sekunden automatisch aktualisiert", fr: "La page se rafraîchit automatiquement toutes les 30 secondes", ar: "تتجدد الصفحة تلقائيًا كل 30 ثانية" },
  latestSignals: { tr: "Son Sinyaller", en: "Latest Signals", de: "Neueste Signale", fr: "Derniers signaux", ar: "أحدث الإشارات" },
  noSignals: { tr: "Şu an gösterilecek sinyal yok", en: "No signals to show right now", de: "Derzeit keine Signale zum Anzeigen", fr: "Aucun signal à afficher pour le moment", ar: "لا توجد إشارات لعرضها الآن" },
  noOpenSignals: { tr: "Şu an açık sinyal yok.", en: "No open signals right now.", de: "Derzeit keine offenen Signale.", fr: "Aucun signal ouvert pour le moment.", ar: "لا توجد إشارات مفتوحة الآن." },
  homePage: { tr: "Ana Sayfa", en: "Home", de: "Startseite", fr: "Accueil", ar: "الرئيسية" },
  terminal: { tr: "Terminal", en: "Terminal", de: "Terminal", fr: "Terminal", ar: "الطرفية" },
  period: { tr: "Dönem:", en: "Period:", de: "Zeitraum:", fr: "Période:", ar: "الفترة:" },
  lastDays: { tr: "Son {n} Gün", en: "Last {n} Days", de: "Letzte {n} Tage", fr: "Derniers {n} jours", ar: "آخر {n} أيام" },
  accuracyRate: { tr: "İsabet Oranı", en: "Accuracy Rate", de: "Trefferquote", fr: "Taux de réussite", ar: "معدل النجاح" },
  totalSignals: { tr: "Toplam Sinyal", en: "Total Signals", de: "Signale insgesamt", fr: "Total des signaux", ar: "إجمالي الإشارات" },
  hitYes: { tr: "Tuttu ✅", en: "Hit ✅", de: "Treffer ✅", fr: "Atteint ✅", ar: "نجح ✅" },
  missedNo: { tr: "Tutmadı ❌", en: "Missed ❌", de: "Verpasst ❌", fr: "Manqué ❌", ar: "فشل ❌" },
  noSignalYet: { tr: "Henüz sinyal yok.", en: "No signals yet.", de: "Noch keine Signale.", fr: "Aucun signal pour le moment.", ar: "لا توجد إشارات بعد." },
  whaleDescription: { tr: "Kripto piyasasında $250.000 üstü tekil işlemleri canlı takip eder — kimseyi hedef almaz, sadece büyük paranın nereye gittiğini gösterir.", en: "Tracks large single trades over $250,000 in real time — no targeting, only showing where large capital is moving.", de: "Verfolgt Einzeltransaktionen über $250.000 in Echtzeit — kein Targeting, nur die Bewegungen großer Kapitalien.", fr: "Suit les transactions unitaires supérieures à 250 000 $ en temps réel — pas de ciblage, seulement la direction du gros capital.", ar: "يتتبع الصفقات الفردية فوق 250,000 دولار في الوقت الفعلي — دون استهداف، فقط يظهر أين يتحرك رأس المال الكبير." },
  largeBuy: { tr: "Büyük Alım", en: "Large Buy", de: "Großer Kauf", fr: "Gros achat", ar: "شراء كبير" },
  largeSell: { tr: "Büyük Satım", en: "Large Sell", de: "Großer Verkauf", fr: "Grosse vente", ar: "بيع كبير" },
  exchangeDescription: { tr: "Bybit ve OKX arasındaki anlık fiyat farkını gösterir. Referans amaçlıdır, milisaniyeler içinde değişebilir.", en: "Shows the live price difference between Bybit and OKX. Informational only; it can change within milliseconds.", de: "Zeigt den Live-Preisunterschied zwischen Bybit und OKX. Nur informativ; er kann innerhalb von Millisekunden ändern.", fr: "Affiche la différence de prix en direct entre Bybit et OKX. À titre informatif seulement ; elle peut changer en millisecondes.", ar: "يعرض الفرق اللحظي في السعر بين Bybit و OKX. للمعلومات فقط؛ قد يتغير خلال milliseconds." },
  largestGap: { tr: "En Büyük Fark", en: "Largest Gap", de: "Größter Unterschied", fr: "Plus grand écart", ar: "أكبر فرق" },
  signalDirection: { tr: "Sinyallerin %{value}'i AL yönünde ({buy} AL · {sell} SAT)", en: "{value}% of signals are bullish ({buy} BUY · {sell} SELL)", de: "{value}% der Signale sind bullish ({buy} KAUF · {sell} VERKAUF)", fr: "{value}% des signaux sont haussiers ({buy} ACHAT · {sell} VENTE)", ar: "{value}% من الإشارات صعودية ({buy} شراء · {sell} بيع)" },
  trackedCoin: { tr: "İzlenen coin", en: "Tracked coin", de: "Verfolgte Münze", fr: "Pièce suivie", ar: "العملة المتتبعة" },
  openSignal: { tr: "Açık sinyal", en: "Open signal", de: "Offenes Signal", fr: "Signal ouvert", ar: "إشارة مفتوحة" },
  priceWaiting: { tr: "Fiyat verisi bekleniyor…", en: "Waiting for price data…", de: "Warten auf Preisdaten…", fr: "En attente des données de prix…", ar: "في انتظار بيانات السعر…" },
  noSignalsAvailable: { tr: "Şu an gösterilecek sinyal yok. Yeni sinyaller geldikçe burada listelenecek.", en: "There are no signals to display right now. New signals will appear here as they arrive.", de: "Derzeit gibt es keine anzuzeigenden Signale. Neue Signale werden hier angezeigt, sobald sie eintreffen.", fr: "Il n’y a aucun signal à afficher pour le moment. Les nouveaux signaux apparaîtront ici dès leur arrivée.", ar: "لا توجد إشارات لعرضها الآن. ستظهر الإشارات الجديدة هنا عند وصولها." },
  indicatorsLoading: { tr: "Göstergeler hesaplanıyor…", en: "Calculating indicators…", de: "Indikatoren werden berechnet…", fr: "Calcul des indicateurs…", ar: "جارٍ حساب المؤشرات…" },
  detailDataError: { tr: "Detay verisi şu an alınamadı.", en: "Detail data could not be retrieved right now.", de: "Detaildaten konnten gerade nicht abgerufen werden.", fr: "Les données détaillées n’ont pas pu être récupérées pour le moment.", ar: "تعذر الحصول على بيانات التفاصيل الآن." },
  panelDisclaimer: { tr: "Bu panel otomatik işlem açmaz; yalnızca teknik analiz ve sinyal gösterir. Yatırım tavsiyesi değildir.", en: "This panel does not open trades automatically; it only shows technical analysis and signals. It is not investment advice.", de: "Dieses Panel eröffnet keine Trades automatisch; es zeigt nur technische Analysen und Signale. Es ist keine Anlageberatung.", fr: "Ce panneau n’ouvre pas automatiquement de positions; il montre uniquement l’analyse technique et les signaux. Ce n’est pas un conseil d’investissement.", ar: "لا يفتح هذا اللوح الصفقات تلقائيًا؛ بل يظهر التحليل الفني والإشارات فقط. هذا ليس نصيحة استثمارية." },
  keltosRadar: { tr: "KELTOŞ Radar", en: "KELTOŞ Radar", de: "KELTOŞ Radar", fr: "KELTOŞ Radar", ar: "رادار KELTOŞ" },
  language: { tr: "Dil", en: "Language", de: "Sprache", fr: "Langue", ar: "اللغة" },
  buy: { tr: "AL", en: "BUY", de: "KAUF", fr: "ACHAT", ar: "شراء" },
  sell: { tr: "SAT", en: "SELL", de: "VERKAUF", fr: "VENTE", ar: "بيع" },
  trackedCoins: { tr: "İzlenen coin", en: "Tracked coins", de: "Verfolgte Münzen", fr: "Pièces suivies", ar: "العملات المتتبعة" },
  openPosition: { tr: "Açık pozisyon", en: "Open position", de: "Offene Position", fr: "Position ouverte", ar: "مركز مفتوح" },
  about: { tr: "Hakkında", en: "About", de: "Über", fr: "À propos", ar: "حول" },
  price: { tr: "Fiyat", en: "Price", de: "Preis", fr: "Prix", ar: "السعر" },
  change: { tr: "Fark", en: "Change", de: "Änderung", fr: "Variation", ar: "التغيير" },
};

export function getLang(): LangCode {
  if (typeof window === "undefined") return "tr";
  const saved = window.localStorage.getItem("keltos_lang");
  if (saved === "tr" || saved === "en" || saved === "de" || saved === "fr" || saved === "ar") {
    return saved;
  }
  return "tr";
}

export function setLangStorage(lang: LangCode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("keltos_lang", lang);
  }
}

export function getTranslation(key: string, lang: LangCode = getLang()) {
  return translations[key]?.[lang] || key;
}
