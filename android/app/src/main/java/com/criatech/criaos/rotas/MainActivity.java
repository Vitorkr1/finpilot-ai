package com.criatech.criaos.rotas;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.provider.Settings;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import org.json.JSONObject;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LinearLayout content;
    private TextView status;
    private String accessToken, name, serverUrl, lastState = "";
    private boolean busy = false;
    private final Runnable ticker = new Runnable() { @Override public void run() {
        String state = state(); if (!state.equals(lastState)) render();
        JSONObject current = RouteStore.read(MainActivity.this);
        if (status != null && (current == null || !current.optBoolean("stopping"))) status.setText(RouteService.status);
        handler.postDelayed(this, 2000);
    }};
    @Override public void onCreate(Bundle saved) { super.onCreate(saved); serverUrl = RouteStore.server(this); render(); }
    @Override public void onResume() {
        super.onResume();
        JSONObject saved = RouteStore.read(this);
        if (saved != null && saved.optBoolean("stopping")) StopJob.schedule(this);
        handler.post(ticker);
    }
    @Override public void onPause() { handler.removeCallbacks(ticker); super.onPause(); }
    @Override public void onDestroy() { handler.removeCallbacks(ticker); worker.shutdownNow(); super.onDestroy(); }
    private String state() {
        JSONObject route = RouteStore.read(this);
        return route == null ? "none:" + (accessToken != null) : route.optString("token") + route.optBoolean("stopping") + route.optBoolean("confirmed") + RouteService.running;
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color); view.setLineSpacing(dp(4), 1);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.bottomMargin = dp(16); content.addView(view, params); return view;
    }
    private EditText input(String label, int type, String value) {
        text(label, 13, Color.rgb(75, 89, 110)); EditText field = new EditText(this); field.setSingleLine(); field.setInputType(type); field.setText(value); field.setTextSize(16); field.setPadding(dp(12), dp(12), dp(12), dp(12));
        GradientDrawable bg = new GradientDrawable(); bg.setColor(Color.WHITE); bg.setCornerRadius(dp(8)); bg.setStroke(dp(1),Color.rgb(216,223,233)); field.setBackground(bg);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(22);content.addView(field,p);return field;
    }
    private Button button(String label, boolean primary, Runnable action) {
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setTextSize(15);b.setTextColor(primary?Color.WHITE:Color.rgb(61,77,107));b.setMinHeight(dp(52));
        GradientDrawable bg=new GradientDrawable();bg.setColor(primary?Color.rgb(80,100,245):Color.WHITE);bg.setCornerRadius(dp(9));if(!primary)bg.setStroke(dp(1),Color.rgb(216,223,233));b.setBackground(bg);
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(14);content.addView(b,p);b.setOnClickListener(v->{if(!busy)action.run();});b.setEnabled(!busy);return b;
    }
    private void render() {
        if (isFinishing() || isDestroyed()) return;
        lastState=state();status=null;
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(Color.rgb(246,248,250));
        content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(26),dp(26),dp(26),dp(32));scroll.addView(content);setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(0,insets.getSystemWindowInsetTop(),0,insets.getSystemWindowInsetBottom());return insets;});scroll.requestApplyInsets();
        TextView brand=text("criaOS",30,Color.rgb(37,50,74));brand.setTypeface(null,Typeface.BOLD);
        text("ROTAS DE ATENDIMENTO · ANDROID",10,Color.rgb(114,128,148));
        JSONObject route=RouteStore.read(this);
        if(route!=null){
            text(route.optString("name","Técnico"),24,Color.rgb(37,50,74));
            boolean stopping=route.optBoolean("stopping");
            text(stopping?"Rota encerrada neste celular":RouteService.running?(route.optBoolean("confirmed")?"Compartilhamento ativo":"Iniciando rota…"):"Compartilhamento interrompido",20,Color.rgb(54,78,66));
            status=text(stopping?"Nenhuma nova posição será coletada. Aguardando conexão para avisar a empresa.":RouteService.status,14,Color.rgb(98,113,135));
            if(stopping){button("Enviar encerramento novamente",false,()->{StopJob.schedule(this);toast("O aviso será enviado quando houver conexão.");});}
            else {
                text("Apenas admin e financeiro da sua empresa podem acompanhar sua posição durante esta rota.",14,Color.rgb(98,113,135));
                String end=DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(route.optLong("expiresAt")));
                text("Limite desta rota: "+end+". Encerre assim que terminar o atendimento.",13,Color.rgb(121,133,151));
                if(!RouteService.running){
                    if(route.optBoolean("confirmed")) button("Retomar esta rota",true,()->permissions(this::resumeRoute));
                    else if(accessToken==null) loginForm();
                    else button("Tentar iniciar novamente",true,()->permissions(this::resumeRoute));
                }
                button("Encerrar rota",false,()->new AlertDialog.Builder(this).setTitle("Encerrar compartilhamento?").setMessage("O celular vai parar de coletar e enviar sua localização. Sem internet, a empresa receberá o encerramento quando a conexão voltar.").setNegativeButton("Voltar",null).setPositiveButton("Encerrar",(d,w)->{StopJob.stop(this);render();}).show());
            }
        } else if(accessToken==null) {
            text("Sua equipe, durante a rota.",24,Color.rgb(37,50,74));
            text("Entre com a mesma conta de técnico usada no sistema da sua empresa.",14,Color.rgb(98,113,135));loginForm();
        } else {
            text("Olá, "+name,24,Color.rgb(37,50,74));
            text("Sua localização ainda não está sendo compartilhada.",14,Color.rgb(98,113,135));
            CheckBox consent=new CheckBox(this);consent.setText(R.string.route_consent);consent.setTextSize(14);consent.setPadding(0,dp(12),0,dp(20));content.addView(consent);
            button("Iniciar rota",true,()->{if(!consent.isChecked()){toast("Confirme o compartilhamento para iniciar a rota.");return;}permissions(this::newRoute);});
            button("Sair da conta",false,()->{String previous=accessToken,target=serverUrl;accessToken=null;name=null;render();worker.execute(()->{try{Api.request(target,"/auth/logout","POST","Bearer "+previous,null);}catch(Exception ignored){}});});
        }
        text("Você pode encerrar pelo aplicativo, pelo aviso de rota na tela ou pelo site. O app não inicia uma rota sozinho. Se o celular for desligado ou o aplicativo for forçado a parar, as atualizações são interrompidas.",12,Color.rgb(130,141,157));
    }
    private void loginForm() {
        EditText url=input("Endereço HTTPS do sistema",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI,serverUrl);
        EditText email=input("E-mail",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,"");
        EditText pass=input("Senha",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD,"");
        button("Entrar",true,()->{
            String target;try{target=Api.normalize(url.getText().toString());}catch(Exception e){toast(e.getMessage());return;}
            JSONObject existing=RouteStore.read(this);
            if(existing!=null&&!target.equals(existing.optString("server"))){toast("Encerre a rota anterior antes de trocar o endereço do sistema.");return;}
            String account=email.getText().toString().trim(),password=pass.getText().toString();
            if(account.isEmpty()||password.isEmpty()){toast("Preencha seu e-mail e senha.");return;}
            busy=true;pass.setText("");
            worker.execute(()->{
                try{
                    Api.Response r=Api.request(target,"/auth/login","POST",null,new JSONObject().put("email",account).put("password",password));
                    if(!r.ok())throw new Exception(r.error());
                    if(!"tecnico".equals(r.body.getJSONObject("user").optString("role")))throw new Exception("Use uma conta de técnico. Admin e financeiro acompanham pelo site.");
                    String token=r.body.getString("accessToken"),who=r.body.getJSONObject("user").getString("name");
                    handler.post(()->{busy=false;accessToken=token;name=who;serverUrl=target;RouteStore.server(this,target);render();});
                }catch(Exception e){handler.post(()->{busy=false;toast(e.getMessage()==null?"Falha na conexão. Confira o endereço e tente novamente.":e.getMessage());});}
            });
        });
    }
    private Runnable afterPermission;
    private void permissions(Runnable action) {
        afterPermission=action;ArrayList<String> missing=new ArrayList<>();
        if(checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED){missing.add(Manifest.permission.ACCESS_COARSE_LOCATION);missing.add(Manifest.permission.ACCESS_FINE_LOCATION);}
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)missing.add(Manifest.permission.POST_NOTIFICATIONS);
        if(!missing.isEmpty()){requestPermissions(missing.toArray(new String[0]),10);return;}
        if(!getSystemService(NotificationManager.class).areNotificationsEnabled()){
            new AlertDialog.Builder(this).setTitle("Ative o aviso de rota").setMessage("O aviso permite ver e encerrar o compartilhamento mesmo com o aplicativo em segundo plano.").setNegativeButton("Voltar",null).setPositiveButton("Abrir configurações",(d,w)->startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()))).show();return;
        }
        action.run();
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
        super.onRequestPermissionsResult(code,permissions,results);
        if(code==10){if(checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED&&(Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED))permissions(afterPermission);else toast("Localização e aviso de rota precisam estar permitidos para iniciar.");}
    }
    private void newRoute() {
        try{
            byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder token=new StringBuilder();for(byte b:bytes)token.append(String.format("%02x",b&255));
            RouteStore.save(this,new JSONObject().put("server",serverUrl).put("token",token.toString()).put("name",name).put("expiresAt",System.currentTimeMillis()+12*60*60*1000L).put("confirmed",false));resumeRoute();
        }catch(Exception e){toast("Não foi possível salvar a rota neste celular.");}
    }
    private void resumeRoute() {
        try{startForegroundService(new Intent(this,RouteService.class).putExtra("accessToken",accessToken));render();}
        catch(RuntimeException e){toast("Abra as permissões do aplicativo e tente iniciar a rota novamente.");}
    }
    private void toast(String value){Toast.makeText(this,value,Toast.LENGTH_LONG).show();}
}
