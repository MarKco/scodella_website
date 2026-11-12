// Rilevamento della piattaforma: serve per l'installazione della PWA e per il badge dell'app Android (inutile su iPhone/iPad).

interface Env {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}

/** iPhone, iPad e iPadOS (che si presenta come un Mac con schermo touch). */
export function isIos(env: Env = navigator): boolean {
  return /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
}

/**
 * Un link `webcal:` apre davvero l'app Calendario e chiede l'iscrizione: iPhone, iPad e Mac. Su Android, Windows e Linux spesso non
 * succede nulla (o si apre un'app a caso), quindi lì si mandano le persone alle istruzioni con l'indirizzo da copiare.
 */
export function opensWebcal(env: Env = navigator): boolean {
  return isIos(env) || /Macintosh|Mac OS X/.test(env.userAgent);
}

/** La pagina è aperta come app installata (schermata Home), non in una scheda del browser. */
export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.ilsecondodasinistra.scodella';
