(function () {
  let chapters = [];      // {title, source, text, filename}
  let currentIndex = -1;
  let fontSize = 19;

  const chapterListEl = document.getElementById('chapter-list');
  const emptyNote = document.getElementById('empty-note');
  const searchInput = document.getElementById('chapter-search');

  const welcomeEl = document.getElementById('welcome');
  const readerEl = document.getElementById('reader');
  const chapterTitleEl = document.getElementById('chapter-title');
  const chapterSourceEl = document.getElementById('chapter-source');
  const chapterTextEl = document.getElementById('chapter-text');

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const bottomPrev = document.getElementById('bottom-prev');
  const bottomNext = document.getElementById('bottom-next');

  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');
  const sidebarScrim = document.getElementById('sidebar-scrim');

  const chaptersFolderStatus = document.getElementById('chapters-folder-status');
  const openChaptersBtn = document.getElementById('open-chapters-btn');
  const novelSelect = document.getElementById('novel-select');
  const readerScrollEl = document.getElementById('reader-scroll');
  const topbarEl = document.getElementById('topbar');

  function isMobileViewport() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  function syncScrim() {
    const open = isMobileViewport() && !sidebar.classList.contains('collapsed');
    sidebarScrim.classList.toggle('visible', open);
  }

  if (isMobileViewport()) {
    sidebar.classList.add('collapsed');
  }
  syncScrim();

  sidebarScrim.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    syncScrim();
  });
  window.addEventListener('resize', syncScrim);

  const fontSmaller = document.getElementById('font-smaller');
  const fontBigger = document.getElementById('font-bigger');

  /* ---------------------------------------------------------------------
     Parse the standard chapter-file format:
       Line 1: title
       Line 2: "Source: <url>" (optional)
       Line 3: "======..." separator (optional)
       Line 4: blank
       rest: chapter text
     Falls back gracefully to plain text files with no header.
  --------------------------------------------------------------------- */
  function parseChapterFile(filename, raw) {
    const lines = raw.split(/\r?\n/);
    let title = filename.replace(/\.txt$/i, "");
    let source = "";
    let bodyStart = 0;

    if (lines.length > 0 && lines[0].trim()) {
      title = lines[0].trim();
    }
    if (lines.length > 1 && /^Source:/i.test(lines[1].trim())) {
      source = lines[1].trim().replace(/^Source:\s*/i, "");
    }
    let sepIndex = lines.findIndex(l => /^=+$/.test(l.trim()));
    if (sepIndex !== -1) {
      bodyStart = sepIndex + 1;
      while (bodyStart < lines.length && lines[bodyStart].trim() === "") {
        bodyStart++;
      }
    } else {
      bodyStart = 0;
      title = filename.replace(/\.txt$/i, "");
    }

    const text = lines.slice(bodyStart).join("\n").trim() || raw.trim();
    return { title, source, text, filename };
  }

  function naturalCompare(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  function isNoiseParagraph(text, title) {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n = norm(text);
    if (!n) return true;
    if (n === norm(title)) return true;
    const navOnly = new Set([
      'prevchapter', 'nextchapter', 'previouschapter',
      'prevchapternextchapter', 'previouschapternextchapter',
      'nextchapterprevchapter', 'nextchapterpreviouschapter',
      'prev', 'next', 'previous',
      'tableofcontents', 'backtocontents', 'chapterlist',
    ]);
    return navOnly.has(n);
  }

  /* ---- Persistence (last chapter read + removed chapters), per folder ---- */

  let libraryKey = 'default';

  function lastChapterStorageKey() { return 'novelReader_lastChapter_' + libraryKey; }
  function deletedStorageKey() { return 'novelReader_deleted_' + libraryKey; }
  function scrollProgressKey(filename) { return 'novelReader_scrollProgress_' + libraryKey + '_' + filename; }

  function getDeletedSet() {
    try {
      return new Set(JSON.parse(localStorage.getItem(deletedStorageKey()) || '[]'));
    } catch (e) {
      return new Set();
    }
  }
  function saveDeletedSet(set) {
    localStorage.setItem(deletedStorageKey(), JSON.stringify(Array.from(set)));
  }
  function saveLastChapter(filename) {
    localStorage.setItem(lastChapterStorageKey(), filename);
  }
  function getLastChapter() {
    return localStorage.getItem(lastChapterStorageKey());
  }

  // Scroll progress is stored as a 0-1 fraction of the chapter's
  // scrollable height, not raw pixels, so it still lines up correctly
  // even if font size or screen size changes between sessions.
  function saveScrollProgress(filename, fraction) {
    localStorage.setItem(scrollProgressKey(filename), String(fraction));
  }
  function getScrollProgress(filename) {
    const raw = localStorage.getItem(scrollProgressKey(filename));
    const value = raw !== null ? parseFloat(raw) : NaN;
    return isNaN(value) ? 0 : value;
  }
  function clearScrollProgress(filename) {
    localStorage.removeItem(scrollProgressKey(filename));
  }

  /* ---------------------------------------------------------------------
     Native bridge: the Android app injects `window.AndroidBridge` with:
       - pickFolder(): requests storage permission if needed, then lists
         every novel subfolder under /storage/emulated/0/Novel via
         window.onNovelsListed(jsonNamesArray)
       - tryAutoReconnect(): if permission was already granted, lists
         novels immediately the same way
       - loadNovel(name): reads every .txt file inside that novel's
         subfolder and delivers it via
         window.onFolderPicked(folderName, jsonFilesArray)
     jsonFilesArray is a JSON string: [{name, text}, ...]
  --------------------------------------------------------------------- */

  function processChapterFiles(fileObjs, folderName) {
    const txtFiles = fileObjs.filter(f => /\.txt$/i.test(f.name));
    if (txtFiles.length === 0) {
      alert("No .txt files found in that folder.");
      return;
    }

    libraryKey = folderName || 'default';

    txtFiles.sort((a, b) => naturalCompare(a.name, b.name));

    const deleted = getDeletedSet();
    const loaded = [];
    for (const f of txtFiles) {
      if (deleted.has(f.name)) continue;
      loaded.push(parseChapterFile(f.name, f.text));
    }

    chapters = loaded;
    renderChapterList();
    emptyNote.style.display = 'none';

    chaptersFolderStatus.textContent = 'Novel: ' + folderName;
    openChaptersBtn.style.display = 'none';

    if (chapters.length === 0) {
      alert("All chapters in this folder were removed from the reader list. Add files or clear app storage to reset.");
      return;
    }

    const last = getLastChapter();
    const resumeIndex = last ? chapters.findIndex(c => c.filename === last) : -1;
    openChapter(resumeIndex !== -1 ? resumeIndex : 0);
  }

  window.onFolderPicked = function (folderName, filesJson) {
    try {
      const files = JSON.parse(filesJson);
      processChapterFiles(files, folderName);
    } catch (e) {
      console.error('Failed to parse folder contents', e);
      alert('Could not read that folder.');
    }
  };

  window.onFolderPickError = function (message) {
    if (message) {
      chaptersFolderStatus.textContent = message;
    }
    openChaptersBtn.style.display = '';
  };

  const CURRENT_NOVEL_KEY = 'novelReader_currentNovel';

  window.onNovelsListed = function (namesJson) {
    let names;
    try {
      names = JSON.parse(namesJson);
    } catch (e) {
      console.error('Failed to parse novel list', e);
      return;
    }

    if (!Array.isArray(names) || names.length === 0) {
      novelSelect.classList.add('hidden');
      novelSelect.innerHTML = '';
      chaptersFolderStatus.textContent = '';
      emptyNote.style.display = '';
      return;
    }

    novelSelect.innerHTML = '';
    names.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      novelSelect.appendChild(opt);
    });

    if (names.length > 1) {
      novelSelect.classList.remove('hidden');
    } else {
      novelSelect.classList.add('hidden');
    }

    const savedNovel = localStorage.getItem(CURRENT_NOVEL_KEY);
    const novelToLoad = (savedNovel && names.includes(savedNovel)) ? savedNovel : names[0];
    novelSelect.value = novelToLoad;
    requestNovelLoad(novelToLoad);
  };

  function requestNovelLoad(novelName) {
    localStorage.setItem(CURRENT_NOVEL_KEY, novelName);
    if (window.AndroidBridge && window.AndroidBridge.loadNovel) {
      window.AndroidBridge.loadNovel(novelName);
    }
  }

  novelSelect.addEventListener('change', () => {
    // Switching novels: reset the reading pane until the new novel's
    // chapters arrive, so stale content isn't shown mid-switch.
    chapters = [];
    currentIndex = -1;
    chapterListEl.innerHTML = '';
    welcomeEl.style.display = 'block';
    readerEl.style.display = 'none';
    requestNovelLoad(novelSelect.value);
  });

  function pickChaptersFolder() {
    if (window.AndroidBridge && window.AndroidBridge.pickFolder) {
      window.AndroidBridge.pickFolder();
    } else {
      alert('Storage access is not available. This app needs to run as the installed Android app, not a plain browser tab.');
    }
  }

  openChaptersBtn.addEventListener('click', pickChaptersFolder);

  // On startup, ask the native side to silently reconnect to a
  // previously-granted folder, if any.
  if (window.AndroidBridge && window.AndroidBridge.tryAutoReconnect) {
    window.AndroidBridge.tryAutoReconnect();
  }

  function renderChapterList(filter) {
    chapterListEl.innerHTML = '';
    const f = (filter || '').toLowerCase();
    chapters.forEach((ch, i) => {
      if (f && !ch.title.toLowerCase().includes(f)) return;
      const li = document.createElement('li');
      li.className = 'chapter-item';

      const label = document.createElement('span');
      label.className = 'chapter-item-label';
      label.textContent = ch.title;
      label.addEventListener('click', () => openChapter(i));

      li.appendChild(label);
      if (i === currentIndex) li.classList.add('active');
      chapterListEl.appendChild(li);
    });
  }

  function openChapter(index) {
    if (index < 0 || index >= chapters.length) return;
    currentIndex = index;
    const ch = chapters[index];

    welcomeEl.style.display = 'none';
    readerEl.style.display = 'block';

    chapterTitleEl.textContent = ch.title;
    chapterSourceEl.innerHTML = ch.source
      ? `Source: <a href="${ch.source}" target="_blank" rel="noopener">${ch.source}</a>`
      : '';

    chapterTextEl.innerHTML = '';
    ch.text.split(/\n\s*\n/).forEach(para => {
      const trimmed = para.trim();
      if (!trimmed) return;
      if (isNoiseParagraph(trimmed, ch.title)) return;
      const p = document.createElement('p');
      p.textContent = trimmed;
      chapterTextEl.appendChild(p);
    });

    saveLastChapter(ch.filename);

    renderChapterList(searchInput.value);
    updateNavButtons();
    document.getElementById('topbar').classList.remove('hidden');

    // Restore reading progress for this chapter (0 for a chapter never
    // opened before, or one finished/reset). Wait a tick so the browser
    // has laid out the freshly-inserted paragraphs and scrollHeight is
    // accurate before we compute the target scroll position.
    requestAnimationFrame(() => {
      const fraction = getScrollProgress(ch.filename);
      const maxScroll = readerScrollEl.scrollHeight - readerScrollEl.clientHeight;
      readerScrollEl.scrollTop = maxScroll > 0 ? fraction * maxScroll : 0;
    });

    if (isMobileViewport()) {
      sidebar.classList.add('collapsed');
      syncScrim();
    }
  }

  function updateNavButtons() {
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < chapters.length - 1;
    [prevBtn, bottomPrev].forEach(b => b.disabled = !hasPrev);
    [nextBtn, bottomNext].forEach(b => b.disabled = !hasNext);
  }

  prevBtn.addEventListener('click', () => openChapter(currentIndex - 1));
  nextBtn.addEventListener('click', () => openChapter(currentIndex + 1));
  bottomPrev.addEventListener('click', () => openChapter(currentIndex - 1));
  bottomNext.addEventListener('click', () => openChapter(currentIndex + 1));

  searchInput.addEventListener('input', () => renderChapterList(searchInput.value));

  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    syncScrim();
  });

  fontSmaller.addEventListener('click', () => {
    fontSize = Math.max(13, fontSize - 1);
    chapterTextEl.style.fontSize = fontSize + 'px';
    savePreference('fontSize', fontSize);
  });
  fontBigger.addEventListener('click', () => {
    fontSize = Math.min(32, fontSize + 1);
    chapterTextEl.style.fontSize = fontSize + 'px';
    savePreference('fontSize', fontSize);
  });

  const fontFamilySelect = document.getElementById('font-family-select');
  fontFamilySelect.addEventListener('change', () => {
    chapterTextEl.style.fontFamily = fontFamilySelect.value;
    savePreference('fontFamily', fontFamilySelect.value);
  });

  /* ---- Appearance preferences: font size/family + reading colors,
     persisted across app restarts. ---- */

  const PREFS_KEY = 'novelReader_appearance';
  const DEFAULT_BG = '#000000';
  const DEFAULT_TEXT = '#e6e6ea';
  const DEFAULT_LINE_HEIGHT = 1.9;
  const DEFAULT_LETTER_SPACING = 0;

  function loadPreferences() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function savePreference(key, value) {
    const prefs = loadPreferences();
    prefs[key] = value;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function applyReadingColors(bg, text) {
    document.documentElement.style.setProperty('--read-bg', bg);
    document.documentElement.style.setProperty('--read-text', text);
    bgColorInput.value = bg;
    textColorInput.value = text;
  }

  function applyLineHeight(value) {
    chapterTextEl.style.lineHeight = value;
    lineHeightInput.value = value;
  }

  function applyLetterSpacing(value) {
    chapterTextEl.style.letterSpacing = value + 'px';
    letterSpacingInput.value = value;
  }

  const themeToggleBtn = document.getElementById('theme-toggle');
  const themePanel = document.getElementById('theme-panel');
  const bgColorInput = document.getElementById('bg-color-input');
  const textColorInput = document.getElementById('text-color-input');
  const lineHeightInput = document.getElementById('line-height-input');
  const letterSpacingInput = document.getElementById('letter-spacing-input');
  const themeResetBtn = document.getElementById('theme-reset-btn');

  themeToggleBtn.addEventListener('click', () => {
    themePanel.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (themePanel.classList.contains('hidden')) return;
    if (themePanel.contains(e.target) || e.target === themeToggleBtn) return;
    themePanel.classList.add('hidden');
  });

  bgColorInput.addEventListener('input', () => {
    applyReadingColors(bgColorInput.value, textColorInput.value);
    savePreference('readBg', bgColorInput.value);
  });

  textColorInput.addEventListener('input', () => {
    applyReadingColors(bgColorInput.value, textColorInput.value);
    savePreference('readText', textColorInput.value);
  });

  lineHeightInput.addEventListener('input', () => {
    applyLineHeight(lineHeightInput.value);
    savePreference('lineHeight', parseFloat(lineHeightInput.value));
  });

  letterSpacingInput.addEventListener('input', () => {
    applyLetterSpacing(letterSpacingInput.value);
    savePreference('letterSpacing', parseFloat(letterSpacingInput.value));
  });

  themeResetBtn.addEventListener('click', () => {
    applyReadingColors(DEFAULT_BG, DEFAULT_TEXT);
    applyLineHeight(DEFAULT_LINE_HEIGHT);
    applyLetterSpacing(DEFAULT_LETTER_SPACING);
    savePreference('readBg', DEFAULT_BG);
    savePreference('readText', DEFAULT_TEXT);
    savePreference('lineHeight', DEFAULT_LINE_HEIGHT);
    savePreference('letterSpacing', DEFAULT_LETTER_SPACING);
  });

  // Apply saved preferences on startup.
  (function restoreAppearance() {
    const prefs = loadPreferences();

    if (typeof prefs.fontSize === 'number') {
      fontSize = prefs.fontSize;
    }
    chapterTextEl.style.fontSize = fontSize + 'px';

    const fontFamily = prefs.fontFamily || fontFamilySelect.value;
    fontFamilySelect.value = fontFamily;
    chapterTextEl.style.fontFamily = fontFamily;

    applyReadingColors(prefs.readBg || DEFAULT_BG, prefs.readText || DEFAULT_TEXT);
    applyLineHeight(typeof prefs.lineHeight === 'number' ? prefs.lineHeight : DEFAULT_LINE_HEIGHT);
    applyLetterSpacing(typeof prefs.letterSpacing === 'number' ? prefs.letterSpacing : DEFAULT_LETTER_SPACING);
  })();

  /* ---- Auto-hide top bar on scroll down, reveal on scroll up;
     also save reading progress (debounced) as the user scrolls. ---- */

  let lastScrollTop = 0;
  const SCROLL_HIDE_THRESHOLD = 8; // ignore tiny/jittery scroll movements
  let scrollSaveTimer = null;

  function flushScrollProgress() {
    if (currentIndex === -1) return;
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = null;
    const ch = chapters[currentIndex];
    const maxScroll = readerScrollEl.scrollHeight - readerScrollEl.clientHeight;
    const fraction = maxScroll > 0 ? readerScrollEl.scrollTop / maxScroll : 0;
    saveScrollProgress(ch.filename, fraction);
  }

  readerScrollEl.addEventListener('scroll', () => {
    const currentScrollTop = readerScrollEl.scrollTop;
    const delta = currentScrollTop - lastScrollTop;

    if (currentScrollTop <= 0) {
      // Always show the bar once back at the very top.
      topbarEl.classList.remove('hidden');
    } else if (delta > SCROLL_HIDE_THRESHOLD) {
      topbarEl.classList.add('hidden');
      lastScrollTop = currentScrollTop;
    } else if (delta < -SCROLL_HIDE_THRESHOLD) {
      topbarEl.classList.remove('hidden');
      lastScrollTop = currentScrollTop;
    }

    if (currentIndex !== -1) {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(flushScrollProgress, 400);
    }
  }, { passive: true });

  // Flush immediately (bypassing the 400ms debounce) whenever the app is
  // about to be backgrounded or closed, so a quick app-switch mid-scroll
  // never loses progress. 'visibilitychange' is the reliable one in
  // Android WebView; 'pagehide' is included as a fallback for good measure.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushScrollProgress();
    }
  });
  window.addEventListener('pagehide', flushScrollProgress);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') openChapter(currentIndex + 1);
    if (e.key === 'ArrowLeft') openChapter(currentIndex - 1);
  });

  /* ---------------------------------------------------------------------
     Touch gestures (reading pane only, so buttons/sidebar/links keep
     working normally):
       - Swipe left-to-right: open the sidebar menu
       - Swipe right-to-left: close the sidebar if it's open, otherwise
         advance to the next chapter (no gesture for previous chapter)
       - Single tap on the left third of the reading pane: scroll up
         one screen height (pagination)
       - Single tap on the right third of the reading pane: scroll down
         one screen height (pagination)
       - Tap on the middle third: does nothing (reserved, avoids
         accidental triggers while reading/selecting text)
  --------------------------------------------------------------------- */

  const SWIPE_MIN_DISTANCE = 60;   // px, minimum horizontal travel to count as a swipe
  const SWIPE_MAX_VERTICAL = 60;   // px, max vertical drift allowed to still count as horizontal
  const TAP_MAX_MOVE = 24;         // px, max finger movement to still count as a tap (not a swipe)

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTarget = null;

  readerScrollEl.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTarget = e.target;
  }, { passive: true });

  readerScrollEl.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // --- Swipe detection: mostly-horizontal drag past the threshold ---
    if (absDx >= SWIPE_MIN_DISTANCE && absDy <= SWIPE_MAX_VERTICAL) {
      if (dx > 0) {
        // Left-to-right: open the sidebar.
        sidebar.classList.remove('collapsed');
        syncScrim();
      } else {
        // Right-to-left: close the sidebar if open, otherwise next chapter.
        const sidebarIsOpen = isMobileViewport() && !sidebar.classList.contains('collapsed');
        if (sidebarIsOpen) {
          sidebar.classList.add('collapsed');
          syncScrim();
        } else {
          openChapter(currentIndex + 1);
        }
      }
      return; // don't also evaluate this as a tap
    }

    // --- Tap-to-scroll pagination: only for taps that started inside
    //     the reading pane and barely moved (a tap, not a swipe) ---
    if (absDx > TAP_MAX_MOVE || absDy > TAP_MAX_MOVE) return;

    // Ignore taps on real interactive elements (links) inside the text.
    if (touchStartTarget && touchStartTarget.closest && touchStartTarget.closest('a')) return;

    const zone = touch.clientX / window.innerWidth;
    const pageHeight = readerScrollEl.clientHeight * 0.9; // slight overlap so context carries over

    if (zone <= 1 / 3) {
      readerScrollEl.scrollBy({ top: -pageHeight, behavior: 'smooth' });
    } else if (zone >= 2 / 3) {
      readerScrollEl.scrollBy({ top: pageHeight, behavior: 'smooth' });
    }
    // middle third: no-op
  }, { passive: true });
})();
