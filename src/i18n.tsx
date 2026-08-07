/**
 * Translations.
 *
 * ponytail: a dict, a context and one `t()`. No i18next, no ICU parser, no
 * plural engine — the app has ~120 strings and one interpolation form (`{n}`).
 * English is the source of truth; a locale may omit any key and falls back to
 * it, so a half-finished translation still renders a working app.
 *
 * Adding a language: add the tag to `LOCALES`, copy the `en` block, translate.
 * Nothing else knows the list.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePersisted } from "./hooks/usePersisted";

export const LOCALES = {
  en: "English",
  tr: "Türkçe",
  es: "Español",
  de: "Deutsch",
  zh: "中文",
} as const;

export type Locale = keyof typeof LOCALES;

/** `tr-TR`, `zh-Hans-CN` and friends all collapse to their base tag. */
export function detectLocale(): Locale {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (base in LOCALES) return base as Locale;
  }
  return "en";
}

const en = {
  "nav.ports": "Ports",
  "nav.history": "History",
  "nav.logs": "Device Logs",
  "nav.view": "View",

  "toolbar.exportFormat": "Export format",
  "toolbar.export": "Export",
  "toolbar.exportTitle": "Export the current table to your Downloads folder (⌘E)",
  "toolbar.refresh": "Refresh now",
  "toolbar.refreshTitle": "Refresh now (⌘R)",
  "toolbar.toLight": "Switch to light theme",
  "toolbar.toDark": "Switch to dark theme",
  "toolbar.language": "Language",
  "toolbar.autostart": "Start at login",
  "toolbar.autostartOn": "portiye starts with your session",
  "toolbar.autostartOff": "portiye does not start with your session",

  "banner.dismiss": "Dismiss",
  "banner.dismissError": "Dismiss error",
  "banner.reveal": "Reveal",

  "devices.title": "Devices",
  "devices.runtimes": "Runtimes",
  "devices.count": "{running} / {total} running",
  "devices.empty":
    "No emulators or simulators found. Create one in Android Studio, or install Xcode for iOS devices.",

  "device.launch": "Launch",
  "device.stop": "Stop",
  "device.start": "Start",
  "device.boot": "Boot",
  "device.shutdown": "Shutdown",
  "device.restart": "Restart",
  "device.restartTitle": "Stop and start {name} again, keeping its data",
  "device.wipe": "Wipe",
  "device.erase": "Erase",
  "device.remove": "Remove",
  "device.resetTitle": "Reset {name}?",
  "device.wipeWarning":
    "All apps, data and snapshots are erased, then it cold boots.",
  "device.eraseWarning": "All apps, data and caches are wiped.",
  "device.removeWarning": "The container and its writable layer are deleted.",

  "ports.title": "Listening ports",
  "ports.filter": "Filter ports",
  "ports.filterAria": "Filter ports by number, process or path",
  "ports.flagOver": "Flag over",
  "ports.flagAria": "Flag processes using more memory than",
  "ports.killSelected": "Kill {n} selected",
  "ports.killSelectedTitle": "Kill the selected processes (⌘⌫)",
  "ports.emptyNone": "Nothing is listening on this machine.",
  "ports.emptyFilter": "No port matches “{q}”.",
  "ports.clearFilter": "Clear filter",

  "table.port": "Port",
  "table.process": "Process",
  "table.memory": "Memory",
  "table.pid": "PID",
  "table.group": "Group",
  "table.selectAll": "Select all shown",
  "table.clearSelection": "Clear selection",
  "table.selectRow": "Select {name}, pid {pid}",
  "table.kill": "Kill",
  "table.killAria": "Kill {name} on {ports}",
  "table.hot": "Above your memory threshold",
  "table.sortAsc": "ascending",
  "table.sortDesc": "descending",
  "table.sortAria": "Sort by {column}, {dir}",

  "fastkill.kill": "Kill {n}",
  "fastkill.runtime": "runtime",
  "fastkill.titleRuntime": "Kill every {name} process: {names}",
  "fastkill.titleName": "Kill all {n} {name} processes",

  "confirm.cancel": "Cancel",

  "kill.titleSelected": "Kill {n} selected processes?",
  "kill.titleSelectedOne": "Kill 1 selected process?",
  "kill.titleGroup": "Kill {n} {name} processes?",
  "kill.titleOne": "Kill {name}?",
  "kill.note": "Processes they started are killed too.",
  "kill.confirm": "Kill {n}",
  "kill.children": "Killed {n} + {c} child processes",
  "kill.childrenOne": "Killed {n} + 1 child process",
  "kill.deniedTitle": "{n} of {total} refused to close",
  "kill.deniedProcess": "process",
  "kill.deniedWarning": "They belong to another user. {hint}",
  "kill.retryElevated": "Retry as administrator",

  "export.notice": "Exported {n} rows",

  "history.title": "Port history",
  "history.clear": "Clear",
  "history.empty":
    "Nothing has opened or closed since portiye started. Events appear here as they happen, including while the window is closed.",
  "history.tookOver": "took over from {name}",
  "history.showOlder": "Show {n} older",
  "history.more": "{n} more",
  "history.secondsAgo": "{n}s ago",
  "history.minutesAgo": "{n}m ago",

  "detail.aria": "Details for process {pid}",
  "detail.close": "Close details",
  "detail.reading": "Reading…",
  "detail.cpu": "CPU",
  "detail.memory": "Memory",
  "detail.uptime": "Uptime",
  "detail.user": "User",
  "detail.directory": "Directory",
  "detail.command": "Command",
  "detail.tree": "Process tree",
  "detail.connections": "Connections",
  "detail.noSockets": "No open sockets.",
  "detail.openFiles": "Open files",
  "detail.noFiles": "No regular files open.",
  "detail.andMore": "and {n} more",
  "detail.kill": "Kill this process",

  "logs.title": "Device logs",
  "logs.source": "Log source",
  "logs.off": "Off",
  "logs.filter": "Filter lines",
  "logs.filterAria": "Filter log lines",
  "logs.follow": "Follow",
  "logs.copy": "Copy",
  "logs.export": "Export",
  "logs.exportTitle": "Write these lines to your Downloads folder",
  "logs.copied": "Copied {n} lines",
  "logs.copyFailed":
    "Could not reach the clipboard — select the lines and press ⌘C",
  "logs.exported": "Exported {n} lines → {path}",
  "logs.emptyNoDevice": "Start a simulator or emulator to stream its log.",
  "logs.emptyPick": "Pick a device above to start streaming.",

  "risk.database":
    "This is a database or message broker. Killing it mid-write can lose or corrupt uncommitted data — stop it through its own service manager instead.",
  "risk.editor":
    "This looks like an editor or IDE — quite possibly the one you have open. Killing it drops unsaved work.",
  "risk.system":
    "This is an operating-system service, not a dev process. Killing it can log you out or destabilise the machine.",
  "risk.container":
    "This hosts containers or virtual machines. Everything running inside it goes down too.",
  "risk.device":
    "This backs a running emulator or simulator. The device session ends and unsaved app state is lost.",
};

export type Key = keyof typeof en;

const tr: Partial<Record<Key, string>> = {
  "nav.ports": "Portlar",
  "nav.history": "Geçmiş",
  "nav.logs": "Cihaz Kayıtları",
  "nav.view": "Görünüm",

  "toolbar.exportFormat": "Dışa aktarma biçimi",
  "toolbar.export": "Dışa aktar",
  "toolbar.exportTitle": "Geçerli tabloyu İndirilenler klasörüne aktar (⌘E)",
  "toolbar.refresh": "Şimdi yenile",
  "toolbar.refreshTitle": "Şimdi yenile (⌘R)",
  "toolbar.toLight": "Açık temaya geç",
  "toolbar.toDark": "Koyu temaya geç",
  "toolbar.language": "Dil",
  "toolbar.autostart": "Açılışta başlat",
  "toolbar.autostartOn": "portiye oturumunuzla birlikte başlar",
  "toolbar.autostartOff": "portiye oturumunuzla birlikte başlamaz",

  "banner.dismiss": "Kapat",
  "banner.dismissError": "Hatayı kapat",
  "banner.reveal": "Klasörde göster",

  "devices.title": "Cihazlar",
  "devices.runtimes": "Çalışma zamanları",
  "devices.count": "{running} / {total} çalışıyor",
  "devices.empty":
    "Emülatör veya simülatör bulunamadı. Android Studio'da bir tane oluşturun ya da iOS cihazları için Xcode kurun.",

  "device.launch": "Başlat",
  "device.stop": "Durdur",
  "device.start": "Başlat",
  "device.boot": "Aç",
  "device.shutdown": "Kapat",
  "device.restart": "Yeniden başlat",
  "device.restartTitle": "{name} cihazını verilerini koruyarak yeniden başlat",
  "device.wipe": "Sıfırla",
  "device.erase": "Sil",
  "device.remove": "Kaldır",
  "device.resetTitle": "{name} sıfırlansın mı?",
  "device.wipeWarning":
    "Tüm uygulamalar, veriler ve anlık görüntüler silinir, ardından soğuk başlatılır.",
  "device.eraseWarning": "Tüm uygulamalar, veriler ve önbellekler silinir.",
  "device.removeWarning": "Konteyner ve yazılabilir katmanı silinir.",

  "ports.title": "Dinlenen portlar",
  "ports.filter": "Portlarda ara",
  "ports.filterAria": "Portları numara, süreç veya yola göre filtrele",
  "ports.flagOver": "Şunun üstünü işaretle",
  "ports.flagAria": "Şu miktardan fazla bellek kullanan süreçleri işaretle",
  "ports.killSelected": "Seçili {n} süreci sonlandır",
  "ports.killSelectedTitle": "Seçili süreçleri sonlandır (⌘⌫)",
  "ports.emptyNone": "Bu makinede dinleyen bir şey yok.",
  "ports.emptyFilter": "“{q}” ile eşleşen port yok.",
  "ports.clearFilter": "Filtreyi temizle",

  "table.port": "Port",
  "table.process": "Süreç",
  "table.memory": "Bellek",
  "table.pid": "PID",
  "table.group": "Grup",
  "table.selectAll": "Görünenlerin tümünü seç",
  "table.clearSelection": "Seçimi temizle",
  "table.selectRow": "{name} seç, pid {pid}",
  "table.kill": "Sonlandır",
  "table.killAria": "{ports} üzerindeki {name} sürecini sonlandır",
  "table.hot": "Bellek eşiğinizin üzerinde",
  "table.sortAsc": "artan",
  "table.sortDesc": "azalan",
  "table.sortAria": "{column} sütununa göre sırala, {dir}",

  "fastkill.kill": "{n} sonlandır",
  "fastkill.runtime": "çalışma zamanı",
  "fastkill.titleRuntime": "Her {name} sürecini sonlandır: {names}",
  "fastkill.titleName": "{n} {name} sürecinin tümünü sonlandır",

  "confirm.cancel": "Vazgeç",

  "kill.titleSelected": "Seçili {n} süreç sonlandırılsın mı?",
  "kill.titleSelectedOne": "Seçili 1 süreç sonlandırılsın mı?",
  "kill.titleGroup": "{n} {name} süreci sonlandırılsın mı?",
  "kill.titleOne": "{name} sonlandırılsın mı?",
  "kill.note": "Bunların başlattığı süreçler de sonlandırılır.",
  "kill.confirm": "{n} süreci sonlandır",
  "kill.children": "{n} süreç + {c} alt süreç sonlandırıldı",
  "kill.childrenOne": "{n} süreç + 1 alt süreç sonlandırıldı",
  "kill.deniedTitle": "{total} süreçten {n} tanesi kapanmayı reddetti",
  "kill.deniedProcess": "süreç",
  "kill.deniedWarning": "Başka bir kullanıcıya aitler. {hint}",
  "kill.retryElevated": "Yönetici olarak yeniden dene",

  "export.notice": "{n} satır dışa aktarıldı",

  "history.title": "Port geçmişi",
  "history.clear": "Temizle",
  "history.empty":
    "portiye başladığından beri açılan veya kapanan bir şey yok. Olaylar, pencere kapalıyken bile gerçekleştikçe burada görünür.",
  "history.tookOver": "{name} yerine geçti",
  "history.showOlder": "{n} eskisini göster",
  "history.more": "{n} tane daha",
  "history.secondsAgo": "{n}sn önce",
  "history.minutesAgo": "{n}dk önce",

  "detail.aria": "{pid} numaralı sürecin ayrıntıları",
  "detail.close": "Ayrıntıları kapat",
  "detail.reading": "Okunuyor…",
  "detail.cpu": "CPU",
  "detail.memory": "Bellek",
  "detail.uptime": "Çalışma süresi",
  "detail.user": "Kullanıcı",
  "detail.directory": "Dizin",
  "detail.command": "Komut",
  "detail.tree": "Süreç ağacı",
  "detail.connections": "Bağlantılar",
  "detail.noSockets": "Açık soket yok.",
  "detail.openFiles": "Açık dosyalar",
  "detail.noFiles": "Açık normal dosya yok.",
  "detail.andMore": "ve {n} tane daha",
  "detail.kill": "Bu süreci sonlandır",

  "logs.title": "Cihaz kayıtları",
  "logs.source": "Kayıt kaynağı",
  "logs.off": "Kapalı",
  "logs.filter": "Satırlarda ara",
  "logs.filterAria": "Kayıt satırlarını filtrele",
  "logs.follow": "Takip et",
  "logs.copy": "Kopyala",
  "logs.export": "Dışa aktar",
  "logs.exportTitle": "Bu satırları İndirilenler klasörüne yaz",
  "logs.copied": "{n} satır kopyalandı",
  "logs.copyFailed": "Panoya erişilemedi — satırları seçip ⌘C tuşlayın",
  "logs.exported": "{n} satır dışa aktarıldı → {path}",
  "logs.emptyNoDevice":
    "Kaydını akıtmak için bir simülatör veya emülatör başlatın.",
  "logs.emptyPick": "Akışı başlatmak için yukarıdan bir cihaz seçin.",

  "risk.database":
    "Bu bir veritabanı veya mesaj aracısı. Yazma sırasında sonlandırmak, işlenmemiş verileri kaybettirebilir veya bozabilir — bunun yerine kendi servis yöneticisinden durdurun.",
  "risk.editor":
    "Bu bir düzenleyici veya IDE gibi görünüyor — muhtemelen şu an açık olanı. Sonlandırmak kaydedilmemiş çalışmaları siler.",
  "risk.system":
    "Bu bir işletim sistemi servisi, geliştirme süreci değil. Sonlandırmak oturumunuzu kapatabilir veya makineyi kararsızlaştırabilir.",
  "risk.container":
    "Bu, konteynerleri veya sanal makineleri barındırıyor. İçinde çalışan her şey de kapanır.",
  "risk.device":
    "Bu, çalışan bir emülatör veya simülatörü besliyor. Cihaz oturumu biter ve kaydedilmemiş uygulama durumu kaybolur.",
};

const es: Partial<Record<Key, string>> = {
  "nav.ports": "Puertos",
  "nav.history": "Historial",
  "nav.logs": "Registros del dispositivo",
  "nav.view": "Vista",

  "toolbar.exportFormat": "Formato de exportación",
  "toolbar.export": "Exportar",
  "toolbar.exportTitle": "Exportar la tabla actual a tu carpeta de Descargas (⌘E)",
  "toolbar.refresh": "Actualizar ahora",
  "toolbar.refreshTitle": "Actualizar ahora (⌘R)",
  "toolbar.toLight": "Cambiar al tema claro",
  "toolbar.toDark": "Cambiar al tema oscuro",
  "toolbar.language": "Idioma",
  "toolbar.autostart": "Iniciar al arrancar",
  "toolbar.autostartOn": "portiye se inicia con tu sesión",
  "toolbar.autostartOff": "portiye no se inicia con tu sesión",

  "banner.dismiss": "Descartar",
  "banner.dismissError": "Descartar error",
  "banner.reveal": "Mostrar",

  "devices.title": "Dispositivos",
  "devices.runtimes": "Entornos de ejecución",
  "devices.count": "{running} / {total} en ejecución",
  "devices.empty":
    "No se encontraron emuladores ni simuladores. Crea uno en Android Studio, o instala Xcode para dispositivos iOS.",

  "device.launch": "Lanzar",
  "device.stop": "Detener",
  "device.start": "Iniciar",
  "device.boot": "Arrancar",
  "device.shutdown": "Apagar",
  "device.restart": "Reiniciar",
  "device.restartTitle": "Detener e iniciar {name} de nuevo, conservando sus datos",
  "device.wipe": "Borrar todo",
  "device.erase": "Borrar",
  "device.remove": "Eliminar",
  "device.resetTitle": "¿Restablecer {name}?",
  "device.wipeWarning":
    "Se borran todas las apps, datos e instantáneas, y luego arranca en frío.",
  "device.eraseWarning": "Se borran todas las apps, datos y cachés.",
  "device.removeWarning": "El contenedor y su capa de escritura se eliminan.",

  "ports.title": "Puertos a la escucha",
  "ports.filter": "Filtrar puertos",
  "ports.filterAria": "Filtrar puertos por número, proceso o ruta",
  "ports.flagOver": "Marcar por encima de",
  "ports.flagAria": "Marcar procesos que usen más memoria que",
  "ports.killSelected": "Matar {n} seleccionados",
  "ports.killSelectedTitle": "Matar los procesos seleccionados (⌘⌫)",
  "ports.emptyNone": "Nada está a la escucha en esta máquina.",
  "ports.emptyFilter": "Ningún puerto coincide con «{q}».",
  "ports.clearFilter": "Limpiar filtro",

  "table.port": "Puerto",
  "table.process": "Proceso",
  "table.memory": "Memoria",
  "table.pid": "PID",
  "table.group": "Grupo",
  "table.selectAll": "Seleccionar todo lo visible",
  "table.clearSelection": "Limpiar selección",
  "table.selectRow": "Seleccionar {name}, pid {pid}",
  "table.kill": "Matar",
  "table.killAria": "Matar {name} en {ports}",
  "table.hot": "Por encima de tu umbral de memoria",
  "table.sortAsc": "ascendente",
  "table.sortDesc": "descendente",
  "table.sortAria": "Ordenar por {column}, {dir}",

  "fastkill.kill": "Matar {n}",
  "fastkill.runtime": "entorno",
  "fastkill.titleRuntime": "Matar todos los procesos de {name}: {names}",
  "fastkill.titleName": "Matar los {n} procesos {name}",

  "confirm.cancel": "Cancelar",

  "kill.titleSelected": "¿Matar {n} procesos seleccionados?",
  "kill.titleSelectedOne": "¿Matar 1 proceso seleccionado?",
  "kill.titleGroup": "¿Matar {n} procesos {name}?",
  "kill.titleOne": "¿Matar {name}?",
  "kill.note": "Los procesos que iniciaron también se matan.",
  "kill.confirm": "Matar {n}",
  "kill.children": "Se mataron {n} + {c} procesos hijos",
  "kill.childrenOne": "Se mataron {n} + 1 proceso hijo",
  "kill.deniedTitle": "{n} de {total} se negaron a cerrarse",
  "kill.deniedProcess": "proceso",
  "kill.deniedWarning": "Pertenecen a otro usuario. {hint}",
  "kill.retryElevated": "Reintentar como administrador",

  "export.notice": "Se exportaron {n} filas",

  "history.title": "Historial de puertos",
  "history.clear": "Limpiar",
  "history.empty":
    "Nada se ha abierto ni cerrado desde que portiye arrancó. Los eventos aparecen aquí según ocurren, incluso con la ventana cerrada.",
  "history.tookOver": "tomó el relevo de {name}",
  "history.showOlder": "Mostrar {n} más antiguos",
  "history.more": "{n} más",
  "history.secondsAgo": "hace {n}s",
  "history.minutesAgo": "hace {n}m",

  "detail.aria": "Detalles del proceso {pid}",
  "detail.close": "Cerrar detalles",
  "detail.reading": "Leyendo…",
  "detail.cpu": "CPU",
  "detail.memory": "Memoria",
  "detail.uptime": "Tiempo activo",
  "detail.user": "Usuario",
  "detail.directory": "Directorio",
  "detail.command": "Comando",
  "detail.tree": "Árbol de procesos",
  "detail.connections": "Conexiones",
  "detail.noSockets": "No hay sockets abiertos.",
  "detail.openFiles": "Archivos abiertos",
  "detail.noFiles": "No hay archivos regulares abiertos.",
  "detail.andMore": "y {n} más",
  "detail.kill": "Matar este proceso",

  "logs.title": "Registros del dispositivo",
  "logs.source": "Fuente de registro",
  "logs.off": "Apagado",
  "logs.filter": "Filtrar líneas",
  "logs.filterAria": "Filtrar líneas de registro",
  "logs.follow": "Seguir",
  "logs.copy": "Copiar",
  "logs.export": "Exportar",
  "logs.exportTitle": "Escribir estas líneas en tu carpeta de Descargas",
  "logs.copied": "Se copiaron {n} líneas",
  "logs.copyFailed":
    "No se pudo acceder al portapapeles — selecciona las líneas y pulsa ⌘C",
  "logs.exported": "Se exportaron {n} líneas → {path}",
  "logs.emptyNoDevice":
    "Inicia un simulador o emulador para transmitir su registro.",
  "logs.emptyPick": "Elige un dispositivo arriba para empezar a transmitir.",

  "risk.database":
    "Esto es una base de datos o un broker de mensajes. Matarlo a mitad de una escritura puede perder o corromper datos sin confirmar — deténlo desde su propio gestor de servicios.",
  "risk.editor":
    "Esto parece un editor o IDE — posiblemente el que tienes abierto. Matarlo descarta el trabajo sin guardar.",
  "risk.system":
    "Esto es un servicio del sistema operativo, no un proceso de desarrollo. Matarlo puede cerrar tu sesión o desestabilizar la máquina.",
  "risk.container":
    "Esto aloja contenedores o máquinas virtuales. Todo lo que corre dentro también cae.",
  "risk.device":
    "Esto sostiene un emulador o simulador en ejecución. La sesión del dispositivo termina y se pierde el estado no guardado.",
};

const de: Partial<Record<Key, string>> = {
  "nav.ports": "Ports",
  "nav.history": "Verlauf",
  "nav.logs": "Geräteprotokolle",
  "nav.view": "Ansicht",

  "toolbar.exportFormat": "Exportformat",
  "toolbar.export": "Exportieren",
  "toolbar.exportTitle": "Aktuelle Tabelle in den Downloads-Ordner exportieren (⌘E)",
  "toolbar.refresh": "Jetzt aktualisieren",
  "toolbar.refreshTitle": "Jetzt aktualisieren (⌘R)",
  "toolbar.toLight": "Zum hellen Design wechseln",
  "toolbar.toDark": "Zum dunklen Design wechseln",
  "toolbar.language": "Sprache",
  "toolbar.autostart": "Beim Anmelden starten",
  "toolbar.autostartOn": "portiye startet mit deiner Sitzung",
  "toolbar.autostartOff": "portiye startet nicht mit deiner Sitzung",

  "banner.dismiss": "Schließen",
  "banner.dismissError": "Fehler schließen",
  "banner.reveal": "Im Ordner zeigen",

  "devices.title": "Geräte",
  "devices.runtimes": "Laufzeitumgebungen",
  "devices.count": "{running} / {total} laufen",
  "devices.empty":
    "Keine Emulatoren oder Simulatoren gefunden. Lege einen in Android Studio an oder installiere Xcode für iOS-Geräte.",

  "device.launch": "Starten",
  "device.stop": "Stoppen",
  "device.start": "Starten",
  "device.boot": "Booten",
  "device.shutdown": "Herunterfahren",
  "device.restart": "Neu starten",
  "device.restartTitle": "{name} stoppen und erneut starten, Daten bleiben erhalten",
  "device.wipe": "Zurücksetzen",
  "device.erase": "Löschen",
  "device.remove": "Entfernen",
  "device.resetTitle": "{name} zurücksetzen?",
  "device.wipeWarning":
    "Alle Apps, Daten und Snapshots werden gelöscht, danach folgt ein Kaltstart.",
  "device.eraseWarning": "Alle Apps, Daten und Caches werden gelöscht.",
  "device.removeWarning": "Container und beschreibbare Schicht werden gelöscht.",

  "ports.title": "Lauschende Ports",
  "ports.filter": "Ports filtern",
  "ports.filterAria": "Ports nach Nummer, Prozess oder Pfad filtern",
  "ports.flagOver": "Markieren ab",
  "ports.flagAria": "Prozesse markieren, die mehr Speicher nutzen als",
  "ports.killSelected": "{n} ausgewählte beenden",
  "ports.killSelectedTitle": "Ausgewählte Prozesse beenden (⌘⌫)",
  "ports.emptyNone": "Auf diesem Rechner lauscht nichts.",
  "ports.emptyFilter": "Kein Port passt zu „{q}“.",
  "ports.clearFilter": "Filter löschen",

  "table.port": "Port",
  "table.process": "Prozess",
  "table.memory": "Speicher",
  "table.pid": "PID",
  "table.group": "Gruppe",
  "table.selectAll": "Alle sichtbaren auswählen",
  "table.clearSelection": "Auswahl aufheben",
  "table.selectRow": "{name} auswählen, PID {pid}",
  "table.kill": "Beenden",
  "table.killAria": "{name} auf {ports} beenden",
  "table.hot": "Über deinem Speicher-Schwellwert",
  "table.sortAsc": "aufsteigend",
  "table.sortDesc": "absteigend",
  "table.sortAria": "Nach {column} sortieren, {dir}",

  "fastkill.kill": "{n} beenden",
  "fastkill.runtime": "Laufzeit",
  "fastkill.titleRuntime": "Jeden {name}-Prozess beenden: {names}",
  "fastkill.titleName": "Alle {n} {name}-Prozesse beenden",

  "confirm.cancel": "Abbrechen",

  "kill.titleSelected": "{n} ausgewählte Prozesse beenden?",
  "kill.titleSelectedOne": "1 ausgewählten Prozess beenden?",
  "kill.titleGroup": "{n} {name}-Prozesse beenden?",
  "kill.titleOne": "{name} beenden?",
  "kill.note": "Von ihnen gestartete Prozesse werden ebenfalls beendet.",
  "kill.confirm": "{n} beenden",
  "kill.children": "{n} + {c} Kindprozesse beendet",
  "kill.childrenOne": "{n} + 1 Kindprozess beendet",
  "kill.deniedTitle": "{n} von {total} ließen sich nicht beenden",
  "kill.deniedProcess": "Prozess",
  "kill.deniedWarning": "Sie gehören einem anderen Benutzer. {hint}",
  "kill.retryElevated": "Als Administrator erneut versuchen",

  "export.notice": "{n} Zeilen exportiert",

  "history.title": "Port-Verlauf",
  "history.clear": "Leeren",
  "history.empty":
    "Seit dem Start von portiye wurde nichts geöffnet oder geschlossen. Ereignisse erscheinen hier, sobald sie passieren — auch bei geschlossenem Fenster.",
  "history.tookOver": "übernahm von {name}",
  "history.showOlder": "{n} ältere anzeigen",
  "history.more": "{n} weitere",
  "history.secondsAgo": "vor {n}s",
  "history.minutesAgo": "vor {n}m",

  "detail.aria": "Details zu Prozess {pid}",
  "detail.close": "Details schließen",
  "detail.reading": "Wird gelesen…",
  "detail.cpu": "CPU",
  "detail.memory": "Speicher",
  "detail.uptime": "Laufzeit",
  "detail.user": "Benutzer",
  "detail.directory": "Verzeichnis",
  "detail.command": "Befehl",
  "detail.tree": "Prozessbaum",
  "detail.connections": "Verbindungen",
  "detail.noSockets": "Keine offenen Sockets.",
  "detail.openFiles": "Offene Dateien",
  "detail.noFiles": "Keine regulären Dateien offen.",
  "detail.andMore": "und {n} weitere",
  "detail.kill": "Diesen Prozess beenden",

  "logs.title": "Geräteprotokolle",
  "logs.source": "Protokollquelle",
  "logs.off": "Aus",
  "logs.filter": "Zeilen filtern",
  "logs.filterAria": "Protokollzeilen filtern",
  "logs.follow": "Folgen",
  "logs.copy": "Kopieren",
  "logs.export": "Exportieren",
  "logs.exportTitle": "Diese Zeilen in den Downloads-Ordner schreiben",
  "logs.copied": "{n} Zeilen kopiert",
  "logs.copyFailed":
    "Zwischenablage nicht erreichbar — Zeilen markieren und ⌘C drücken",
  "logs.exported": "{n} Zeilen exportiert → {path}",
  "logs.emptyNoDevice":
    "Starte einen Simulator oder Emulator, um sein Protokoll zu streamen.",
  "logs.emptyPick": "Wähle oben ein Gerät, um den Stream zu starten.",

  "risk.database":
    "Das ist eine Datenbank oder ein Message-Broker. Ein Beenden mitten im Schreibvorgang kann nicht bestätigte Daten verlieren oder beschädigen — stoppe sie über ihren eigenen Dienstmanager.",
  "risk.editor":
    "Das sieht nach einem Editor oder einer IDE aus — womöglich der, den du gerade offen hast. Beenden verwirft ungespeicherte Arbeit.",
  "risk.system":
    "Das ist ein Betriebssystemdienst, kein Entwicklungsprozess. Beenden kann dich abmelden oder den Rechner destabilisieren.",
  "risk.container":
    "Das hostet Container oder virtuelle Maschinen. Alles darin geht ebenfalls unter.",
  "risk.device":
    "Das trägt einen laufenden Emulator oder Simulator. Die Gerätesitzung endet und ungespeicherter App-Zustand geht verloren.",
};

const zh: Partial<Record<Key, string>> = {
  "nav.ports": "端口",
  "nav.history": "历史",
  "nav.logs": "设备日志",
  "nav.view": "视图",

  "toolbar.exportFormat": "导出格式",
  "toolbar.export": "导出",
  "toolbar.exportTitle": "将当前表格导出到下载文件夹（⌘E）",
  "toolbar.refresh": "立即刷新",
  "toolbar.refreshTitle": "立即刷新（⌘R）",
  "toolbar.toLight": "切换到浅色主题",
  "toolbar.toDark": "切换到深色主题",
  "toolbar.language": "语言",
  "toolbar.autostart": "开机自启",
  "toolbar.autostartOn": "portiye 会随登录一起启动",
  "toolbar.autostartOff": "portiye 不会随登录启动",

  "banner.dismiss": "关闭",
  "banner.dismissError": "关闭错误",
  "banner.reveal": "在文件夹中显示",

  "devices.title": "设备",
  "devices.runtimes": "运行时",
  "devices.count": "{running} / {total} 运行中",
  "devices.empty":
    "未找到模拟器。请在 Android Studio 中创建一个，或安装 Xcode 以使用 iOS 设备。",

  "device.launch": "启动",
  "device.stop": "停止",
  "device.start": "启动",
  "device.boot": "开机",
  "device.shutdown": "关机",
  "device.restart": "重启",
  "device.restartTitle": "停止并重新启动 {name}，保留其数据",
  "device.wipe": "抹除数据",
  "device.erase": "抹除",
  "device.remove": "移除",
  "device.resetTitle": "重置 {name}？",
  "device.wipeWarning": "所有应用、数据和快照都会被清除，然后冷启动。",
  "device.eraseWarning": "所有应用、数据和缓存都会被清除。",
  "device.removeWarning": "容器及其可写层将被删除。",

  "ports.title": "监听端口",
  "ports.filter": "筛选端口",
  "ports.filterAria": "按端口号、进程或路径筛选",
  "ports.flagOver": "标记超过",
  "ports.flagAria": "标记内存占用高于此值的进程",
  "ports.killSelected": "结束选中的 {n} 个",
  "ports.killSelectedTitle": "结束选中的进程（⌘⌫）",
  "ports.emptyNone": "本机没有任何监听。",
  "ports.emptyFilter": "没有端口匹配“{q}”。",
  "ports.clearFilter": "清除筛选",

  "table.port": "端口",
  "table.process": "进程",
  "table.memory": "内存",
  "table.pid": "PID",
  "table.group": "分组",
  "table.selectAll": "全选可见项",
  "table.clearSelection": "清除选择",
  "table.selectRow": "选择 {name}，pid {pid}",
  "table.kill": "结束",
  "table.killAria": "结束 {ports} 上的 {name}",
  "table.hot": "超出你设置的内存阈值",
  "table.sortAsc": "升序",
  "table.sortDesc": "降序",
  "table.sortAria": "按 {column} 排序，{dir}",

  "fastkill.kill": "结束 {n} 个",
  "fastkill.runtime": "运行时",
  "fastkill.titleRuntime": "结束所有 {name} 进程：{names}",
  "fastkill.titleName": "结束全部 {n} 个 {name} 进程",

  "confirm.cancel": "取消",

  "kill.titleSelected": "结束选中的 {n} 个进程？",
  "kill.titleSelectedOne": "结束选中的 1 个进程？",
  "kill.titleGroup": "结束 {n} 个 {name} 进程？",
  "kill.titleOne": "结束 {name}？",
  "kill.note": "它们启动的进程也会被结束。",
  "kill.confirm": "结束 {n} 个",
  "kill.children": "已结束 {n} 个 + {c} 个子进程",
  "kill.childrenOne": "已结束 {n} 个 + 1 个子进程",
  "kill.deniedTitle": "{total} 个中有 {n} 个拒绝关闭",
  "kill.deniedProcess": "进程",
  "kill.deniedWarning": "它们属于其他用户。{hint}",
  "kill.retryElevated": "以管理员身份重试",

  "export.notice": "已导出 {n} 行",

  "history.title": "端口历史",
  "history.clear": "清空",
  "history.empty":
    "自 portiye 启动以来没有端口开启或关闭。事件会在发生时显示在这里，窗口关闭时也一样。",
  "history.tookOver": "接管了 {name}",
  "history.showOlder": "显示更早的 {n} 条",
  "history.more": "还有 {n} 条",
  "history.secondsAgo": "{n} 秒前",
  "history.minutesAgo": "{n} 分钟前",

  "detail.aria": "进程 {pid} 的详情",
  "detail.close": "关闭详情",
  "detail.reading": "读取中…",
  "detail.cpu": "CPU",
  "detail.memory": "内存",
  "detail.uptime": "运行时长",
  "detail.user": "用户",
  "detail.directory": "目录",
  "detail.command": "命令",
  "detail.tree": "进程树",
  "detail.connections": "连接",
  "detail.noSockets": "没有打开的套接字。",
  "detail.openFiles": "打开的文件",
  "detail.noFiles": "没有打开的普通文件。",
  "detail.andMore": "还有 {n} 个",
  "detail.kill": "结束此进程",

  "logs.title": "设备日志",
  "logs.source": "日志来源",
  "logs.off": "关闭",
  "logs.filter": "筛选行",
  "logs.filterAria": "筛选日志行",
  "logs.follow": "跟随",
  "logs.copy": "复制",
  "logs.export": "导出",
  "logs.exportTitle": "把这些行写入下载文件夹",
  "logs.copied": "已复制 {n} 行",
  "logs.copyFailed": "无法访问剪贴板 — 选中这些行并按 ⌘C",
  "logs.exported": "已导出 {n} 行 → {path}",
  "logs.emptyNoDevice": "启动一个模拟器以查看它的日志流。",
  "logs.emptyPick": "在上方选择一个设备开始流式输出。",

  "risk.database":
    "这是数据库或消息代理。写入过程中结束它可能丢失或损坏未提交的数据 — 请改用它自己的服务管理器停止。",
  "risk.editor":
    "这看起来是编辑器或 IDE — 很可能就是你正在用的那个。结束它会丢失未保存的工作。",
  "risk.system":
    "这是操作系统服务，不是开发进程。结束它可能让你退出登录或使系统不稳定。",
  "risk.container": "它承载着容器或虚拟机。里面运行的一切都会一起停止。",
  "risk.device":
    "它支撑着正在运行的模拟器。设备会话将结束，未保存的应用状态会丢失。",
};

const DICT: Record<Locale, Partial<Record<Key, string>>> = { en, tr, es, de, zh };

/** `{name}` placeholders only — the one form every string here needs. */
function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in params ? String(params[key]) : whole,
  );
}

export type T = (key: Key, params?: Record<string, string | number>) => string;

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: T }>({
  locale: "en",
  setLocale: () => {},
  t: (k) => en[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = usePersisted<Locale>("locale", detectLocale());

  const value = useMemo(() => {
    const table = DICT[locale] ?? {};
    const t: T = (key, params) => format(table[key] ?? en[key] ?? key, params);
    return { locale, setLocale, t };
  }, [locale, setLocale]);

  // Not decoration: CSS `text-transform: uppercase` is locale-aware, and a
  // Turkish "i" only becomes "İ" when the document says it is Turkish.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
/** The common case: only the translate function. */
export const useT = (): T => useContext(Ctx).t;
