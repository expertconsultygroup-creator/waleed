import type { T } from "./i18n/use-t";

/* References travel in the API's own notation ("112:1", "hadeethenc:4560").
   Readers see them named: the surah and its ayat, or the hadith's number. */

const SURAH_AR = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس",
];

const SURAH_EN = [
  "Al-Fātiḥah", "Al-Baqarah", "Āl ʿImrān", "An-Nisāʾ", "Al-Māʾidah", "Al-Anʿām", "Al-Aʿrāf", "Al-Anfāl", "At-Tawbah", "Yūnus",
  "Hūd", "Yūsuf", "Ar-Raʿd", "Ibrāhīm", "Al-Ḥijr", "An-Naḥl", "Al-Isrāʾ", "Al-Kahf", "Maryam", "Ṭā-Hā",
  "Al-Anbiyāʾ", "Al-Ḥajj", "Al-Muʾminūn", "An-Nūr", "Al-Furqān", "Ash-Shuʿarāʾ", "An-Naml", "Al-Qaṣaṣ", "Al-ʿAnkabūt", "Ar-Rūm",
  "Luqmān", "As-Sajdah", "Al-Aḥzāb", "Sabaʾ", "Fāṭir", "Yā-Sīn", "Aṣ-Ṣāffāt", "Ṣād", "Az-Zumar", "Ghāfir",
  "Fuṣṣilat", "Ash-Shūrā", "Az-Zukhruf", "Ad-Dukhān", "Al-Jāthiyah", "Al-Aḥqāf", "Muḥammad", "Al-Fatḥ", "Al-Ḥujurāt", "Qāf",
  "Adh-Dhāriyāt", "Aṭ-Ṭūr", "An-Najm", "Al-Qamar", "Ar-Raḥmān", "Al-Wāqiʿah", "Al-Ḥadīd", "Al-Mujādilah", "Al-Ḥashr", "Al-Mumtaḥanah",
  "Aṣ-Ṣaff", "Al-Jumuʿah", "Al-Munāfiqūn", "At-Taghābun", "Aṭ-Ṭalāq", "At-Taḥrīm", "Al-Mulk", "Al-Qalam", "Al-Ḥāqqah", "Al-Maʿārij",
  "Nūḥ", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyāmah", "Al-Insān", "Al-Mursalāt", "An-Nabaʾ", "An-Nāziʿāt", "ʿAbasa",
  "At-Takwīr", "Al-Infiṭār", "Al-Muṭaffifīn", "Al-Inshiqāq", "Al-Burūj", "Aṭ-Ṭāriq", "Al-Aʿlā", "Al-Ghāshiyah", "Al-Fajr", "Al-Balad",
  "Ash-Shams", "Al-Layl", "Aḍ-Ḍuḥā", "Ash-Sharḥ", "At-Tīn", "Al-ʿAlaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-ʿĀdiyāt",
  "Al-Qāriʿah", "At-Takāthur", "Al-ʿAṣr", "Al-Humazah", "Al-Fīl", "Quraysh", "Al-Māʿūn", "Al-Kawthar", "Al-Kāfirūn", "An-Naṣr",
  "Al-Masad", "Al-Ikhlāṣ", "Al-Falaq", "An-Nās",
];

const QURAN = /^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;
const HADITH = /^hadeethenc:(\d{1,10})$/i;

/* The reference in words, in the reader's language. Anything unrecognised is
   returned as given. */
export function formatReference(t: T, reference: string | null | undefined): string {
  const raw = String(reference ?? "").trim();
  const hadith = HADITH.exec(raw);
  if (hadith) return t("ref.hadith", { n: t.number(Number(hadith[1]), { useGrouping: false }) });
  const quran = QURAN.exec(raw);
  if (quran) {
    const surah = Number(quran[1]);
    if (surah < 1 || surah > 114) return raw;
    const num = (v: string) => t.number(Number(v), { useGrouping: false });
    const ayat = quran[3] ? `${num(quran[2])}–${num(quran[3])}` : num(quran[2]);
    return t.lang === "ar" ? `${SURAH_AR[surah - 1]}: ${ayat}` : `${SURAH_EN[surah - 1]} ${num(quran[1])}:${ayat}`;
  }
  return raw;
}

/* What a reader types, in the API's notation: Arabic-Indic digits read as
   digits, and a bare hadith number taken as its HadeethEnc record. */
export function toApiReference(sourceType: string, value: string): string {
  const text = value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s*[:：]\s*/g, ":")
    .replace(/\s*[-–—]\s*/g, "-");
  if (sourceType === "hadith" && /^\d{1,10}$/.test(text)) return `hadeethenc:${text}`;
  return text;
}
