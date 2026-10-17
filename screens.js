(function () {
  const $ = id => document.getElementById(id);
  const I18N_LANG_KEY = 'dukaan_ui_lang';
  function currentLang() { try { return localStorage.getItem(I18N_LANG_KEY) || 'en'; } catch { return 'en'; } }
  function setLang(code) {
    try { localStorage.setItem(I18N_LANG_KEY, code); } catch {}
    if (window.DukaanI18n) DukaanI18n.apply(document, code);
    renderLanguageGrid();
  }

  const history = ['screen-language'];
  function show(id) {
    for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
    if (history[history.length - 1] !== id) history.push(id);
    window.scrollTo(0, 0);
    const heading = document.querySelector('.screen:not([hidden]) h1, .screen:not([hidden]) h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus?.();
  }

  function speak(text, lang) {
    if (!window.speechSynthesis || !text) return;
    const codes = { hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', bn: 'bn-IN', mr: 'mr-IN', ml: 'ml-IN', en: 'en-IN' };
    const bcp = codes[lang] || 'en-IN';
    const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(bcp.split('-')[0]));
    const utter = new SpeechSynthesisUtterance(text);
    if (voice) { utter.voice = voice; utter.lang = voice.lang; } else utter.lang = bcp;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  function renderLanguageGrid() {
    const grid = $('langGrid');
    if (!grid || !window.DukaanI18n) return;
    const active = currentLang();
    grid.replaceChildren(...DukaanI18n.LANGUAGES.map(l => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'lang-card'; card.setAttribute('role', 'listitem');
      card.setAttribute('aria-pressed', String(l.code === active));
      const text = document.createElement('span');
      const strong = document.createElement('strong'); strong.textContent = l.native; strong.lang = l.code;
      const small = document.createElement('span'); small.textContent = l.name;
      text.append(strong, small);
      if (!l.ai) { const badge = document.createElement('span'); badge.className = 'limited-badge'; badge.textContent = 'Limited AI support'; text.append(badge); }
      card.append(text);
      card.onclick = () => { setLang(l.code); show('screen-home'); };
      const speakBtn = document.createElement('span');
      speakBtn.className = 'speak-name'; speakBtn.setAttribute('role', 'button'); speakBtn.tabIndex = 0;
      speakBtn.setAttribute('aria-label', 'Hear language name');
      speakBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/></svg>';
      const onSpeak = e => { e.stopPropagation(); speak(l.native, l.code); };
      speakBtn.onclick = onSpeak;
      speakBtn.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSpeak(e); } };
      card.append(speakBtn);
      return card;
    }));
  }

  function renderOndcSummary() {
    if (typeof window.ondcCatalog !== 'function' || typeof window.validateOndcCatalog !== 'function') return;
    let output, errors;
    try { output = window.ondcCatalog(); errors = window.validateOndcCatalog(output); }
    catch { errors = ['Add a product title and price before exporting.']; output = null; }
    const item = output?.message?.catalog?.providers?.[0]?.items?.[0];
    $('ondcSummaryTitle').textContent = item?.descriptor?.name || '—';
    $('ondcSummaryDescription').textContent = item?.descriptor?.long_desc || '';
    const t = key => DukaanI18n.get(currentLang(), key);
    const rows = [
      [t('category'), item?.category_ids?.[0] || '—'],
      [t('price'), item?.price ? item.price.currency + ' ' + item.price.value : t('notProvided')]
    ];
    $('ondcSummaryList').replaceChildren(...rows.map(([k, v]) => {
      const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = k;
      const span = document.createElement('span'); span.textContent = v; li.append(b, span); return li;
    }));
    const missingBox = $('ondcMissingBox'), missingList = $('ondcMissingList');
    missingList.replaceChildren(...errors.map(e => { const li = document.createElement('li'); li.textContent = e; return li; }));
    missingBox.hidden = errors.length === 0;
  }

  function wire() {
    renderLanguageGrid();
    setLang(currentLang());

    $('skipLanguage').onclick = () => show('screen-home');
    $('openLanguagePicker').onclick = () => show('screen-language');
    $('speakGuidanceBtn').onclick = () => speak(DukaanI18n.get(currentLang(), 'homeHelp'), currentLang());
    $('openSettings').onclick = () => show('screen-language');

    $('cameraCard').onclick = () => $('fileCamera').click();
    $('galleryCard').onclick = () => $('file').click();
    $('fileCamera').onchange = e => { if (typeof upload === 'function') upload(e.target.files[0]); };

    $('backFromReport').onclick = () => show('screen-home');
    $('reportContinue').onclick = () => {
      if (!$('confirmed').checked) { if (typeof toast === 'function') toast('Review the details and check the confirmation box before continuing.'); return; }
      if(!$('priceApproved').checked||!priceValid()){toast('Enter and approve a valid selling price before continuing.');return}
      show('screen-destinations');
    };
    $('backFromDestinations').onclick = () => show('screen-report');
    $('gotoInstagram').onclick = () => show('screen-instagram');
    $('gotoOndc').onclick = () => { renderOndcSummary(); show('screen-ondc'); };
    $('backFromInstagram').onclick = () => show('screen-destinations');
    $('backFromOndc').onclick = () => show('screen-destinations');
    $('analyzeRetry').onclick = () => { $('analyzeErrorBox').hidden = true; if (typeof analyzePhoto === 'function') analyzePhoto(); };

    window.DukaanScreens = { show, setLang, currentLang, speak, renderOndcSummary };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
