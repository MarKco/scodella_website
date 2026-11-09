// «Oggi». Con `?oggi=AAAA-MM-GG` la pagina fa come se fosse quel giorno (prove e screenshot), con un avviso ben visibile.
import { parseISO, todayISO, type ISODate } from './domain/dates';

export function simulatedToday(search: string = location.search): ISODate | null {
  const v = new URLSearchParams(search).get('oggi');
  return v && parseISO(v) ? v : null;
}

export const currentToday = (): ISODate => simulatedToday() ?? todayISO();
