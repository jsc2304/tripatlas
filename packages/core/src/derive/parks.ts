export interface ParkInput {
  sourceId: string;
  startTime: Date;
  endTime: Date | null;
  endLat: number | null;
  endLon: number | null;
  endAddress: string | null;
  // Odometer am Fahrtende — zusammen mit dem startOdometerKm der Folgefahrt
  // dient es dazu, „Phantom-Parks" über ungeloggte Fahrstrecke zu erkennen.
  endOdometerKm: number | null;
  startOdometerKm: number | null;
}

// Springt der Odometer zwischen Fahrtende und nächstem Fahrtstart um mehr als
// diese Distanz (in BELIEBIGE Richtung), war das Auto zwischenzeitlich ungeloggt
// unterwegs — kein echter Park. Ein Park hält den Odometer praktisch konstant
// (< 5 km). Betrifft v.a. die Tessie→TeslaMate-Lücke (real: ~4.600 km vorwärts;
// bei Quellenwechsel kann die Odometer-Basis aber auch springen), die sonst
// einen „4-Monate-Park" über die ganze Lücke erzeugen würde. Der Betrag deckt
// beide Richtungen ab.
const ODOMETER_JUMP_KM = 5;

export interface DerivedPark {
  sourceId: string;
  startTime: Date;
  endTime: Date | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  durationSeconds: number | null;
}

/**
 * Leitet Park-Sessions aus einer Fahrzeug-Fahrtenliste ab (sortiert nach
 * startTime, ein Fahrzeug, completed + ggf. eine offene Fahrt am Ende).
 * Zwischen zwei aufeinanderfolgenden abgeschlossenen Fahrten liegt eine Park-
 * Session: von drives[n].endTime bis drives[n+1].startTime, an drives[n]s
 * End-Koordinaten/-Adresse. Nach der letzten abgeschlossenen Fahrt entsteht
 * eine offene Park-Session (endTime null) — außer eine Fahrt läuft gerade.
 */
export function deriveParkSessions(drives: ParkInput[]): DerivedPark[] {
  const parks: DerivedPark[] = [];

  for (let i = 0; i < drives.length; i++) {
    const current = drives[i]!;
    if (current.endTime == null) continue; // offene Fahrt selbst erzeugt keinen Park

    const next = drives[i + 1];
    if (next != null) {
      // Overlap-Schutz: falls die nächste Fahrt vor/gleich Ende der aktuellen
      // startet (Datenkorrektur bei TeslaMate), keinen (negativen) Park bauen.
      if (next.startTime.getTime() <= current.endTime.getTime()) continue;

      // Odometer-Sprung-Schutz: springt der Odometer zwischen den beiden Fahrten
      // um mehr als 5 km (in beliebige Richtung), war das Auto zwischenzeitlich
      // unterwegs (nicht geparkt) — kein Park über diese Datenlücke hinweg.
      if (
        current.endOdometerKm != null &&
        next.startOdometerKm != null &&
        Math.abs(next.startOdometerKm - current.endOdometerKm) > ODOMETER_JUMP_KM
      ) {
        continue;
      }

      parks.push({
        sourceId: `tm-drive:${current.sourceId}`,
        startTime: current.endTime,
        endTime: next.startTime,
        lat: current.endLat,
        lon: current.endLon,
        address: current.endAddress,
        durationSeconds: Math.round(
          (next.startTime.getTime() - current.endTime.getTime()) / 1000,
        ),
      });
    } else {
      // Letzte Fahrt in der Liste: offener Park, sofern sie abgeschlossen ist
      // (kein weiterer, evtl. noch laufender Drive folgt).
      parks.push({
        sourceId: `tm-drive:${current.sourceId}`,
        startTime: current.endTime,
        endTime: null,
        lat: current.endLat,
        lon: current.endLon,
        address: current.endAddress,
        durationSeconds: null,
      });
    }
  }

  return parks;
}
