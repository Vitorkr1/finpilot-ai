package com.criatech.criaos.rotas;

final class PositionQuality {
    static final float MAX_ACCURACY_METERS = 50;
    static final long MAX_AGE_MS = 30000;
    static final long GPS_PRIORITY_MS = 10000;
    static final class Fix {
        final double latitude, longitude;
        final float accuracy;
        final long elapsedMs;
        final boolean gps;
        Fix(double latitude, double longitude, float accuracy, long elapsedMs, boolean gps) {
            this.latitude=latitude; this.longitude=longitude; this.accuracy=accuracy; this.elapsedMs=elapsedMs; this.gps=gps;
        }
    }
    static boolean usable(Fix point, long now) {
        return point!=null && Double.isFinite(point.latitude) && Math.abs(point.latitude)<=90
            && Double.isFinite(point.longitude) && Math.abs(point.longitude)<=180
            && Float.isFinite(point.accuracy) && point.accuracy>0 && point.accuracy<=MAX_ACCURACY_METERS
            && point.elapsedMs>0 && now-point.elapsedMs>=0 && now-point.elapsedMs<=MAX_AGE_MS;
    }
    static boolean prefer(Fix candidate, Fix current, long now) {
        if(!usable(candidate,now)) return false;
        if(!usable(current,now)) return true;
        if(candidate.elapsedMs<current.elapsedMs) return false;
        long currentAge=now-current.elapsedMs;
        // Rede não substitui um GPS recente, mesmo se declarar boa precisão.
        if(current.gps && !candidate.gps && currentAge<GPS_PRIORITY_MS) return false;
        if(candidate.elapsedMs==current.elapsedMs) return candidate.accuracy<current.accuracy;
        if(candidate.gps && !current.gps) return true;
        if(currentAge<5000 && candidate.accuracy>Math.max(25,current.accuracy*2)) return false;
        // Desconta as margens de erro antes de rejeitar um salto fisicamente improvável.
        double seconds=(candidate.elapsedMs-current.elapsedMs)/1000.0;
        return distance(current,candidate)<=current.accuracy+candidate.accuracy+60*seconds;
    }
    private static double distance(Fix a,Fix b) {
        double lat=Math.toRadians(b.latitude-a.latitude),lon=Math.toRadians(b.longitude-a.longitude);
        double x=Math.sin(lat/2)*Math.sin(lat/2)+Math.cos(Math.toRadians(a.latitude))*Math.cos(Math.toRadians(b.latitude))*Math.sin(lon/2)*Math.sin(lon/2);
        return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,x)),Math.sqrt(Math.max(0,1-x)));
    }
}
