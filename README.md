# Embedded Novel Audio Player for Android


A lightweight, distraction-free background audio player designed specifically for integration into offline reading and novel applications. Built with Kotlin and AndroidX Media3 (ExoPlayer), this module bypasses heavy media library databases and complex playlist managers to stream exclusively from a user-designated local directory.


---


## Features & Implementation Roadmap


### Storage & File Management
- [ ] Pick and configure fixed directory path (e.g., App-specific External Storage or Storage Access Framework tree URI)
- [ ] Direct file loader scanning audio exclusively from the target folder (no full-device media indexing)
- [ ] Local ID3 metadata extraction (extract Title, Artist, and Duration directly using `MediaMetadataRetriever`)
- [ ] Simple 'Favorites' flag (store a lightweight set of favorited filenames in local storage to filter playback)


### Playback Engine (AndroidX Media3 / ExoPlayer)
- [ ] Universal audio format support out of the box (MP3, FLAC, Ogg Vorbis/Opus, AAC, WAV)
- [ ] Gapless audio playback for ambient loops and soundtrack immersion
- [ ] Audio focus management (automatic ducking on notifications and pausing on incoming phone calls)
- [ ] Looping mode controls: Toggle between Loop Folder (`REPEAT_MODE_ALL`) and Loop Current Track (`REPEAT_MODE_ONE`)
- [ ] Shuffle playback mode (pseudo-randomized queue order)
- [ ] Playback queue management (reorder, jump to track, view incoming sequence)
- [ ] Accurate track scrubbing and seeking support


### Background Service & System Integration
- [ ] Android Foreground Service (`MediaSessionService`) ensuring zero audio drops while reading or with screen off
- [ ] System notification with standard media transport controls (Play, Pause, Next, Previous)
- [ ] Lock screen media metadata and playback controls via `MediaSession`
- [ ] Headset and Bluetooth hardware button handling


### Reader Comfort & Utility
- [ ] Minimal reading UI controls (floating action button or inline reading bar without popups or obscuring mini-bars)
- [ ] Sleep timer with smooth volume fade-out (gradually decreases gain over 30 seconds before pausing)
- [ ] Track bookmarking & state persistence (resume last played file and millisecond timestamp on app restart)


---


## Tech Stack & Architecture


- **Language:** Kotlin
- **Core Engine:** [AndroidX Media3 (ExoPlayer)](https://developer.android.com/media/media3)
- **Session Handling:** `androidx.media3.session.MediaSessionService`
- **UI Integration:** Android Views / Jetpack Compose / WebView (CSS styled interface)
- **Storage:** Standard Java/Kotlin `java.io.File` / SAF `DocumentFile` & `SharedPreferences` / DataStore


---


## Recommended GitHub Implementation Patterns


### 1. Audio Focus & Player Initialization
```kotlin
val audioAttributes = AudioAttributes.Builder()
    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
    .setUsage(C.USAGE_MEDIA)
    .build()


val player = ExoPlayer.Builder(context)
    .setAudioAttributes(audioAttributes, /* handleAudioFocus = */ true)
    .build()
```


### 2. Scanning the Target Directory
Avoid querying `MediaStore.Audio` to prevent scanning unnecessary system audio. Instead, load files directly from the folder:


```kotlin
fun loadFolderAudio(folder: File): List<MediaItem> {
    val supportedExtensions = setOf("mp3", "flac", "ogg", "wav", "m4a", "opus")
    return folder.listFiles { file ->
        file.isFile && file.extension.lowercase() in supportedExtensions
    }?.map { file ->
        MediaItem.Builder()
            .setUri(Uri.fromFile(file))
            .setMediaId(file.absolutePath)
            .build()
    } ?: emptyList()
}
```


### 3. Background Playback Service
Extend `MediaSessionService` so that Android handles foreground lifecycle, notification actions, and lock screen widgets automatically:


```kotlin
class AudioPlayerService : MediaSessionService() {
    private var mediaSession: MediaSession? = null


    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this)
            .setAudioAttributes(AudioAttributes.DEFAULT, true)
            .build()
        mediaSession = MediaSession.Builder(this, player).build()
    }


    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession


    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
```


### 4. Sleep Timer with Volume Fade
```kotlin
suspend fun startSleepTimer(player: Player, totalDurationMs: Long) {
    val fadeDurationMs = 30_000L
    val runDurationMs = (totalDurationMs - fadeDurationMs).coerceAtLeast(0L)
    
    kotlinx.coroutines.delay(runDurationMs)
    
    // Smooth 30-second volume fade
    val steps = 30
    for (i in steps downTo 0) {
        player.volume = i / steps.toFloat()
        kotlinx.coroutines.delay(1000L)
    }
    
    player.pause()
    player.volume = 1.0f // Reset volume for next session
}
```


---


## References & Useful Repositories


- [androidx/media (GitHub)](https://github.com/androidx/media) – Official Google Media3 showcase, samples, and session service architectures.
- [ajay99511/FastBeat (GitHub)](https://github.com/ajay99511/FastBeat) – Lightweight, offline Android music player using Kotlin and Media3.
- [mr3y-the-programmer/Podcaster (GitHub)](https://github.com/mr3y-the-programmer/Podcaster) – Clean background queue handling and playback state persistence.


---


## License
MIT License