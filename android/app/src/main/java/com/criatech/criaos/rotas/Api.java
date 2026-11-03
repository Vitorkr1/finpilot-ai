package com.criatech.criaos.rotas;

import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URI;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

final class Api {
    static final class Response {
        final int status;
        final JSONObject body;
        Response(int status, JSONObject body) { this.status = status; this.body = body; }
        boolean ok() { return status >= 200 && status < 300; }
        String error() { return body.optString("error", "Não foi possível concluir. Tente novamente."); }
    }
    static String normalize(String value) throws Exception {
        URI uri = new URI(value.trim());
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null || (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))) {
            throw new Exception("Informe o endereço HTTPS do seu sistema, sem caminhos. Ex.: https://sua-empresa.onrender.com");
        }
        return "https://" + uri.getRawAuthority();
    }
    static Response request(String base, String path, String method, String authorization, JSONObject body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URI(normalize(base) + "/api" + path).toURL().openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setRequestMethod(method);
        conn.setRequestProperty("Accept", "application/json");
        if (authorization != null) conn.setRequestProperty("Authorization", authorization);
        try {
            if (body != null) {
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setFixedLengthStreamingMode(bytes.length);
                try (var out = conn.getOutputStream()) { out.write(bytes); }
            }
            int status = conn.getResponseCode();
            InputStream stream = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String text = "";
            if (stream != null) try (stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) { byte[] chunk = new byte[4096]; int size; while ((size = stream.read(chunk)) != -1) { if (out.size() + size > 65536) throw new Exception("Resposta muito grande. Confira o endereço do sistema."); out.write(chunk, 0, size); } text = out.toString(StandardCharsets.UTF_8.name()); }
            JSONObject json;
            try { json = text.trim().isEmpty() ? new JSONObject() : new JSONObject(text); }
            catch (Exception ignored) { json = new JSONObject().put("error", "O endereço não respondeu como uma API CriaOS. Confira a URL e a publicação do sistema."); }
            return new Response(status, json);
        } finally { conn.disconnect(); }
    }
}
