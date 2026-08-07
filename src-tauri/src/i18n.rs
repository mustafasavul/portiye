//! Translations for the native menu-bar menu.
//!
//! The window has its own dictionary in `src/locales/`; this covers only the
//! dozen strings the tray draws, because the tray is built in Rust and cannot
//! reach the webview's table. The window pushes its locale here with
//! `set_locale` whenever it changes, and the tray is rebuilt with it.
//!
//! Wording is kept identical to the window's: the shared keys in this file
//! were generated from `src/locales/*.ts`, so "Stop" in the menu bar reads the
//! same as "Stop" in the window.
//!
//! ponytail: one flat table per language and a linear scan over thirteen
//! entries. A `HashMap` behind a `OnceLock` would be a lot of machinery to
//! save nanoseconds on a menu that is rebuilt every five seconds.

use std::sync::Mutex;

/// One language: `(key, string)` pairs, English-key ordered.
type Table = &'static [(&'static str, &'static str)];

const EN: Table = &[
    ("tray.ports", "Ports"),
    ("tray.none", "No listening ports"),
    ("tray.devices", "Devices"),
    ("tray.killAll", "Kill all"),
    ("tray.show", "Open portiye…"),
    ("tray.quit", "Quit"),
    ("tray.launch", "Launch"),
    ("tray.stop", "Stop"),
    ("tray.boot", "Boot"),
    ("tray.shutdown", "Shutdown"),
    ("elevate.macos", "macOS will ask for your password."),
    (
        "elevate.windows",
        "Windows will show a User Account Control prompt.",
    ),
    ("elevate.other", "Your desktop will ask for authentication."),
];

const TR: Table = &[
    ("tray.ports", "Portlar"),
    ("tray.none", "Dinlenen port yok"),
    ("tray.devices", "Cihazlar"),
    ("tray.killAll", "Tümünü sonlandır"),
    ("tray.show", "portiye'yi aç…"),
    ("tray.quit", "Çık"),
    ("tray.launch", "Başlat"),
    ("tray.stop", "Durdur"),
    ("tray.boot", "Aç"),
    ("tray.shutdown", "Kapat"),
    ("elevate.macos", "macOS parolanızı soracak."),
    (
        "elevate.windows",
        "Windows bir Kullanıcı Hesabı Denetimi istemi gösterecek.",
    ),
    ("elevate.other", "Masaüstünüz kimlik doğrulaması isteyecek."),
];

const ES: Table = &[
    ("tray.ports", "Puertos"),
    ("tray.none", "Sin puertos a la escucha"),
    ("tray.devices", "Dispositivos"),
    ("tray.killAll", "Matar todos"),
    ("tray.show", "Abrir portiye…"),
    ("tray.quit", "Salir"),
    ("tray.launch", "Lanzar"),
    ("tray.stop", "Detener"),
    ("tray.boot", "Arrancar"),
    ("tray.shutdown", "Apagar"),
    ("elevate.macos", "macOS te pedirá tu contraseña."),
    (
        "elevate.windows",
        "Windows mostrará un aviso de Control de cuentas de usuario.",
    ),
    ("elevate.other", "Tu escritorio pedirá autenticación."),
];

const PT: Table = &[
    ("tray.ports", "Portas"),
    ("tray.none", "Nenhuma porta escutando"),
    ("tray.devices", "Dispositivos"),
    ("tray.killAll", "Encerrar todos"),
    ("tray.show", "Abrir o portiye…"),
    ("tray.quit", "Sair"),
    ("tray.launch", "Iniciar"),
    ("tray.stop", "Parar"),
    ("tray.boot", "Ligar"),
    ("tray.shutdown", "Desligar"),
    ("elevate.macos", "O macOS vai pedir sua senha."),
    (
        "elevate.windows",
        "O Windows vai exibir um aviso do Controle de Conta de Usuário.",
    ),
    (
        "elevate.other",
        "Sua área de trabalho vai pedir autenticação.",
    ),
];

const DE: Table = &[
    ("tray.ports", "Ports"),
    ("tray.none", "Keine lauschenden Ports"),
    ("tray.devices", "Geräte"),
    ("tray.killAll", "Alle beenden"),
    ("tray.show", "portiye öffnen…"),
    ("tray.quit", "Beenden"),
    ("tray.launch", "Starten"),
    ("tray.stop", "Stoppen"),
    ("tray.boot", "Booten"),
    ("tray.shutdown", "Herunterfahren"),
    ("elevate.macos", "macOS fragt nach deinem Passwort."),
    (
        "elevate.windows",
        "Windows zeigt eine Benutzerkontensteuerung-Abfrage.",
    ),
    (
        "elevate.other",
        "Deine Desktop-Umgebung fragt nach einer Authentifizierung.",
    ),
];

const NL: Table = &[
    ("tray.ports", "Poorten"),
    ("tray.none", "Geen luisterende poorten"),
    ("tray.devices", "Apparaten"),
    ("tray.killAll", "Alles beëindigen"),
    ("tray.show", "portiye openen…"),
    ("tray.quit", "Afsluiten"),
    ("tray.launch", "Starten"),
    ("tray.stop", "Stoppen"),
    ("tray.boot", "Opstarten"),
    ("tray.shutdown", "Afsluiten"),
    ("elevate.macos", "macOS vraagt om je wachtwoord."),
    (
        "elevate.windows",
        "Windows toont een Gebruikersaccountbeheer-melding.",
    ),
    ("elevate.other", "Je bureaublad vraagt om authenticatie."),
];

const RU: Table = &[
    ("tray.ports", "Порты"),
    ("tray.none", "Прослушиваемых портов нет"),
    ("tray.devices", "Устройства"),
    ("tray.killAll", "Завершить все"),
    ("tray.show", "Открыть portiye…"),
    ("tray.quit", "Выход"),
    ("tray.launch", "Запустить"),
    ("tray.stop", "Остановить"),
    ("tray.boot", "Включить"),
    ("tray.shutdown", "Выключить"),
    ("elevate.macos", "macOS запросит ваш пароль."),
    (
        "elevate.windows",
        "Windows покажет запрос контроля учётных записей.",
    ),
    (
        "elevate.other",
        "Ваша рабочая среда запросит аутентификацию.",
    ),
];

const ZH: Table = &[
    ("tray.ports", "端口"),
    ("tray.none", "没有监听端口"),
    ("tray.devices", "设备"),
    ("tray.killAll", "全部结束"),
    ("tray.show", "打开 portiye…"),
    ("tray.quit", "退出"),
    ("tray.launch", "启动"),
    ("tray.stop", "停止"),
    ("tray.boot", "开机"),
    ("tray.shutdown", "关机"),
    ("elevate.macos", "macOS 会要求输入你的密码。"),
    ("elevate.windows", "Windows 会弹出用户账户控制提示。"),
    ("elevate.other", "你的桌面环境会要求进行身份验证。"),
];

const HI: Table = &[
    ("tray.ports", "पोर्ट"),
    ("tray.none", "कोई सुनता पोर्ट नहीं"),
    ("tray.devices", "डिवाइस"),
    ("tray.killAll", "सब बंद करें"),
    ("tray.show", "portiye खोलें…"),
    ("tray.quit", "बाहर निकलें"),
    ("tray.launch", "चालू करें"),
    ("tray.stop", "रोकें"),
    ("tray.boot", "बूट करें"),
    ("tray.shutdown", "बंद करें"),
    ("elevate.macos", "macOS आपका पासवर्ड माँगेगा।"),
    (
        "elevate.windows",
        "Windows एक User Account Control संकेत दिखाएगा।",
    ),
    ("elevate.other", "आपका डेस्कटॉप प्रमाणीकरण माँगेगा।"),
];

const BN: Table = &[
    ("tray.ports", "পোর্ট"),
    ("tray.none", "শোনার মতো কোনো পোর্ট নেই"),
    ("tray.devices", "ডিভাইস"),
    ("tray.killAll", "সব বন্ধ করুন"),
    ("tray.show", "portiye খুলুন…"),
    ("tray.quit", "প্রস্থান"),
    ("tray.launch", "চালু করুন"),
    ("tray.stop", "থামান"),
    ("tray.boot", "বুট করুন"),
    ("tray.shutdown", "বন্ধ করুন"),
    ("elevate.macos", "macOS আপনার পাসওয়ার্ড চাইবে।"),
    (
        "elevate.windows",
        "Windows একটি User Account Control বার্তা দেখাবে।",
    ),
    ("elevate.other", "আপনার ডেস্কটপ পরিচয় যাচাই চাইবে।"),
];

const UR: Table = &[
    ("tray.ports", "پورٹس"),
    ("tray.none", "کوئی سنتا ہوا پورٹ نہیں"),
    ("tray.devices", "ڈیوائسز"),
    ("tray.killAll", "سب بند کریں"),
    ("tray.show", "portiye کھولیں…"),
    ("tray.quit", "باہر نکلیں"),
    ("tray.launch", "چلائیں"),
    ("tray.stop", "روکیں"),
    ("tray.boot", "بوٹ کریں"),
    ("tray.shutdown", "بند کریں"),
    ("elevate.macos", "macOS آپ کا پاس ورڈ مانگے گا۔"),
    (
        "elevate.windows",
        "Windows ایک User Account Control پیغام دکھائے گا۔",
    ),
    ("elevate.other", "آپ کا ڈیسک ٹاپ تصدیق مانگے گا۔"),
];

const AR: Table = &[
    ("tray.ports", "المنافذ"),
    ("tray.none", "لا توجد منافذ مستمعة"),
    ("tray.devices", "الأجهزة"),
    ("tray.killAll", "إنهاء الكل"),
    ("tray.show", "فتح portiye…"),
    ("tray.quit", "خروج"),
    ("tray.launch", "تشغيل"),
    ("tray.stop", "إيقاف"),
    ("tray.boot", "إقلاع"),
    ("tray.shutdown", "إيقاف التشغيل"),
    ("elevate.macos", "سيطلب macOS كلمة المرور الخاصة بك."),
    (
        "elevate.windows",
        "سيعرض Windows مطالبة التحكم في حساب المستخدم.",
    ),
    ("elevate.other", "سيطلب سطح المكتب لديك مصادقة."),
];

const FA: Table = &[
    ("tray.ports", "پورت‌ها"),
    ("tray.none", "هیچ پورتی در حال شنود نیست"),
    ("tray.devices", "دستگاه‌ها"),
    ("tray.killAll", "بستن همه"),
    ("tray.show", "باز کردن portiye…"),
    ("tray.quit", "خروج"),
    ("tray.launch", "اجرا"),
    ("tray.stop", "توقف"),
    ("tray.boot", "روشن کردن"),
    ("tray.shutdown", "خاموش کردن"),
    ("elevate.macos", "macOS رمز عبور شما را می‌خواهد."),
    (
        "elevate.windows",
        "Windows یک پیام User Account Control نشان می‌دهد.",
    ),
    ("elevate.other", "میزکار شما درخواست احراز هویت می‌کند."),
];

const HE: Table = &[
    ("tray.ports", "פורטים"),
    ("tray.none", "אין פורטים מאזינים"),
    ("tray.devices", "מכשירים"),
    ("tray.killAll", "סגירת הכול"),
    ("tray.show", "פתיחת portiye…"),
    ("tray.quit", "יציאה"),
    ("tray.launch", "הפעלה"),
    ("tray.stop", "עצירה"),
    ("tray.boot", "אתחול"),
    ("tray.shutdown", "כיבוי"),
    ("elevate.macos", "macOS יבקש את הסיסמה שלך."),
    ("elevate.windows", "Windows יציג בקשת בקרת חשבון משתמש."),
    ("elevate.other", "שולחן העבודה שלך יבקש אימות."),
];

const ID: Table = &[
    ("tray.ports", "Port"),
    ("tray.none", "Tidak ada port yang mendengarkan"),
    ("tray.devices", "Perangkat"),
    ("tray.killAll", "Hentikan semua"),
    ("tray.show", "Buka portiye…"),
    ("tray.quit", "Keluar"),
    ("tray.launch", "Jalankan"),
    ("tray.stop", "Hentikan"),
    ("tray.boot", "Nyalakan"),
    ("tray.shutdown", "Matikan"),
    ("elevate.macos", "macOS akan meminta kata sandi Anda."),
    (
        "elevate.windows",
        "Windows akan menampilkan permintaan User Account Control.",
    ),
    ("elevate.other", "Desktop Anda akan meminta autentikasi."),
];

const MS: Table = &[
    ("tray.ports", "Port"),
    ("tray.none", "Tiada port yang mendengar"),
    ("tray.devices", "Peranti"),
    ("tray.killAll", "Hentikan semua"),
    ("tray.show", "Buka portiye…"),
    ("tray.quit", "Keluar"),
    ("tray.launch", "Lancarkan"),
    ("tray.stop", "Hentikan"),
    ("tray.boot", "But"),
    ("tray.shutdown", "Tutup"),
    ("elevate.macos", "macOS akan meminta kata laluan anda."),
    (
        "elevate.windows",
        "Windows akan menunjukkan gesaan User Account Control.",
    ),
    ("elevate.other", "Desktop anda akan meminta pengesahan."),
];

const FIL: Table = &[
    ("tray.ports", "Mga Port"),
    ("tray.none", "Walang port na nakikinig"),
    ("tray.devices", "Mga Device"),
    ("tray.killAll", "Ihinto lahat"),
    ("tray.show", "Buksan ang portiye…"),
    ("tray.quit", "Umalis"),
    ("tray.launch", "Buksan"),
    ("tray.stop", "Ihinto"),
    ("tray.boot", "I-boot"),
    ("tray.shutdown", "Patayin"),
    ("elevate.macos", "Hihingin ng macOS ang password mo."),
    (
        "elevate.windows",
        "Magpapakita ang Windows ng User Account Control prompt.",
    ),
    ("elevate.other", "Hihingi ng authentication ang desktop mo."),
];

const VI: Table = &[
    ("tray.ports", "Cổng"),
    ("tray.none", "Không có cổng nào đang lắng nghe"),
    ("tray.devices", "Thiết bị"),
    ("tray.killAll", "Kết thúc tất cả"),
    ("tray.show", "Mở portiye…"),
    ("tray.quit", "Thoát"),
    ("tray.launch", "Khởi chạy"),
    ("tray.stop", "Dừng"),
    ("tray.boot", "Bật"),
    ("tray.shutdown", "Tắt"),
    ("elevate.macos", "macOS sẽ hỏi mật khẩu của bạn."),
    (
        "elevate.windows",
        "Windows sẽ hiện hộp thoại User Account Control.",
    ),
    (
        "elevate.other",
        "Môi trường desktop của bạn sẽ yêu cầu xác thực.",
    ),
];

const TH: Table = &[
    ("tray.ports", "พอร์ต"),
    ("tray.none", "ไม่มีพอร์ตที่กำลังรอรับ"),
    ("tray.devices", "อุปกรณ์"),
    ("tray.killAll", "ปิดทั้งหมด"),
    ("tray.show", "เปิด portiye…"),
    ("tray.quit", "ออก"),
    ("tray.launch", "เปิด"),
    ("tray.stop", "หยุด"),
    ("tray.boot", "บูต"),
    ("tray.shutdown", "ปิดเครื่อง"),
    ("elevate.macos", "macOS จะขอรหัสผ่านของคุณ"),
    ("elevate.windows", "Windows จะแสดงกล่อง User Account Control"),
    ("elevate.other", "เดสก์ท็อปของคุณจะขอการยืนยันตัวตน"),
];

const KK: Table = &[
    ("tray.ports", "Порттар"),
    ("tray.none", "Тыңдап тұрған порт жоқ"),
    ("tray.devices", "Құрылғылар"),
    ("tray.killAll", "Барлығын аяқтау"),
    ("tray.show", "portiye ашу…"),
    ("tray.quit", "Шығу"),
    ("tray.launch", "Іске қосу"),
    ("tray.stop", "Тоқтату"),
    ("tray.boot", "Қосу"),
    ("tray.shutdown", "Сөндіру"),
    ("elevate.macos", "macOS құпия сөзіңізді сұрайды."),
    (
        "elevate.windows",
        "Windows Тіркелгіні басқару сұрауын көрсетеді.",
    ),
    ("elevate.other", "Жұмыс үстеліңіз аутентификация сұрайды."),
];

const UZ: Table = &[
    ("tray.ports", "Portlar"),
    ("tray.none", "Tinglayotgan port yo‘q"),
    ("tray.devices", "Qurilmalar"),
    ("tray.killAll", "Hammasini to‘xtatish"),
    ("tray.show", "portiye ni ochish…"),
    ("tray.quit", "Chiqish"),
    ("tray.launch", "Ishga tushirish"),
    ("tray.stop", "To‘xtatish"),
    ("tray.boot", "Yoqish"),
    ("tray.shutdown", "O‘chirish"),
    ("elevate.macos", "macOS parolingizni so‘raydi."),
    (
        "elevate.windows",
        "Windows User Account Control so‘rovini ko‘rsatadi.",
    ),
    ("elevate.other", "Ish stolingiz autentifikatsiya so‘raydi."),
];

const KY: Table = &[
    ("tray.ports", "Порттор"),
    ("tray.none", "Угуп турган порт жок"),
    ("tray.devices", "Түзмөктөр"),
    ("tray.killAll", "Баарын токтотуу"),
    ("tray.show", "portiye ачуу…"),
    ("tray.quit", "Чыгуу"),
    ("tray.launch", "Иштетүү"),
    ("tray.stop", "Токтотуу"),
    ("tray.boot", "Күйгүзүү"),
    ("tray.shutdown", "Өчүрүү"),
    ("elevate.macos", "macOS сырсөзүңүздү сурайт."),
    (
        "elevate.windows",
        "Windows Каттоо эсебин көзөмөлдөө сурамын көрсөтөт.",
    ),
    ("elevate.other", "Иш столуңуз аутентификация сурайт."),
];

const TK: Table = &[
    ("tray.ports", "Portlar"),
    ("tray.none", "Diňleýän port ýok"),
    ("tray.devices", "Enjamlar"),
    ("tray.killAll", "Ählisini ýap"),
    ("tray.show", "portiye aç…"),
    ("tray.quit", "Çyk"),
    ("tray.launch", "Işlet"),
    ("tray.stop", "Duruz"),
    ("tray.boot", "Aç"),
    ("tray.shutdown", "Öçür"),
    ("elevate.macos", "macOS parolyňyzy soraýar."),
    (
        "elevate.windows",
        "Windows Ulanyjy Hasabyna Gözegçilik soragyny görkezýär.",
    ),
    ("elevate.other", "Iş stoluňyz tassyklama soraýar."),
];

const SW: Table = &[
    ("tray.ports", "Bandari"),
    ("tray.none", "Hakuna bandari inayosikiliza"),
    ("tray.devices", "Vifaa"),
    ("tray.killAll", "Sitisha zote"),
    ("tray.show", "Fungua portiye…"),
    ("tray.quit", "Ondoka"),
    ("tray.launch", "Anzisha"),
    ("tray.stop", "Simamisha"),
    ("tray.boot", "Washa"),
    ("tray.shutdown", "Zima"),
    ("elevate.macos", "macOS itaomba nenosiri lako."),
    (
        "elevate.windows",
        "Windows itaonyesha ombi la User Account Control.",
    ),
    ("elevate.other", "Eneo-kazi lako litaomba uthibitisho."),
];

const HA: Table = &[
    ("tray.ports", "Tashoshi"),
    ("tray.none", "Babu tashar da take saurare"),
    ("tray.devices", "Na'urori"),
    ("tray.killAll", "Kashe duka"),
    ("tray.show", "Buɗe portiye…"),
    ("tray.quit", "Fita"),
    ("tray.launch", "Kaddamar"),
    ("tray.stop", "Tsayar"),
    ("tray.boot", "Kunna"),
    ("tray.shutdown", "Kashe"),
    ("elevate.macos", "macOS zai nemi kalmar sirrinka."),
    (
        "elevate.windows",
        "Windows zai nuna saƙon User Account Control.",
    ),
    ("elevate.other", "Tebur ɗinka zai nemi tabbatarwa."),
];

const AM: Table = &[
    ("tray.ports", "ፖርቶች"),
    ("tray.none", "የሚያዳምጥ ፖርት የለም"),
    ("tray.devices", "መሣሪያዎች"),
    ("tray.killAll", "ሁሉንም አቁም"),
    ("tray.show", "portiye ክፈት…"),
    ("tray.quit", "ውጣ"),
    ("tray.launch", "አስጀምር"),
    ("tray.stop", "አቁም"),
    ("tray.boot", "አብራ"),
    ("tray.shutdown", "አጥፋ"),
    ("elevate.macos", "macOS የይለፍ ቃልህን ይጠይቃል።"),
    ("elevate.windows", "Windows የተጠቃሚ መለያ ቁጥጥር ጥያቄ ያሳያል።"),
    ("elevate.other", "ዴስክቶፕህ ማረጋገጫ ይጠይቃል።"),
];

const YO: Table = &[
    ("tray.ports", "Àwọn pọ́ọ̀tù"),
    ("tray.none", "Kò sí pọ́ọ̀tù tí ń tẹ́tí sílẹ̀"),
    ("tray.devices", "Àwọn ẹ̀rọ"),
    ("tray.killAll", "Pa gbogbo rẹ̀"),
    ("tray.show", "Ṣí portiye…"),
    ("tray.quit", "Jáde"),
    ("tray.launch", "Bẹ̀rẹ̀"),
    ("tray.stop", "Dúró"),
    ("tray.boot", "Tan"),
    ("tray.shutdown", "Pa"),
    ("elevate.macos", "macOS yóò béèrè ọ̀rọ̀ìgbaniwọlé rẹ."),
    (
        "elevate.windows",
        "Windows yóò fi ìbéèrè User Account Control hàn.",
    ),
    ("elevate.other", "Deskitọ́ọ̀pù rẹ yóò béèrè ìjẹ́rìísí."),
];

const ZU: Table = &[
    ("tray.ports", "Amaphoti"),
    ("tray.none", "Awekho amaphoti alalele"),
    ("tray.devices", "Amadivayisi"),
    ("tray.killAll", "Misa konke"),
    ("tray.show", "Vula i-portiye…"),
    ("tray.quit", "Phuma"),
    ("tray.launch", "Qalisa"),
    ("tray.stop", "Misa"),
    ("tray.boot", "Vula"),
    ("tray.shutdown", "Cisha"),
    ("elevate.macos", "I-macOS izocela iphasiwedi yakho."),
    (
        "elevate.windows",
        "I-Windows izobonisa isicelo se-User Account Control.",
    ),
    (
        "elevate.other",
        "Ideskithophu yakho izocela ukuqinisekiswa.",
    ),
];

/// Every locale the tray speaks, in the same order as the window's picker.
const LOCALES: &[(&str, Table)] = &[
    ("en", EN),
    ("tr", TR),
    ("es", ES),
    ("pt", PT),
    ("de", DE),
    ("nl", NL),
    ("ru", RU),
    ("zh", ZH),
    ("hi", HI),
    ("bn", BN),
    ("ur", UR),
    ("ar", AR),
    ("fa", FA),
    ("he", HE),
    ("id", ID),
    ("ms", MS),
    ("fil", FIL),
    ("vi", VI),
    ("th", TH),
    ("kk", KK),
    ("uz", UZ),
    ("ky", KY),
    ("tk", TK),
    ("sw", SW),
    ("ha", HA),
    ("am", AM),
    ("yo", YO),
    ("zu", ZU),
];

static LOCALE: Mutex<Table> = Mutex::new(EN);

/// Accepts anything the webview sends (`tr-TR`, `zh-Hans-CN`) and keeps the
/// base tag when it is one we ship. Unknown tags leave the locale alone.
pub fn set(tag: &str) {
    let base = tag
        .split(['-', '_'])
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if let Some((_, table)) = LOCALES.iter().find(|(t, _)| *t == base) {
        *LOCALE.lock().unwrap() = table;
    }
}

/// The string for `key` in the current locale, falling back to English.
pub fn t(key: &str) -> &'static str {
    let table = *LOCALE.lock().unwrap();
    let lookup = |table: Table| table.iter().find(|(k, _)| *k == key).map(|(_, v)| *v);
    lookup(table).or_else(|| lookup(EN)).unwrap_or("")
}

/// Called by the window on start-up and whenever the user changes language.
#[tauri::command]
pub fn set_locale<R: tauri::Runtime>(app: tauri::AppHandle<R>, locale: String) {
    set(&locale);
    crate::tray::refresh(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn region_tags_collapse_and_unknown_tags_are_ignored() {
        set("tr-TR");
        assert_eq!(t("tray.quit"), "Çık");
        set("zh_Hans_CN");
        assert_eq!(t("tray.quit"), "退出");
        set("kl-GL"); // not shipped — the previous choice must survive
        assert_eq!(t("tray.quit"), "退出");
        set("en");
        assert_eq!(t("tray.quit"), "Quit");
    }

    #[test]
    fn an_unknown_key_is_empty_rather_than_a_panic() {
        set("tr");
        assert_eq!(t("tray.nope"), "");
        set("en");
    }

    /// A language that silently lost a key would fall back to English in the
    /// menu bar while the window shows the translation — the kind of drift
    /// nobody notices until a user reports half a menu in the wrong language.
    #[test]
    fn every_locale_carries_every_key() {
        for (tag, table) in LOCALES {
            assert_eq!(
                table.len(),
                EN.len(),
                "{tag} has {} keys, en has {}",
                table.len(),
                EN.len()
            );
            for ((key, _), (en_key, _)) in table.iter().zip(EN.iter()) {
                assert_eq!(key, en_key, "{tag} is out of order at {en_key}");
            }
            for (key, value) in table.iter() {
                assert!(!value.is_empty(), "{tag} has an empty {key}");
            }
        }
    }
}
