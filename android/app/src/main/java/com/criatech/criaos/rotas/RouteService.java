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
import java.util.concurrent.*;

public class RouteService extends Service implements LocationListener {
    public static volatile boolean running = false;
    public static volatile String status = "Nenhuma rota ativa.";
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private volatile Location latest;
    private LocationManager locations;
    private JSONObject session;
    private String accessToken;
    private boolean listening = false;
    private static final String CHANNEL = "route-sharing";
    private static final int NOTIFICATION = 7000;

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (running) return START_NOT_STICKY;
        session = RouteStore.read(this);
        if (session == null || session.optBoolean("stopping")) { stopSelf(); return START_NOT_STICKY; }
        accessToken = intent == null ? null : intent.getStringExtra("accessToken");
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            status = "Permissão de localização ausente. A rota foi interrompida.";
            StopJob.stop(this); stopSelf(); return START_NOT_STICKY;
        }
        NotificationManager notifications = getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "Compartilhamento durante a rota", NotificationManager.IMPORTANCE_LOW));
        try {
            Notification notice = notification("Iniciando compartilhamento da rota…");
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION, notice);
        } catch (RuntimeException e) { status = "O Android não permitiu iniciar. Abra o app e confira as permissões."; stopSelf(); return START_NOT_STICKY; }
        running = true;
        worker.scheduleWithFixedDelay(this::send, 0, 30, TimeUnit.SECONDS);
        return START_NOT_STICKY;
    }
    private Notification notification(String message) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop = PendingIntent.getBroadcast(this, 1, new Intent(this, StopReceiver.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(com.criatech.criaos.rotas.R.drawable.ic_route)
            .setContentTitle("CriaOS · Rota ativa").setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message))
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
            .addAction(new Notification.Action.Builder(null, "Encerrar rota", stop).build()).build();
    }
    private void message(String value) {
        status = value;
        if (running) getSystemService(NotificationManager.class).notify(NOTIFICATION, notification(value));
    }
    private void startLocation() {
        if (listening || !running) return;
        locations = getSystemService(LocationManager.class);
        try {
            boolean provider = false;
            if (locations.getAllProviders().contains(LocationManager.NETWORK_PROVIDER)) {
                locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 30000, 0, this, Looper.getMainLooper()); provider = true;
            }
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED && locations.getAllProviders().contains(LocationManager.GPS_PROVIDER)) {
                locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 30000, 0, this, Looper.getMainLooper()); provider = true;
            }
            listening = provider;
            message(provider ? "Admin e financeiro acompanham sua posição. Aguardando GPS…" : "Ative a localização do celular para enviar posições.");
        } catch (SecurityException e) { message("Permissão de localização removida. Encerre ou conceda a permissão no app."); }
    }
    private void send() {
        try {
            JSONObject stored = RouteStore.read(this);
            if (!running || stored == null || stored.optBoolean("stopping")) return;
            if (stored.optLong("expiresAt") <= System.currentTimeMillis()) { finish("Rota encerrada após o limite de 12 horas."); return; }
            if (!stored.optBoolean("confirmed")) {
                if (accessToken == null) { message("Entre novamente para confirmar o início da rota."); return; }
                Api.Response start = Api.request(stored.getString("server"), "/route-tracking/mine", "POST", "Bearer " + accessToken,
                    new JSONObject().put("consent", true).put("deviceToken", stored.getString("token")));
                if (!start.ok()) {
                    if (start.status >= 400 && start.status < 500 && start.status != 429) { finish(start.error()); return; }
                    message("Aguardando conexão para iniciar. Nenhuma posição enviada."); return;
                }
                // Um encerramento solicitado enquanto o início estava em trânsito tem prioridade.
                JSONObject current = RouteStore.read(this);
                if (current == null || current.optBoolean("stopping") || !running || !stored.optString("token").equals(current.optString("token"))) {
                    Api.request(stored.getString("server"), "/route-tracking/device", "DELETE", "Route " + stored.getString("token"), null);
                    StopJob.schedule(this); return;
                }
                current.put("confirmed", true).put("expiresAt", Instant.parse(start.body.getString("expiresAt")).toEpochMilli());
                RouteStore.save(this, current); session = current; stored = current; accessToken = null;
            }
            new Handler(Looper.getMainLooper()).post(this::startLocation);
            if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) { StopJob.stop(this); message("Compartilhamento interrompido: permissão removida."); return; }
            Location point = latest;
            if (point == null || (SystemClock.elapsedRealtimeNanos() - point.getElapsedRealtimeNanos()) / 1000000 > 120000) {
                message("Sem posição recente. Confira o GPS do celular."); return;
            }
            JSONObject current = RouteStore.read(this);
            if (!running || current == null || current.optBoolean("stopping") || !stored.optString("token").equals(current.optString("token"))) return;
            JSONObject position = new JSONObject().put("latitude", point.getLatitude()).put("longitude", point.getLongitude())
                .put("accuracy", (double) point.getAccuracy()).put("capturedAt", Instant.ofEpochMilli(point.getTime()).toString());
            Api.Response response = Api.request(stored.getString("server"), "/route-tracking/device/position", "PUT", "Route " + stored.getString("token"), position);
            if (response.ok()) message("Localização compartilhada com admin e financeiro. Atualização enviada.");
            else if (response.status == 401 || response.status == 403 || response.status == 410) finish(response.error());
            else if (response.status == 400) message("Confira data, hora e localização do celular. Posição não enviada.");
            else message("Sem atualização confirmada. A última posição pode estar desatualizada.");
        } catch (Exception e) { message("Sem conexão confirmada. O painel pode exibir uma posição antiga."); }
    }
    private void finish(String reason) {
        status = reason;
        if (session != null) RouteStore.clearIfToken(this, session.optString("token"));
        new Handler(Looper.getMainLooper()).post(this::stopSelf);
    }
    @Override public void onLocationChanged(Location location) { if (running && !location.isFromMockProvider()) latest = new Location(location); }
    @Override public void onProviderEnabled(String provider) { startLocation(); }
    @Override public void onProviderDisabled(String provider) { message("Localização desativada ou sem sinal recente."); }
    @Override public void onStatusChanged(String provider, int value, Bundle extras) { }
    @Override public void onDestroy() {
        running = false; worker.shutdownNow(); latest = null; accessToken = null;
        if (locations != null) locations.removeUpdates(this);
        stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy();
    }
}
