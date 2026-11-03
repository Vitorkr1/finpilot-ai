package com.criatech.criaos.rotas;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import org.json.JSONObject;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

public class RouteService extends Service implements LocationListener {
    public static volatile boolean running=false;
    public static volatile String status="Nenhuma rota ativa.";
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
    private final Handler main=new Handler(Looper.getMainLooper());
    private final AtomicBoolean queued=new AtomicBoolean();
    private volatile Location latest;
    private LocationManager locations;
    private CancellationSignal firstFix;
    private JSONObject session;
    private String accessToken;
    private long nextStartAttempt, nextUploadAttempt, nextHealthCheck, uploadedCapture=-1;
    private float uploadedAccuracy=Float.POSITIVE_INFINITY;
    private static final String CHANNEL="route-sharing";
    private static final int NOTIFICATION=7000;
    private static final long SEND_INTERVAL_MS=5000;

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if(running) return START_NOT_STICKY;
        session=RouteStore.read(this);
        if(session==null || session.optBoolean("stopping")) { stopSelf(); return START_NOT_STICKY; }
        accessToken=intent==null?null:intent.getStringExtra("accessToken");
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED) {
            status="Ative a localização precisa para iniciar a rota."; StopJob.stop(this); stopSelf(); return START_NOT_STICKY;
        }
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"Compartilhamento durante a rota",NotificationManager.IMPORTANCE_LOW));
        try {
            Notification notice=notification("Buscando um GPS preciso e conectando ao sistema…");
            if(Build.VERSION.SDK_INT>=29) startForeground(NOTIFICATION,notice,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION,notice);
        } catch(RuntimeException e) { status="O Android não permitiu iniciar. Abra o app e confira as permissões."; stopSelf(); return START_NOT_STICKY; }
        running=true;
        // Aquisição após a escolha do técnico; envio somente após confirmação da API.
        startLocation();
        worker.scheduleWithFixedDelay(this::send,0,SEND_INTERVAL_MS,TimeUnit.MILLISECONDS);
        return START_NOT_STICKY;
    }
    private Notification notification(String message) {
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop=PendingIntent.getBroadcast(this,1,new Intent(this,StopReceiver.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_route).setContentTitle("CriaOS · Rota ativa")
            .setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message)).setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
            .addAction(new Notification.Action.Builder(null,"Encerrar rota",stop).build()).build();
    }
    private void message(String value) { status=value; if(running) getSystemService(NotificationManager.class).notify(NOTIFICATION,notification(value)); }
    private void register(String provider) {
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED) return;
        if(!locations.getAllProviders().contains(provider)) return;
        if(Build.VERSION.SDK_INT>=31) {
            LocationRequest request=new LocationRequest.Builder(2000).setMinUpdateIntervalMillis(1000).setMaxUpdateDelayMillis(0).setQuality(LocationRequest.QUALITY_HIGH_ACCURACY).build();
            locations.requestLocationUpdates(provider,request,getMainExecutor(),this);
        } else locations.requestLocationUpdates(provider,2000,0,this,Looper.getMainLooper());
    }
    private void startLocation() {
        locations=getSystemService(LocationManager.class);
        try {
            register(LocationManager.GPS_PROVIDER);
            register(LocationManager.NETWORK_PROVIDER);
            if(Build.VERSION.SDK_INT>=30 && locations.getAllProviders().contains(LocationManager.GPS_PROVIDER)) {
                firstFix=new CancellationSignal();
                locations.getCurrentLocation(LocationManager.GPS_PROVIDER,firstFix,getMainExecutor(),point -> { if(point!=null) onLocationChanged(point); });
            }
        } catch(SecurityException e) { message("Permissão precisa removida. Abra as permissões do aplicativo."); }
    }
    private PositionQuality.Fix fix(Location point) {
        return point==null || !point.hasAccuracy()?null:new PositionQuality.Fix(point.getLatitude(),point.getLongitude(),point.getAccuracy(),point.getElapsedRealtimeNanos()/1000000,LocationManager.GPS_PROVIDER.equals(point.getProvider()));
    }
    private void kick() {
        if(!running || !queued.compareAndSet(false,true)) return;
        try { worker.execute(() -> { queued.set(false); send(); }); }
        catch(RejectedExecutionException ignored) { queued.set(false); }
    }
    private boolean stopped(JSONObject stored) { return !running || stored==null || stored.optBoolean("stopping"); }
    private void send() {
        try {
            JSONObject stored=RouteStore.read(this);
            if(stopped(stored)) return;
            long now=SystemClock.elapsedRealtime();
            if(stored.optLong("expiresAt")<=System.currentTimeMillis()) { finish("Rota encerrada após o limite de 12 horas."); return; }
            if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED) { StopJob.stop(this); status="Compartilhamento interrompido: ative a localização precisa."; return; }
            if(!stored.optBoolean("confirmed")) {
                if(accessToken==null) { message("Entre novamente para confirmar o início da rota."); return; }
                if(now<nextStartAttempt) return;
                nextStartAttempt=now+10000;
                Api.Response start=Api.request(stored.getString("server"),"/route-tracking/mine","POST","Bearer "+accessToken,new JSONObject().put("consent",true).put("deviceToken",stored.getString("token")));
                if(!start.ok()) {
                    if(start.status>=400 && start.status<500 && start.status!=429) { finish(start.error()); return; }
                    message("Aguardando o servidor confirmar a rota. Nenhuma posição enviada."); return;
                }
                JSONObject current=RouteStore.read(this);
                if(stopped(current) || !stored.optString("token").equals(current.optString("token"))) {
                    Api.request(stored.getString("server"),"/route-tracking/device","DELETE","Route "+stored.getString("token"),null); StopJob.schedule(this); return;
                }
                current.put("confirmed",true).put("protocolVersion",start.body.optInt("protocolVersion",1)).put("expiresAt",Instant.parse(start.body.getString("expiresAt")).toEpochMilli());
                RouteStore.save(this,current); session=current; stored=current; accessToken=null;
            }
            Location point=latest;
            if(!PositionQuality.usable(fix(point),SystemClock.elapsedRealtime())) {
                boolean gps=locations!=null && locations.isProviderEnabled(LocationManager.GPS_PROVIDER);
                message(gps?"Aguardando GPS preciso (até ±50 m). Uma posição incerta não será enviada.":"Ative a localização/GPS do celular. Nenhuma posição confiável disponível.");
                // Confere encerramento pelo site mesmo sem uma posição utilizável.
                if(now>=nextHealthCheck) {
                    nextHealthCheck=now+30000;
                    Api.Response health=Api.request(stored.getString("server"),"/route-tracking/device","GET","Route "+stored.getString("token"),null);
                    if(health.status==401 || health.status==403 || health.status==410) finish(health.error());
                }
                return;
            }
            if(now<nextUploadAttempt || (point.getElapsedRealtimeNanos()==uploadedCapture && point.getAccuracy()>=uploadedAccuracy)) return;
            JSONObject current=RouteStore.read(this);
            if(stopped(current) || !stored.optString("token").equals(current.optString("token"))) return;
            nextUploadAttempt=now+SEND_INTERVAL_MS;
            JSONObject position=new JSONObject().put("latitude",point.getLatitude()).put("longitude",point.getLongitude()).put("accuracy",(double)point.getAccuracy()).put("capturedAt",Instant.ofEpochMilli(point.getTime()).toString());
            if(stored.optInt("protocolVersion",1)>=2) position.put("provider",LocationManager.GPS_PROVIDER.equals(point.getProvider())?"gps":"network");
            Api.Response response=Api.request(stored.getString("server"),"/route-tracking/device/position","PUT","Route "+stored.getString("token"),position);
            if(response.ok()) {
                uploadedCapture=point.getElapsedRealtimeNanos(); uploadedAccuracy=point.getAccuracy(); nextHealthCheck=now+30000;
                String time=DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(point.getTime()));
                message("GPS enviado às "+time+" · precisão estimada ±"+(int)Math.ceil(point.getAccuracy())+" m.");
            } else if(response.status==401 || response.status==403 || response.status==410) finish(response.error());
            else if(response.status==400) message("Posição não aceita. Confira GPS, data e hora automáticas do celular.");
            else message("Envio não confirmado. O painel pode mostrar uma posição anterior.");
        } catch(Exception e) { message("O servidor ainda não confirmou o envio. Confira a internet e tente aguardar a reconexão."); }
    }
    private void finish(String reason) { status=reason; if(session!=null) RouteStore.clearIfToken(this,session.optString("token")); main.post(this::stopSelf); }
    @Override public void onLocationChanged(Location point) {
        if(!running || point.isFromMockProvider()) return;
        if(PositionQuality.prefer(fix(point),fix(latest),SystemClock.elapsedRealtime())) { latest=new Location(point); kick(); }
    }
    @Override public void onProviderEnabled(String provider) { kick(); }
    @Override public void onProviderDisabled(String provider) { message("GPS sem sinal confiável. Aguardando uma nova leitura precisa."); }
    @Override public void onStatusChanged(String provider,int value,Bundle extras) { }
    @Override public void onDestroy() {
        running=false; worker.shutdownNow(); latest=null; accessToken=null;
        if(firstFix!=null) firstFix.cancel();
        if(locations!=null) locations.removeUpdates(this);
        stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy();
    }
}
