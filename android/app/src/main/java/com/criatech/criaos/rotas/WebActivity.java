package com.criatech.criaos.rotas;

import android.annotation.SuppressLint;
import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.*;
import android.text.InputType;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.Collections;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

public class WebActivity extends Activity {
    private WebView web;
    private LinearLayout root, body;
    private TextView status;
    private String origin;
    private JavaScriptReplyProxy fileReply;
    private ValueCallback<Uri[]> upload;
    private WebPolicy.FileData pendingFile;
    private int generation;
    private static final int UPLOAD = 21, SAVE_FILE = 22;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService files = Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if(Build.VERSION.SDK_INT>=33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::goBack);
        String previous = RouteStore.server(this);
        try { origin = Api.normalize(previous); openSystem(); }
        catch (Exception ignored) { setup(); }
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private Button button(String label, Runnable action) {
        Button b = new Button(this); b.setText(label); b.setAllCaps(false); b.setTextSize(13); b.setOnClickListener(v -> action.run()); return b;
    }
    private void frame() {
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(246,248,250));
        root.setOnApplyWindowInsetsListener((v,insets) -> { v.setPadding(0,insets.getSystemWindowInsetTop(),0,insets.getSystemWindowInsetBottom()); return insets; });
        setContentView(root); root.requestApplyInsets();
        LinearLayout bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(dp(14),dp(4),dp(8),dp(4)); bar.setBackgroundColor(Color.WHITE);
        TextView brand = new TextView(this); brand.setText("criaOS"); brand.setTextSize(21); brand.setTextColor(Color.rgb(37,50,74)); bar.addView(brand,new LinearLayout.LayoutParams(0,dp(48),1)); brand.setGravity(Gravity.CENTER_VERTICAL);
        bar.addView(button("Minha rota",() -> {
            if(web==null && RouteStore.read(this)==null) { toast("Abra seu sistema antes de acessar a rota."); return; }
            startActivity(new Intent(this,MainActivity.class).putExtra("server",origin));
        }));
        Button more = button("⋮",() -> {}); more.setContentDescription("Opções do aplicativo"); more.setMinWidth(dp(40)); more.setMinimumWidth(dp(40)); bar.addView(more,new LinearLayout.LayoutParams(dp(48),dp(48)));
        more.setOnClickListener(v -> {
            PopupMenu menu = new PopupMenu(this,more);
            menu.getMenu().add("Recarregar sistema").setOnMenuItemClickListener(i -> { if(web!=null) web.reload(); else if(origin!=null) openSystem(); return true; });
            menu.getMenu().add("Abrir no navegador").setOnMenuItemClickListener(i -> { if(origin!=null) external(origin); return true; });
            menu.getMenu().add("Trocar endereço do sistema").setOnMenuItemClickListener(i -> { new AlertDialog.Builder(this).setTitle("Trocar de sistema?").setMessage("Você voltará à tela de configuração. Uma rota ativa precisa ser encerrada antes de trocar de empresa.").setNegativeButton("Voltar",null).setPositiveButton("Continuar",(d,w) -> { destroyWeb(); setup(); }).show(); return true; });
            menu.show();
        });
        root.addView(bar); status = new TextView(this); status.setTextSize(12); status.setTextColor(Color.rgb(98,113,135)); status.setPadding(dp(16),dp(5),dp(16),dp(5)); root.addView(status);
        body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
    }
    private void setup() {
        frame(); status.setText("SISTEMA COMPLETO · ANDROID");
        ScrollView scroll=new ScrollView(this); body.addView(scroll,new LinearLayout.LayoutParams(-1,-1));
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(24),dp(30),dp(24),dp(24)); scroll.addView(form);
        TextView title = new TextView(this); title.setText("Seu sistema, no celular."); title.setTextSize(24); title.setTextColor(Color.rgb(37,50,74)); form.addView(title);
        TextView help = new TextView(this); help.setText("Informe o endereço HTTPS usado pela sua empresa. Depois, entre com sua conta para acessar clientes, orçamentos, ordens, agenda e os módulos permitidos ao seu perfil."); help.setTextSize(15); help.setPadding(0,dp(18),0,dp(20)); form.addView(help);
        EditText address = new EditText(this); address.setSingleLine(); address.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI); address.setHint("https://sua-empresa.onrender.com"); address.setText(RouteStore.server(this)); address.setContentDescription("Endereço HTTPS do sistema"); form.addView(address);
        form.addView(button("Abrir meu sistema",() -> {
            try {
                String target = Api.normalize(address.getText().toString());
                JSONObject route = RouteStore.read(this);
                if(route!=null && !WebPolicy.sameOrigin(route.optString("server"),target)) { toast("Encerre a rota anterior antes de trocar de sistema."); return; }
                origin = target; RouteStore.server(this,target); openSystem();
            } catch (Exception e) { toast(e.getMessage()); }
        }));
        TextView note = new TextView(this); note.setText("O sistema precisa estar publicado e conectado à internet. A localização só é compartilhada quando o técnico inicia uma rota em Minha rota."); note.setTextSize(13); note.setPadding(0,dp(22),0,0); form.addView(note);
    }
    @SuppressLint("SetJavaScriptEnabled")
    private void openSystem() {
        destroyWeb(); frame(); status.setText("Conectando ao seu sistema…");
        web = new WebView(this); body.addView(web,new LinearLayout.LayoutParams(-1,-1));
        WebSettings s = web.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setGeolocationEnabled(false); s.setSupportMultipleWindows(false); s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                String target = request.getUrl().toString();
                if(WebPolicy.sameOrigin(origin,target)) return false;
                if(request.isForMainFrame()) external(target);
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { closePort(); generation++; status.setText("Carregando…"); }
            @Override public void onPageFinished(WebView view,String url) {
                if(!WebPolicy.sameOrigin(origin,url)) return;
                status.setText(Uri.parse(origin).getHost()); CookieManager.getInstance().flush(); installDownloads();
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) { if(request.isForMainFrame()) status.setText("Sem conexão com o sistema. Confira a internet e toque em ⋮ → Recarregar."); }
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response) { if(request.isForMainFrame()) status.setText("O servidor respondeu com erro "+response.getStatusCode()+". Tente recarregar."); }
            @Override public void onReceivedSslError(WebView view,SslErrorHandler h,SslError e) { h.cancel(); status.setText("Conexão bloqueada: certificado HTTPS inválido. Confira o endereço do sistema."); }
            @Override public void onFormResubmission(WebView view,Message dontResend,Message resend) { dontResend.sendToTarget(); }
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail) {
                closePort(); generation++;
                if(view==web) { body.removeView(view); view.destroy(); web=null; status.setText("A tela foi interrompida pelo Android. Toque em ⋮ → Recarregar para continuar."); }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(!WebPolicy.sameOrigin(origin,view.getUrl())) { callback.onReceiveValue(null); return true; }
                if(upload!=null) upload.onReceiveValue(null); upload=callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*"); pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(pick,UPLOAD); } catch (ActivityNotFoundException e) { upload.onReceiveValue(null); upload=null; toast("Não há um seletor de arquivos disponível neste celular."); }
                return true;
            }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web,"CriaOSFiles",Collections.singleton(origin),(view,message,sourceOrigin,mainFrame,replyProxy) -> {
                if(!mainFrame || !WebPolicy.sameOrigin(origin,sourceOrigin.toString()) || !WebPolicy.sameOrigin(origin,view.getUrl())) return;
                fileReply=replyProxy;
                if(pendingFile!=null) { reply("Conclua o salvamento anterior antes de baixar outro arquivo."); return; }
                try {
                    String raw=message.getData();
                    if(raw==null || raw.length()>WebPolicy.MAX_FILE_BYTES*4/3+1024) throw new Exception("Arquivo maior que 16 MB.");
                    JSONObject payload=new JSONObject(raw);
                    if(!"save-file".equals(payload.optString("type"))) throw new Exception("Pedido de arquivo inválido.");
                    pendingFile=WebPolicy.file(payload.optString("name"),payload.getString("data"));
                    Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(pendingFile.mime).putExtra(Intent.EXTRA_TITLE,pendingFile.name);
                    startActivityForResult(save,SAVE_FILE);
                } catch(Exception e) { pendingFile=null; reply(e.getMessage()==null?"Não foi possível preparar o arquivo.":e.getMessage()); }
            });
        }
        web.setDownloadListener((url,agent,disposition,mime,length) -> { if(WebPolicy.externalHttps(url)) external(url); else toast("Atualize o Android System WebView ou abra o sistema no navegador para salvar arquivos."); });
        web.loadUrl(origin);
    }
    private void installDownloads() {
        closePort();
        if(web==null || !WebPolicy.sameOrigin(origin,web.getUrl())) return;
        final int page = generation;
        try {
            String script;
            try(var input=getAssets().open("downloads.js"); var out=new ByteArrayOutputStream()) { byte[] chunk=new byte[4096]; int count; while((count=input.read(chunk))!=-1) out.write(chunk,0,count); script=out.toString(StandardCharsets.UTF_8.name()); }
            if(page==generation) web.evaluateJavascript(script,null);
        } catch(Exception e) { toast("Downloads indisponíveis. Abra o sistema no navegador para salvar arquivos."); }
    }
    private void reply(String error) {
        try { if(fileReply!=null) fileReply.postMessage(new JSONObject().put("error",error).toString()); } catch(Exception ignored) { }
    }
    private void external(String url) {
        if(!WebPolicy.externalHttps(url)) { toast("Link bloqueado. Somente endereços HTTPS são permitidos."); return; }
        new AlertDialog.Builder(this).setTitle("Abrir link no navegador?").setMessage(Uri.parse(url).getHost()).setNegativeButton("Voltar",null).setPositiveButton("Abrir",(d,w) -> { try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); } catch(ActivityNotFoundException e) { toast("Nenhum navegador disponível."); } }).show();
    }
    @Override protected void onActivityResult(int code,int result,Intent data) {
        super.onActivityResult(code,result,data);
        if(code==UPLOAD && upload!=null) { upload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data)); upload=null; }
        if(code==SAVE_FILE) {
            WebPolicy.FileData file=pendingFile; pendingFile=null;
            if(result!=RESULT_OK || data==null || data.getData()==null || file==null) { reply(null); return; }
            Uri destination=data.getData();
            files.execute(() -> {
                String error=null;
                try(var out=getContentResolver().openOutputStream(destination)) { if(out==null) throw new Exception(); out.write(file.bytes); }
                catch(Exception e) { error="Não foi possível salvar o arquivo no local escolhido."; }
                String resultError=error;
                handler.post(() -> { if(!isDestroyed()) { reply(resultError); if(resultError==null) toast("Arquivo salvo."); } });
            });
        }
    }
    private void closePort() { fileReply=null; }
    private void destroyWeb() { generation++; closePort(); if(upload!=null) { upload.onReceiveValue(null); upload=null; } pendingFile=null; if(web!=null) { web.stopLoading(); web.destroy(); web=null; } }
    private void goBack() { if(web!=null && web.canGoBack()) web.goBack(); else moveTaskToBack(true); }
    // Android 13+ usa o callback registrado em onCreate; este fallback atende Android 8–12.
    @SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { goBack(); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onDestroy() { destroyWeb(); files.shutdown(); super.onDestroy(); }
    private void toast(String value) { Toast.makeText(this,value,Toast.LENGTH_LONG).show(); }
}
