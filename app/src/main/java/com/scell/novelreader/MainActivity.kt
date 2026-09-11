package com.scell.novelreader

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    // Hardcoded chapters directory, as requested.
    private val chaptersDir = File("/storage/emulated/0/Novel/Chapters")

    private val manageStorageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        // Whether granted or not, try loading — loadChapters() will report
        // an error to the JS side if permission is still missing.
        loadChapters()
    }

    private val legacyPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) loadChapters() else notifyError("Storage permission was not granted.")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onResume() {
        super.onResume()
        // If the user just came back from the "All files access" settings
        // screen, refresh automatically.
        if (hasStoragePermission()) {
            loadChapters()
        }
    }

    inner class AndroidBridge {

        // Kept for compatibility with the existing web JS, which calls this
        // on startup and when the "Open chapters folder" button is tapped.
        // Both now just (re)load the hardcoded directory.
        @JavascriptInterface
        fun pickFolder() {
            runOnUiThread { requestPermissionIfNeededThenLoad() }
        }

        @JavascriptInterface
        fun tryAutoReconnect() {
            runOnUiThread {
                if (hasStoragePermission()) loadChapters()
            }
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
            loadChapters()
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

    private fun loadChapters() {
        Thread {
            try {
                if (!hasStoragePermission()) {
                    runOnUiThread {
                        notifyError("Storage permission is needed to read /storage/emulated/0/Novel/Chapters. Tap \"Open chapters folder\" to grant it.")
                    }
                    return@Thread
                }

                if (!chaptersDir.exists() || !chaptersDir.isDirectory) {
                    runOnUiThread {
                        notifyError("Folder not found: /storage/emulated/0/Novel/Chapters. Create it and add .txt chapter files.")
                    }
                    return@Thread
                }

                val txtFiles = chaptersDir.listFiles { f ->
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

                val folderNameEscaped = JSONObject.quote("Novel/Chapters")
                val filesJson = filesArray.toString()
                val filesJsonEscaped = JSONObject.quote(filesJson)

                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onFolderPicked($folderNameEscaped, $filesJsonEscaped);",
                        null
                    )
                }
            } catch (e: Exception) {
                runOnUiThread { notifyError("Could not read the chapters folder: ${e.message}") }
            }
        }.start()
    }

    private fun notifyError(message: String) {
        val msg = JSONObject.quote(message)
        webView.evaluateJavascript("window.onFolderPickError && window.onFolderPickError($msg);", null)
    }
}
