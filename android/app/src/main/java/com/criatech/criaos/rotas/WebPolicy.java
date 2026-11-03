package com.criatech.criaos.rotas;

import java.net.URI;
import java.util.Base64;

final class WebPolicy {
    static final int MAX_FILE_BYTES = 16 * 1024 * 1024;
    static boolean sameOrigin(String base, String target) {
        try {
            URI a = new URI(base), b = new URI(target);
            return "https".equalsIgnoreCase(b.getScheme()) && b.getUserInfo() == null
                && a.getHost() != null && a.getHost().equalsIgnoreCase(b.getHost())
                && port(a) == port(b);
        } catch (Exception ignored) { return false; }
    }
    private static int port(URI uri) { return uri.getPort() == -1 ? 443 : uri.getPort(); }
    static boolean externalHttps(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                && uri.getUserInfo() == null && uri.getPort() != 0 && uri.getPort() <= 65535;
        } catch (Exception ignored) { return false; }
    }
    static final class FileData {
        final String mime, name;
        final byte[] bytes;
        FileData(String mime, String name, byte[] bytes) { this.mime = mime; this.name = name; this.bytes = bytes; }
    }
    static FileData file(String name, String data) throws Exception {
        if (data == null || data.length() > MAX_FILE_BYTES * 4 / 3 + 256) throw new Exception("Arquivo maior que 16 MB. Baixe pelo navegador.");
        int comma = data.indexOf(',');
        if (!data.startsWith("data:") || comma < 0 || comma > 120) throw new Exception("Formato de arquivo inválido.");
        String header = data.substring(5, comma).toLowerCase(java.util.Locale.ROOT);
        String mime = header.split(";", -1)[0];
        if (!(mime.equals("application/pdf") || mime.equals("text/csv")) || !header.endsWith(";base64")) throw new Exception("Somente PDF e CSV podem ser salvos pelo aplicativo.");
        byte[] bytes = Base64.getDecoder().decode(data.substring(comma + 1));
        if (bytes.length == 0 || bytes.length > MAX_FILE_BYTES) throw new Exception("Arquivo vazio ou maior que 16 MB.");
        if (mime.equals("application/pdf") && (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-')) throw new Exception("O arquivo recebido não é um PDF válido.");
        String extension = mime.equals("application/pdf") ? ".pdf" : ".csv";
        String safe = name == null ? "" : name.replaceAll("[\\p{Cntrl}/\\\\:*?\"<>|]", "_");
        if (safe.length() > 110) safe = safe.substring(0, 110);
        if (safe.trim().isEmpty() || safe.startsWith(".")) safe = "criaos" + extension;
        if (!safe.toLowerCase(java.util.Locale.ROOT).endsWith(extension)) safe += extension;
        return new FileData(mime, safe, bytes);
    }
}
