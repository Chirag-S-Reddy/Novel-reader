package com.scell.novelreader

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private val prefsName = "novel_reader_prefs"
    private val keyFolderUri = "chapters_folder_uri"

    private val pickFolderLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uri = result.data?.data
        if (result.resultCode == RESULT_OK && uri != null) {
            // Persist permission so we can reopen this folder on next launch
            // without asking the user again.
            contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
            getSharedPreferences(prefsName, MODE_PRIVATE)
                .edit()
                .putString(keyFolderUri, uri.toString())
                .apply()
            loadFolder(uri)
        } else {
            notifyPickError(null)
        }
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

    inner class AndroidBridge {

        @JavascriptInterface
        fun pickFolder() {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
                intent.addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or
                        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                )
                pickFolderLauncher.launch(intent)
            }
        }

        @JavascriptInterface
        fun tryAutoReconnect() {
            val saved = getSharedPreferences(prefsName, MODE_PRIVATE)
                .getString(keyFolderUri, null) ?: return
            val uri = Uri.parse(saved)

            // Confirm we still hold read permission for this URI.
            val stillGranted = contentResolver.persistedUriPermissions.any {
                it.uri == uri && it.isReadPermission
            }
            if (!stillGranted) return

            loadFolder(uri)
        }
    }

    private fun loadFolder(treeUri: Uri) {
        Thread {
            try {
                val docFile = DocumentFile.fromTreeUri(this, treeUri)
                val folderName = docFile?.name ?: "Chapters"
                val filesArray = JSONArray()

                docFile?.listFiles()?.forEach { child ->
                    val name = child.name ?: return@forEach
                    if (child.isFile && name.lowercase().endsWith(".txt")) {
                        try {
                            val text = contentResolver.openInputStream(child.uri)
                                ?.bufferedReader(Charsets.UTF_8)
                                ?.use { it.readText() } ?: ""
                            val obj = JSONObject()
                            obj.put("name", name)
                            obj.put("text", text)
                            filesArray.put(obj)
                        } catch (e: Exception) {
                            // Skip unreadable file, continue with the rest.
                        }
                    }
                }

                val folderNameEscaped = JSONObject.quote(folderName)
                val filesJson = filesArray.toString()
                // Escape for safe embedding inside a JS string literal via JSON.parse.
                val filesJsonEscaped = JSONObject.quote(filesJson)

                runOnUiThread {
                    webView.evaluateJavascript(
                        "window.onFolderPicked($folderNameEscaped, $filesJsonEscaped);",
                        null
                    )
                }
            } catch (e: Exception) {
                runOnUiThread { notifyPickError("Could not read that folder.") }
            }
        }.start()
    }

    private fun notifyPickError(message: String?) {
        val msg = if (message != null) JSONObject.quote(message) else "null"
        webView.evaluateJavascript("window.onFolderPickError && window.onFolderPickError($msg);", null)
    }
}
