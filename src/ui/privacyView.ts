import { h } from '../dom';
import { CONTACT_EMAIL } from '../links';
import type { Ctx } from './ctx';

/** Da aggiornare a ogni modifica dell'informativa (cambia il testo, i dati raccolti o i servizi usati). */
export const PRIVACY_UPDATED = '2026-11-24';

const GITHUB_PRIVACY = 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';
const GOATCOUNTER_PRIVACY = 'https://www.goatcounter.com/gdpr';
const GARANTE = 'https://www.garanteprivacy.it';

const external = (href: string, text: string) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

/**
 * `#/privacy`: cosa resta sul dispositivo, dove sta il sito (GitHub Pages), cosa riceve il contatore di visite (GoatCounter) e cosa no.
 * Se cambia ciò che il sito raccoglie o a chi lo manda, va aggiornata qui e nei testi `priv_*` di tutte le lingue.
 */
export function privacyView(ctx: Ctx): HTMLElement {
  const { i18n } = ctx;
  const t = (key: string) => i18n.t(key);
  const section = (title: string, ...children: Node[]) => h('section', { class: 'card settings-section' }, h('h2', { class: 'card-title' }, title), ...children);
  const contact = () => h('p', { class: 'muted contact' }, `${t('info_contact')}: `, h('a', { href: `mailto:${CONTACT_EMAIL}` }, CONTACT_EMAIL));

  return h(
    'div',
    { class: 'view privacy' },
    h('h1', { class: 'page-title' }, t('priv_title')),
    h('p', { class: 'muted small' }, i18n.t('priv_updated', i18n.dateLong(PRIVACY_UPDATED))),
    h('p', { class: 'privacy-intro' }, t('priv_intro')),
    section(t('priv_owner_title'), h('p', null, t('priv_owner')), contact()),
    section(t('priv_local_title'), h('p', null, t('priv_local'))),
    section(t('priv_host_title'), h('p', null, t('priv_host')), h('p', { class: 'muted small links' }, external(GITHUB_PRIVACY, 'GitHub Privacy Statement'))),
    section(
      t('priv_stats_title'),
      h('p', null, t('priv_stats')),
      h('p', null, h('strong', null, t('priv_stats_sent'))),
      h('ul', { class: 'privacy-list' }, [1, 2, 3, 4].map((n) => h('li', null, t(`priv_sent_${n}`)))),
      h('p', null, t('priv_stats_ip')),
      h('p', null, t('priv_stats_never')),
      h('p', null, t('priv_stats_basis')),
      h('p', { class: 'muted small links' }, external(GOATCOUNTER_PRIVACY, 'GoatCounter: privacy')),
    ),
    section(t('priv_rights_title'), h('p', null, t('priv_rights')), h('p', { class: 'muted small links' }, external(GARANTE, 'Garante per la protezione dei dati personali')), contact()),
    h('a', { class: 'btn tonal', href: '#/settings', 'data-fk': 'privacy-back' }, t('priv_back')),
  );
}
