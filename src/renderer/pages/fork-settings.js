'use strict';
// fork: the "Personal fork" section of Settings (blanc://settings).
//
// settings.html has one empty <section id="group-fork"> and its sidebar link;
// settings.js calls window.blancForkSettings.render(settings) once, before the
// sidebar is set up. Everything else is here: a new fork setting is one entry
// in CARDS below, plus its key in src/main/fork/settings.js, its strings
// (fork.* in copy/messages/*.json) and its schema key. See FORK.md → "Adding a
// fork setting".
//
// Main is the sole validator (src/main/fork/settings.js): every change is sent
// with bowserPages.settings.set and the field shows what was actually stored.
// A refused value stays in the field with its error, like upstream's custom
// search address.
(function () {
  const CARDS = [
    {
      title: 'fork.settings.goLinks.title',
      settings: [
        // fork(0002)
        {
          key: 'goLinkTemplate',
          type: 'url',
          label: 'fork.settings.goLinkTemplate.label',
          hint: 'fork.settings.goLinkTemplate.hint',
          error: 'fork.settings.goLinkTemplate.error',
          placeholder: 'https://example.glean.com/go/%s',
        },
      ],
    },
  ];

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(props)) {
      if (name === 'className') node.className = value;
      else if (name === 'text') node.textContent = value;
      else if (name === 'hidden') node.hidden = value;
      else node.setAttribute(name, value);
    }
    for (const child of children) node.append(child);
    return node;
  }

  function urlSetting(spec, stored, t) {
    const id = `fork-${spec.key}`;
    const labelId = `${id}-label`;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const input = el('input', {
      id, type: 'url', autocomplete: 'off', spellcheck: 'false',
      placeholder: spec.placeholder ?? '', 'aria-labelledby': labelId, 'aria-describedby': hintId,
    });
    const error = el('span', { id: errorId, className: 'hint field-error', role: 'alert', hidden: true, text: t(spec.error) });
    // The error joins the field's description only while it shows: Chromium
    // reads a hidden element named by aria-describedby.
    const setError = (shown) => {
      error.hidden = !shown;
      input.setAttribute('aria-invalid', String(shown));
      input.setAttribute('aria-describedby', shown ? `${hintId} ${errorId}` : hintId);
    };
    input.value = stored ?? '';
    input.addEventListener('change', async () => {
      const value = input.value.trim();
      const next = await window.bowserPages.settings.set({ [spec.key]: value });
      if (next[spec.key] !== value) { setError(true); return; } // refused: keep the draft
      input.value = next[spec.key];
      setError(false);
    });
    return el('div', { className: 'setting', id: `${id}-setting` }, [
      el('div', { className: 'label' }, [
        el('span', { id: labelId, text: t(spec.label) }),
        el('span', { id: hintId, className: 'hint', text: t(spec.hint) }),
        error,
      ]),
      input,
    ]);
  }

  const BUILDERS = { url: urlSetting };

  function render(settings) {
    const section = document.getElementById('group-fork');
    if (!section || !window.blancI18n) return;
    const { t } = window.blancI18n;
    section.replaceChildren(
      el('h2', { className: 'group-title', text: t('fork.settings.title') }),
      el('p', { className: 'section-hint', text: t('fork.settings.intro') }),
      ...CARDS.map((card) => el('div', { className: 'settings-card settings-card--mixed' }, [
        el('h3', { className: 'card-title', text: t(card.title) }),
        ...card.settings.map((spec) => BUILDERS[spec.type](spec, settings?.[spec.key], t)),
      ])),
    );
  }

  window.blancForkSettings = { render, CARDS };
})();
