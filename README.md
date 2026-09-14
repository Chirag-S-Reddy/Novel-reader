# Novel Reader — Android App


A native Android app version of the novel reader, featuring a distraction-free reader interface alongside a minimal, integrated local background audio player.


---


## What changed from the HTML template


- **Minimal background audio player integrated** — Built using AndroidX Media3 (ExoPlayer) and `MediaSessionService`. Runs in a foreground service so music continues seamlessly while reading or when the screen is off.
- **Dedicated music folder** — Hardcoded to `/storage/emulated/0/Novel/Music`. Drop your audio files (`.mp3`, `.flac`, `.ogg`, `.wav`, etc.) directly into this folder; the player auto-loads them without system-wide media scanning.
- **Chapters folder hardcoded** — Set to `/storage/emulated/0/Novel/Chapters`. The app reads directly from this fixed path using Android's "All files access" permission — no folder pickers or per-run selections needed.
- **Layout fixes**: Topbar buttons now shrink/scroll instead of disappearing off-screen; flex children have `min-width: 0` so they don't clip; font-family dropdown is capped in width on narrow screens; bottom nav buttons wrap instead of overflowing.
- Dark theme only (matches your saved preference).


---


## Upcoming Novel Reader Features (Implementation Checklist)


### Reading Controls & Navigation
- [ ] Tap zones for auto-scrolling: Tap upper region to auto-scroll up, tap lower region to auto-scroll down
- [ ] Chapter and paragraph bookmarks support
- [ ] Low-priority utility: End-of-novel trigger button to launch Termux via Android intent (`com.termux`)


### Status Bar & UI Polish
- [ ] Top status clock adjustment: Shift left by ~25mm, render in **bold**, and format with 12-hour AM/PM display


### Reading Analytics & Digital Wellbeing
- [ ] Track and store total active reading session duration
- [ ] In-app reading time limits / session restriction alerts


---


## Planned Audio Player Features (Implementation Checklist)


### Storage & File Management
- [ ] Pick and configure fixed directory path (`/storage/emulated/0/Novel/Music`)
- [ ] Direct file loader scanning audio exclusively from the target folder
- [ ] Local ID3 metadata extraction (extract Title, Artist, and Duration via `MediaMetadataRetriever`)
- [ ] Simple 'Favorites' flag (store a lightweight set of favorited filenames in local storage)


### Playback Engine (AndroidX Media3 / ExoPlayer)
- [ ] Universal audio format support (MP3, FLAC, Ogg Vorbis/Opus, AAC, WAV)
- [ ] Gapless audio playback for ambient loops
- [ ] Audio focus management (automatic ducking on notifications, pause on incoming phone calls)
- [ ] Looping mode controls: Toggle between Loop Folder (`REPEAT_MODE_ALL`) and Loop Current Track (`REPEAT_MODE_ONE`)
- [ ] Shuffle playback mode
- [ ] Playback queue management
- [ ] Accurate track scrubbing and seek bar


### Background Service & System Integration
- [ ] Android Foreground Service (`MediaSessionService`) for background audio
- [ ] System notification with media transport controls (Play, Pause, Next, Previous)
- [ ] Lock screen media metadata and playback controls via `MediaSession`
- [ ] Headset and Bluetooth hardware button handling


### Reader Comfort & Utility
- [ ] Minimal reading UI controls (floating action button or inline toolbar; no obscuring mini-bars or popups)
- [ ] Sleep timer with smooth 30-second volume fade-out
- [ ] Track bookmarking & state persistence (resume last played file and millisecond timestamp)


---


## Setting up your folders


1. On your phone, open any file manager app.
2. Go to **Internal storage** (the root of your device storage).
3. Create a parent folder named `Novel`.
4. Inside `Novel`, create two subfolders:
   - `Chapters` → Full path: `/storage/emulated/0/Novel/Chapters`
   - `Music` → Full path: `/storage/emulated/0/Novel/Music`
5. Place your `.txt` novel files into `Chapters`, and your audio files (`.mp3`, `.flac`, `.ogg`, etc.) into `Music`.
6. Open the app and tap **"Grant storage access"** — enable **"Allow access to manage all files"** for Novel Reader, then return to the app.
7. The app will automatically detect and load your chapters and audio files on startup.


**Note:** If you want to change either folder path, update `chaptersDir` or `musicDir` in `MainActivity.kt` and rebuild the app.


---


## How to build the APK


### Option A — From your phone, using GitHub Actions (no laptop needed)


1. Create a free account at [github.com](https://github.com) if you don't have one.
2. On github.com (use "Desktop site" in your phone browser if needed), tap **+ → New repository**, name it (e.g. `novel-reader`), and create it.
3. On the repository page, use **Add file → Upload files**. Select all the files inside the unzipped `novelreader` folder, ensuring directory structure (`app/`, `.github/`, `gradle/`) is preserved.
4. Scroll down, add a commit message, and tap **Commit changes**.
5. GitHub Actions will trigger automatically via `.github/workflows/build-apk.yml`. Monitor the progress in the **Actions** tab.
6. Wait 3–5 minutes for the run to complete.
7. Open the completed run → scroll down to **Artifacts** → download **novel-reader-debug-apk** (contains `app-debug.apk`).
8. Unzip the artifact and tap `.apk` to install (allow "install unknown apps" if prompted).


*Alternative for mobile Git users:* Use **Termux + git** or **Working Copy** to push the repository directly.


### Option B — On a computer with Android Studio


1. Unzip the project folder.
2. Open Android Studio → **Open** → select the unzipped `novelreader` directory.
3. Let Gradle sync dependencies (AndroidX Media3, core libraries, etc.).
4. Connect your Android device via USB debugging (or start an emulator) and click **Run ▶**, or select **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
5. The built APK will be located at:
   `app/build/outputs/apk/debug/app-debug.apk`


---


## Using the app


1. Ensure your chapters and music files are placed in `/storage/emulated/0/Novel/Chapters` and `/storage/emulated/0/Novel/Music`.
2. Open the app and grant storage permissions when prompted on first launch.
3. Chapters load into the sidebar automatically, sorted naturally. Tap any chapter to begin reading.
4. Navigate using Prev/Next buttons (top bar or bottom of the screen), adjust font settings in the top bar, or search via the filter box.
5. Control background ambient music using the minimal inline/floating audio controls or directly from your device notification shade and lock screen.