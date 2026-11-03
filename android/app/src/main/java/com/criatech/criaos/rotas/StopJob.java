package com.criatech.criaos.rotas;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class StopJob extends JobService {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    static void stop(Context context) {
        context.stopService(new Intent(context, RouteService.class));
        JSONObject session = RouteStore.read(context);
        if (session == null) return;
        try { session.put("stopping", true); RouteStore.save(context, session); }
        catch (Exception ignored) { return; }
        schedule(context);
    }
    static void schedule(Context context) {
        context.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(7001, new ComponentName(context, StopJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setBackoffCriteria(30000, JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
    }
    @Override public boolean onStartJob(JobParameters params) {
        worker.execute(() -> {
            JSONObject session = RouteStore.read(this);
            if (session == null || !session.optBoolean("stopping")) { jobFinished(params, false); return; }
            String token = session.optString("token");
            boolean retry = true;
            try {
                Api.Response res = Api.request(session.getString("server"), "/route-tracking/device", "DELETE", "Route " + token, null);
                if (res.ok() || res.status == 410 || res.status == 401 || res.status == 403) { RouteStore.clearIfToken(this, token); retry = false; }
            } catch (Exception ignored) { }
            if (session.optLong("expiresAt") < System.currentTimeMillis()) { RouteStore.clearIfToken(this, token); retry = false; }
            jobFinished(params, retry);
        });
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) { return true; }
    @Override public void onDestroy() { worker.shutdownNow(); super.onDestroy(); }
}
