# Novel Reader — Android App

A native Android app version of the novel reader, with the music player
removed and the layout bugs (buttons disappearing/overflowing on small
screens) fixed.

## What changed from the HTML template

- **Music player removed entirely** — no audio UI, no audio code.
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

## How to build the APK

### Option A — From your phone, using GitHub Actions (no laptop needed)

1. Create a free account at [github.com](https://github.com) if you
   don't have one.
2. On github.com (use "Desktop site" in your phone browser if the
   mobile view is limited), tap **+ → New repository**, name it
   (e.g. `novel-reader`), and create it.
3. On the new repo's page, use **Add file → Upload files**. Your
   phone's file picker will open — select **all the files inside the
   unzipped `novelreader` folder** (some file-manager apps let you
   select a whole folder to drag in; if yours only lets you pick
   individual files, that's fine too, just make sure you keep the
   subfolders like `app/`, `.github/`, `gradle/` intact when
   selecting — most Android/iOS file browsers preserve folder
   structure when you drag a folder onto the GitHub upload box).
4. Scroll down, add a commit message, tap **Commit changes**.
5. GitHub Actions kicks off automatically because of the included
   `.github/workflows/build-apk.yml` — go to the repo's **Actions**
   tab to watch it (or trigger manually there via **Run workflow**).
6. Wait 3-5 minutes for the green checkmark.
7. Open the completed run → scroll to **Artifacts** → download
   **novel-reader-debug-apk** (a zip containing `app-debug.apk`).
8. Unzip that on your phone and tap the `.apk` to install (Android
   will prompt you to allow "install unknown apps" for your browser
   or file manager the first time — that's normal for anything not
   installed via the Play Store).

If your phone's browser won't let you upload a whole folder in one
go, the most reliable phone-only alternative is the **Working Copy**
app (iOS) or **Termux + git** (Android) to push the folder as a real
git repository instead of using the web uploader.

### Option B — On a computer with Android Studio

1. Unzip this project.
2. Open Android Studio → **Open** → select the unzipped `novelreader`
   folder.
3. Let Android Studio sync Gradle (first time may download the Gradle
   wrapper + Android SDK components — needs internet).
4. Plug in your Android phone (with USB debugging enabled) or use an
   emulator, then click the green **Run ▶** button — or go to
   **Build → Build Bundle(s)/APK(s) → Build APK(s)** to get an
   installable `.apk` file you can copy to your phone.
5. The built APK will be at:
   `app/build/outputs/apk/debug/app-debug.apk`

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
