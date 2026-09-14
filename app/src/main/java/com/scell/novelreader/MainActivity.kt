package com.scell.novelreader

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var hasLoadedOnce = false

    // Root folder containing one subfolder per novel, e.g.
    // Novel/Shadow-Slave/*.txt, Novel/Iron-Prince/*.txt. The old flat
    // Novel/Chapters folder (from before novels were split up) is still
    // recognized and shown as one novel entry, for backward compatibility.
    private val novelRoot = File("/storage/emulated/0/Novel")

    /**
     * Writes any uncaught crash to a plain text file that can be opened
     * with any file manager (no logcat/adb needed) — useful for
     * diagnosing crashes on locked-down OEM Android builds (e.g. MIUI)
     * that restrict logcat access for non-debuggable apps.
     */
    private fun installCrashLogger() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val crashFile = File("/storage/emulated/0/Novel/crash_log.txt")
                crashFile.parentFile?.mkdirs()
                crashFile.writeText(
                    "Crash at ${java.util.Date()}\n" +
                        throwable.stackTraceToString()
                )
            } catch (e: Exception) {
                // If we can't even write the crash log, there's nothing more
                // we can do here — fall through to the default handler.
            }
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    private val manageStorageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        // Whether granted or not, try loading — listNovels() will report
        // an error to the JS side if permission is still missing.
        listNovels()
    }

    private val legacyPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) listNovels() else notifyError("Storage permission was not granted.")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installCrashLogger()

        webView = WebView(this)
        webView.setBackgroundColor(android.graphics.Color.BLACK)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                // The page (and reader.js, which defines window.onFolderPicked)
                // is now fully loaded, so it's safe to auto-load novels if
                // we already have permission.
                if (hasStoragePermission()) {
                    listNovels()
                }
            }
        }
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(
                view: WebView,
                url: String?,
                message: String?,
                result: JsResult
            ): Boolean {
                try {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                        .setOnCancelListener { result.cancel() }
                        .setCancelable(false)
                        .show()
                } catch (e: Exception) {
                    result.confirm()
                }
                return true
            }

            override fun onJsConfirm(
                view: WebView,
                url: String?,
                message: String?,
                result: JsResult
            ): Boolean {
                try {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                        .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                        .setOnCancelListener { result.cancel() }
                        .setCancelable(false)
                        .show()
                } catch (e: Exception) {
                    result.cancel()
                }
                return true
            }
        }

        webView.loadUrl("file:///android_asset/index.html")

        setupImmersiveMode()
    }

    /**
     * Makes the system navigation bar (the bottom back/home/recents bar)
     * transparent so our own dark background shows through it, with just
     * the back/home/recents icons visible on top — the same treatment
     * apps like Twitter/X use. The bar itself stays permanently present
     * (never hidden), only its background becomes see-through.
     *
     * The status bar at the top is left completely untouched: we only
     * let content draw edge-to-edge at the bottom, and we pad the
     * WebView's bottom-nav area by the nav bar's height so real content
     * (our Prev/Next buttons etc.) never sits underneath the icons.
     */
    private fun setupImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.navigationBarColor = android.graphics.Color.TRANSPARENT

        val controller = WindowInsetsControllerCompat(window, webView)
        controller.isAppearanceLightNavigationBars = false

        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            view.setPadding(0, statusBarInsets.top, 0, navBarInsets.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(webView)

        val currentInsets = ViewCompat.getRootWindowInsets(webView)
        if (currentInsets != null) {
            val navBarInsets = currentInsets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val statusBarInsets = currentInsets.getInsets(WindowInsetsCompat.Type.statusBars())
            webView.setPadding(0, statusBarInsets.top, 0, navBarInsets.bottom)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && ::webView.isInitialized) {
            setupImmersiveMode()
        }
    }

    override fun onPause() {
        super.onPause()
        if (::webView.isInitialized) {
            webView.onPause()
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
        }
        // Only (re)load novels on resume if we haven't successfully loaded
        // yet this session — e.g. the user just granted storage permission
        // in system Settings and is coming back. If we've already loaded
        // once, ordinary app-switching (checking a notification, etc.)
        // shouldn't re-scan the whole folder and rebuild the chapter list
        // every time; reader.js keeps its own state and scroll position
        // intact across a simple resume.
        if (::webView.isInitialized && webView.progress == 100 && hasStoragePermission() && !hasLoadedOnce) {
            listNovels()
        }
    }

    inner class AndroidBridge {

        // Called on startup and when the user taps "Grant storage access".
        // Requests permission if needed, then lists available novels.
        @JavascriptInterface
        fun pickFolder() {
            runOnUiThread { requestPermissionIfNeededThenLoad() }
        }

        @JavascriptInterface
        fun tryAutoReconnect() {
            runOnUiThread {
                if (hasStoragePermission()) listNovels()
            }
        }

        // Loads the chapters for one specific novel subfolder.
        @JavascriptInterface
        fun loadNovel(novelFolderName: String) {
            runOnUiThread { loadNovelChapters(novelFolderName) }
        }
    }

    private fun hasStoragePermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                this,
                android.Manifest.permission.READ_EXTERNAL_STORAGE
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestPermissionIfNeededThenLoad() {
        if (hasStoragePermission()) {
            listNovels()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:$packageName")
                manageStorageLauncher.launch(intent)
            } catch (e: Exception) {
                // Some devices don't support the app-specific screen; fall back
                // to the general "All files access" settings list.
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                manageStorageLauncher.launch(intent)
            }
        } else {
            legacyPermissionLauncher.launch(android.Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    /**
     * Scans /storage/emulated/0/Novel/ for subfolders (one per novel) and
     * sends the list to JS. The old flat Novel/Chapters folder (used
     * before novels were split into subfolders) is included as its own
     * entry too, for backward compatibility with existing setups.
     */
    private fun listNovels() {
        Thread {
            try {
                if (!hasStoragePermission()) {
                    runOnUiThread {
                        notifyError("Storage permission is needed to read /storage/emulated/0/Novel. Tap \"Grant storage access\" to allow it.")
                    }
                    return@Thread
                }

                if (!novelRoot.exists()) {
                    novelRoot.mkdirs()
                }

                val novelNames = novelRoot.listFiles { f -> f.isDirectory }
                    ?.map { it.name }
                    ?.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it })
                    ?: emptyList()

                val namesArray = JSONArray()
                novelNames.forEach { namesArray.put(it) }

                runOnUiThread {
                    hasLoadedOnce = true
                    webView.evaluateJavascript(
                        "window.onNovelsListed && window.onNovelsListed(${JSONObject.quote(namesArray.toString())});",
                        null
                    )
                }
            } catch (e: Exception) {
                runOnUiThread { notifyError("Could not read /storage/emulated/0/Novel: ${e.message}") }
            }
        }.start()
    }

    /**
     * Loads every .txt file inside /storage/emulated/0/Novel/<novelFolderName>/
     * and sends it to JS as the active novel's chapter list.
     */
    private fun loadNovelChapters(novelFolderName: String) {
        Thread {
            try {
                if (!hasStoragePermission()) {
                    runOnUiThread {
                        notifyError("Storage permission is needed to read that novel's folder.")
                    }
                    return@Thread
                }

                val safeName = File(novelFolderName).name // strips any path components
                val novelDir = File(novelRoot, safeName)

                if (!novelDir.exists() || !novelDir.isDirectory) {
                    runOnUiThread {
                        notifyError("Folder not found: /storage/emulated/0/Novel/$safeName")
                    }
                    return@Thread
                }

                val txtFiles = novelDir.listFiles { f ->
                    f.isFile && f.name.lowercase().endsWith(".txt")
                } ?: emptyArray()

                val filesArray = JSONArray()
                for (f in txtFiles) {
                    try {
                        val text = f.readText(Charsets.UTF_8)
                        val obj = JSONObject()
                        obj.put("name", f.name)
                        obj.put("text", text)
                        filesArray.put(obj)
                    } catch (e: Exception) {
                        // Skip unreadable file, continue with the rest.
                    }
                }

                val folderNameEscaped = JSONObject.quote(safeName)
                val filesJson = filesArray.toString()
                val filesJsonEscaped = JSONObject.quote(filesJson)

                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onFolderPicked($folderNameEscaped, $filesJsonEscaped);",
                        null
                    )
                }
            } catch (e: Exception) {
                runOnUiThread { notifyError("Could not read that novel's folder: ${e.message}") }
            }
        }.start()
    }

    private fun notifyError(message: String) {
        val msg = JSONObject.quote(message)
        webView.evaluateJavascript("window.onFolderPickError && window.onFolderPickError($msg);", null)
    }
}
