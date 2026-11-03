package com.criatech.criaos.rotas;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class WebPolicyTest {
    private String data(String mime,String text) { return "data:"+mime+";base64,"+Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8)); }
    @Test public void navigationIsLimitedToExactHttpsOrigin() {
        assertTrue(WebPolicy.sameOrigin("https://empresa.example","https://EMPRESA.example:443/rotas?id=1"));
        for(String value:new String[]{"http://empresa.example","https://empresa.example:8443/","https://empresa.example.evil.test/","https://user@empresa.example/","javascript:alert(1)","file:///etc/passwd","data:text/html,hello","https://outra.example/"}) assertFalse(value,WebPolicy.sameOrigin("https://empresa.example",value));
    }
    @Test public void externalLinksRejectUnsafeSchemesAndCredentials() {
        assertTrue(WebPolicy.externalHttps("https://www.openstreetmap.org/copyright"));
        for(String value:new String[]{"http://example.test","https://user:pass@example.test","intent://open","file:///secret","https://example.test:0","https://example.test:70000"}) assertFalse(value,WebPolicy.externalHttps(value));
    }
    @Test public void savesOnlyRecognizedDocumentsAndSafeNames() throws Exception {
        WebPolicy.FileData pdf=WebPolicy.file("../../orcamento.exe",data("application/pdf","%PDF-1.7\ncontent"));
        assertEquals("application/pdf",pdf.mime); assertEquals("criaos.pdf",pdf.name);
        WebPolicy.FileData csv=WebPolicy.file("financeiro.csv",data("text/csv;charset=utf-8;","\uFEFFNome;Valor\r\nCliente;10"));
        assertEquals("text/csv",csv.mime); assertEquals("financeiro.csv",csv.name);
        assertTrue(csv.bytes.length>0);
    }
    @Test public void rejectsExecutableInvalidAndOversizedPayloads() {
        for(String value:new String[]{data("text/html","<script>alert(1)</script>"),data("application/pdf","not a PDF"),"data:text/csv;base64,invalid!","data:text/csv;base64,","data:application/octet-stream;base64,AAAA", "data:text/csv;base64,"+"A".repeat(WebPolicy.MAX_FILE_BYTES*4/3+256)}) {
            try { WebPolicy.file("arquivo",value); fail("Conteúdo aceito indevidamente"); } catch(Exception expected) { }
        }
    }
}
