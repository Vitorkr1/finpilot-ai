package com.criatech.criaos.rotas;
import org.junit.Test;
import static org.junit.Assert.*;
public class ApiTest {
    @Test public void acceptsHttpsRootOnly() throws Exception {
        assertEquals("https://empresa.example", Api.normalize(" https://empresa.example/ "));
        assertEquals("https://empresa.example:8443", Api.normalize("https://empresa.example:8443"));
    }
    @Test public void rejectsCredentialsPathsQueriesAndCleartext() {
        for(String url:new String[]{"http://empresa.example","https://user:pass@empresa.example","https://empresa.example/api","https://empresa.example?token=secret","https://empresa.example#x","javascript:alert(1)","file:///etc/passwd","https:///missing-host"}) {
            try { Api.normalize(url); fail("URL aceita: "+url); } catch(Exception expected) { }
        }
    }
}
