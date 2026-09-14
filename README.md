# Novel Reader — Android App

A native Android app version of the novel reader, with the music player
removed and the layout bugs (buttons disappearing/overflowing on small
screens) fixed.

## Current features 

- **Music player removed entirely** — no audio UI, no audio code due to issues will be adressed in future.
- **Chapters folder is hardcoded** to
  `/storage/emulated/0/Novel/Chapters` (internal storage → `Novel` →
  `Chapters`). The app reads directly from this fixed path using
  Android's "All files access" permission — no folder picker, no
  per-run selection. Create that folder, drop your `.txt` chapter
  files in it, grant the permission once, and the app auto-loads it
  every time it opens.
- **Layout fixes**: topbar buttons now shrink/scroll instead of
  disappearing off-screen; flex children have `min-width: 0` so they
  don't get clipped; the font-family dropdown is capped in width on
  narrow screens; bottom nav buttons wrap instead of overflowing.
- Dark theme only (matches your saved preference).

## Setting up your chapters folder

1. On your phone, open any file manager app.
2. Go to **Internal storage** (the root of your phone's storage, not
   an SD card).
3. Create a folder named `Novel`, then inside it a folder named
   `Chapters` — so the full path is:
   `/storage/emulated/0/Novel/Chapters`
4. Put your `.txt` chapter files directly inside `Chapters`.
5. Open the app and tap **"Grant storage access"** — Android will take
   you to a permission screen; enable **"Allow access to manage all
   files"** (or similarly worded) for Novel Reader, then go back.
6. The app will automatically read every `.txt` file in that folder,
   every time you open it — no need to pick anything again.

**Note:** because the folder is hardcoded, if you ever want to point
the app at a different location, that requires changing the path in
`MainActivity.kt` (search for `chaptersDir`) and rebuilding.

## Using the app

1. Put your `.txt` chapter files in `/storage/emulated/0/Novel/Chapters`
   (see "Setting up your chapters folder" above).
2. Open the app, tap **"Grant storage access"** the first time to
   allow it to read that folder.
3. Chapters load into the sidebar automatically, sorted naturally.
   Tap one to read.
4. Use Prev/Next (top bar or bottom of chapter) to navigate, adjust
   font size/family in the top bar, and search chapters via the filter
   box in the sidebar.

Chapter files are read either in the original `chapter_downloader.py`
format (title / `Source:` line / `====` separator / body) or as plain
text files — either works.
