package com.criatech.criaos.rotas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class StopReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) { StopJob.stop(context); }
}
