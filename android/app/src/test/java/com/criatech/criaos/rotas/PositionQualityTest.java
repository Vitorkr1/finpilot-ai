package com.criatech.criaos.rotas;
import org.junit.Test;
import static org.junit.Assert.*;

public class PositionQualityTest {
    private final long now=100000;
    private PositionQuality.Fix fix(double latitude,float accuracy,long age,boolean gps) { return new PositionQuality.Fix(latitude,-34.88,accuracy,now-age,gps); }
    @Test public void networkCannotMoveRecentGpsToTheNextStreet() {
        PositionQuality.Fix gps=fix(-8.05,5,1000,true);
        assertFalse(PositionQuality.prefer(fix(-8.0493,40,0,false),gps,now));
        assertFalse(PositionQuality.prefer(fix(-8.0493,3,0,false),gps,now));
        assertFalse(PositionQuality.prefer(fix(-8.0493,3,1000,false),gps,now));
    }
    @Test public void veryPoorFixDoesNotReplaceGoodGps() {
        assertFalse(PositionQuality.prefer(fix(-8.0498,45,0,true),fix(-8.05,5,1000,true),now));
    }
    @Test public void normalVehicleMovementAndImprovedGpsAreAccepted() {
        assertTrue(PositionQuality.prefer(fix(-8.0499,8,0,true),fix(-8.05,6,3000,true),now));
        assertTrue(PositionQuality.prefer(fix(-8.05,4,0,true),fix(-8.05,20,1000,false),now));
    }
    @Test public void implausibleJumpIsRejectedWithoutInventingCoordinates() {
        assertFalse(PositionQuality.prefer(fix(-8.04,5,0,true),fix(-8.05,5,1000,true),now));
    }
    @Test public void staleGpsDoesNotBlockRecoveryOrGoodNetworkFallback() {
        assertTrue(PositionQuality.prefer(fix(-8.05,10,0,true),fix(-8.05,5,31000,true),now));
        assertTrue(PositionQuality.prefer(fix(-8.0499,20,0,false),fix(-8.05,5,15000,true),now));
    }
    @Test public void oldFutureAndOutOfOrderReadingsAreRejected() {
        assertFalse(PositionQuality.usable(fix(-8.05,5,30001,true),now));
        assertFalse(PositionQuality.usable(fix(-8.05,5,-1,true),now));
        assertFalse(PositionQuality.prefer(fix(-8.05,5,3000,true),fix(-8.05,5,1000,true),now));
    }
    @Test public void invalidCoordinatesAndAccuracyNeverLeaveTheDevice() {
        for(float accuracy:new float[]{0,-1,50.1f,Float.NaN,Float.POSITIVE_INFINITY}) assertFalse(PositionQuality.usable(fix(-8.05,accuracy,0,true),now));
        for(double latitude:new double[]{91,-91,Double.NaN,Double.POSITIVE_INFINITY}) assertFalse(PositionQuality.usable(fix(latitude,5,0,true),now));
        assertFalse(PositionQuality.usable(new PositionQuality.Fix(-8,181,5,now,true),now));
        assertTrue(PositionQuality.usable(fix(-8.05,50,0,true),now));
    }
}
