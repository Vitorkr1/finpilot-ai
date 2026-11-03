package com.criatech.criaos.rotas;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;

final class RouteStore {
    private static SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias("route-session")) return (SecretKey) store.getKey("route-session", null);
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        gen.init(new KeyGenParameterSpec.Builder("route-session", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return gen.generateKey();
    }
    static synchronized JSONObject read(Context context) {
        try {
            String data = context.getSharedPreferences("route", Context.MODE_PRIVATE).getString("session", "");
            if (data.isEmpty()) return null;
            String[] parts = data.split(":");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
        } catch (Exception ignored) { return null; }
    }
    static synchronized void save(Context context, JSONObject session) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        String data = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(session.toString().getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!context.getSharedPreferences("route", Context.MODE_PRIVATE).edit().putString("session", data).commit()) throw new Exception("Não foi possível salvar a rota no celular.");
    }
    // A revogação deve ser persistida antes de qualquer novo envio ou término do processo.
    @android.annotation.SuppressLint("ApplySharedPref")
    static synchronized void clearIfToken(Context context, String token) {
        JSONObject current = read(context);
        if (current != null && token.equals(current.optString("token"))) context.getSharedPreferences("route", Context.MODE_PRIVATE).edit().remove("session").commit();
    }
    static String server(Context context) { return context.getSharedPreferences("settings", Context.MODE_PRIVATE).getString("server", ""); }
    static void server(Context context, String url) { context.getSharedPreferences("settings", Context.MODE_PRIVATE).edit().putString("server", url).apply(); }
}
