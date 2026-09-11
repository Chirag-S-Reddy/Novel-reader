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

  /* ---------------------------------------------------------------------
     Native bridge: the Android app injects `window.AndroidBridge` with:
       - pickFolder(): opens the SAF folder picker (async; result comes
         back via window.onFolderPicked(folderName, jsonFilesArray))
       - tryAutoReconnect(): if a folder was previously granted persistent
         access, re-reads it immediately and calls onFolderPicked again
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

    chaptersFolderStatus.textContent = 'Reading from: /storage/emulated/0/' + folderName;

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
  };

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

      const delBtn = document.createElement('button');
      delBtn.className = 'chapter-delete-btn';
      delBtn.textContent = '🗑';
      delBtn.title = 'Remove this chapter';
      delBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteChapter(i);
      });

      li.appendChild(label);
      li.appendChild(delBtn);
      if (i === currentIndex) li.classList.add('active');
      chapterListEl.appendChild(li);
    });
  }

  function deleteChapter(index) {
    const ch = chapters[index];
    if (!ch) return;
    if (!confirm(`Remove "${ch.title}" from the reading list?\n\n(This only removes it from this list — it will not delete the file on your device.)`)) {
      return;
    }

    const deleted = getDeletedSet();
    deleted.add(ch.filename);
    saveDeletedSet(deleted);

    const wasCurrent = index === currentIndex;
    chapters.splice(index, 1);

    if (chapters.length === 0) {
      currentIndex = -1;
      chapterListEl.innerHTML = '';
      welcomeEl.style.display = 'block';
      readerEl.style.display = 'none';
      localStorage.removeItem(lastChapterStorageKey());
      return;
    }

    if (wasCurrent) {
      const nextIndex = Math.min(index, chapters.length - 1);
      openChapter(nextIndex);
    } else {
      if (index < currentIndex) currentIndex--;
      renderChapterList(searchInput.value);
      updateNavButtons();
    }
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
    document.getElementById('reader-scroll').scrollTop = 0;

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
  document.getElementById('bottom-delete').addEventListener('click', () => {
    if (currentIndex !== -1) deleteChapter(currentIndex);
  });

  searchInput.addEventListener('input', () => renderChapterList(searchInput.value));

  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    syncScrim();
  });

  fontSmaller.addEventListener('click', () => {
    fontSize = Math.max(13, fontSize - 1);
    chapterTextEl.style.fontSize = fontSize + 'px';
  });
  fontBigger.addEventListener('click', () => {
    fontSize = Math.min(32, fontSize + 1);
    chapterTextEl.style.fontSize = fontSize + 'px';
  });

  const fontFamilySelect = document.getElementById('font-family-select');
  fontFamilySelect.addEventListener('change', () => {
    chapterTextEl.style.fontFamily = fontFamilySelect.value;
  });
  chapterTextEl.style.fontFamily = fontFamilySelect.value;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') openChapter(currentIndex + 1);
    if (e.key === 'ArrowLeft') openChapter(currentIndex - 1);
  });
})();
