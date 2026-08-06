/**
 * Approximate sunrise/sunset via NOAA solar equations (civil sun, -0.833°).
 * Good enough for theme day/night; not navigation-grade.
 *
 * Geolocation preferred; otherwise contiguous US geographic center
 * (~Lebanon, KS) so mid-continent fleets get reasonable defaults.
 */

export const DEFAULT_SOLAR_LAT = 39.8283;
export const DEFAULT_SOLAR_LNG = -98.5795;

export const SOLAR_COORDS_STORAGE_KEY = "pf-theme-solar-coords";

export type SolarCoords = { lat: number; lng: number };

export type SunTimes = {
  sunrise: Date;
  sunset: Date;
};

function toJulianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function julianCentury(jd: number): number {
  return (jd - 2451545) / 36525;
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

function normalizeDegrees(d: number): number {
  const x = d % 360;
  return x < 0 ? x + 360 : x;
}

/**
 * Sunrise/sunset for the calendar day of `date` at lat/lng (WGS84).
 * Returns null near polar day/night when the sun never rises or sets.
 */
export function getSunTimes(
  date: Date,
  latitude: number,
  longitude: number,
): SunTimes | null {
  const lat = Math.min(89.9, Math.max(-89.9, latitude));
  const lng = longitude;

  // Noon UTC on the local calendar day keeps the day-of-year stable.
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const noonUtc = new Date(Date.UTC(y, m, d, 12, 0, 0));
  const t = julianCentury(toJulianDay(noonUtc));

  const geomMeanLong =
    normalizeDegrees(280.46646 + t * (36000.76983 + t * 0.0003032));
  const geomMeanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccent =
    0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const sunEqCtr =
    Math.sin(degToRad(geomMeanAnom)) *
      (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(degToRad(2 * geomMeanAnom)) * (0.019993 - 0.000101 * t) +
    Math.sin(degToRad(3 * geomMeanAnom)) * 0.000289;
  const sunTrueLong = geomMeanLong + sunEqCtr;
  const sunAppLong =
    sunTrueLong -
    0.00569 -
    0.00478 * Math.sin(degToRad(125.04 - 1934.136 * t));
  const meanObliq =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliqCorr =
    meanObliq + 0.00256 * Math.cos(degToRad(125.04 - 1934.136 * t));
  const sunDeclin = radToDeg(
    Math.asin(
      Math.sin(degToRad(obliqCorr)) * Math.sin(degToRad(sunAppLong)),
    ),
  );

  const varY = Math.tan(degToRad(obliqCorr / 2)) ** 2;
  const eqOfTime =
    4 *
    radToDeg(
      varY * Math.sin(2 * degToRad(geomMeanLong)) -
        2 * eccent * Math.sin(degToRad(geomMeanAnom)) +
        4 *
          eccent *
          varY *
          Math.sin(degToRad(geomMeanAnom)) *
          Math.cos(2 * degToRad(geomMeanLong)) -
        0.5 * varY * varY * Math.sin(4 * degToRad(geomMeanLong)) -
        1.25 * eccent * eccent * Math.sin(2 * degToRad(geomMeanAnom)),
    );

  const hourAngleArg =
    Math.cos(degToRad(90.833)) /
      (Math.cos(degToRad(lat)) * Math.cos(degToRad(sunDeclin))) -
    Math.tan(degToRad(lat)) * Math.tan(degToRad(sunDeclin));

  if (hourAngleArg < -1 || hourAngleArg > 1) {
    return null;
  }

  const ha = radToDeg(Math.acos(hourAngleArg));
  const solarNoonMin = 720 - 4 * lng - eqOfTime;
  const sunriseMin = solarNoonMin - ha * 4;
  const sunsetMin = solarNoonMin + ha * 4;

  const dayStartUtc = Date.UTC(y, m, d, 0, 0, 0);
  // Minutes are relative to UTC midnight of the local calendar date.
  // Convert: solar minutes are UTC-based (lng already in formula).
  const sunrise = new Date(dayStartUtc + sunriseMin * 60000);
  const sunset = new Date(dayStartUtc + sunsetMin * 60000);
  return { sunrise, sunset };
}

/** True when local sun is above the horizon (daytime). */
export function isDaytimeAt(
  now: Date,
  latitude: number,
  longitude: number,
): boolean {
  const times = getSunTimes(now, latitude, longitude);
  if (!times) {
    // Polar edge / failure: crude 06:00–18:00 local fallback.
    const h = now.getHours() + now.getMinutes() / 60;
    return h >= 6 && h < 18;
  }
  return now >= times.sunrise && now < times.sunset;
}

export function resolveSolarTheme(
  now: Date,
  coords: SolarCoords = {
    lat: DEFAULT_SOLAR_LAT,
    lng: DEFAULT_SOLAR_LNG,
  },
): "light" | "dark" {
  return isDaytimeAt(now, coords.lat, coords.lng) ? "light" : "dark";
}

export function readStoredSolarCoords(): SolarCoords {
  if (typeof window === "undefined") {
    return { lat: DEFAULT_SOLAR_LAT, lng: DEFAULT_SOLAR_LNG };
  }
  try {
    const raw = localStorage.getItem(SOLAR_COORDS_STORAGE_KEY);
    if (!raw) return { lat: DEFAULT_SOLAR_LAT, lng: DEFAULT_SOLAR_LNG };
    const parsed = JSON.parse(raw) as Partial<SolarCoords>;
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    /* ignore */
  }
  return { lat: DEFAULT_SOLAR_LAT, lng: DEFAULT_SOLAR_LNG };
}

export function persistSolarCoords(coords: SolarCoords) {
  try {
    localStorage.setItem(SOLAR_COORDS_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    /* ignore */
  }
}

/** Compact daytime check for the FOUC init script (same math as above). */
export function buildSolarDaytimeCheckScript(coordsKey: string): string {
  const lat = DEFAULT_SOLAR_LAT;
  const lng = DEFAULT_SOLAR_LNG;
  return `function pfIsDay(n){try{var lat=${lat},lng=${lng};var raw=localStorage.getItem(${JSON.stringify(coordsKey)});if(raw){var p=JSON.parse(raw);if(typeof p.lat==="number"&&typeof p.lng==="number"){lat=p.lat;lng=p.lng;}}lat=Math.min(89.9,Math.max(-89.9,lat));var y=n.getFullYear(),m=n.getMonth(),d=n.getDate();var noon=Date.UTC(y,m,d,12,0,0);var jd=noon/86400000+2440587.5;var t=(jd-2451545)/36525;var D=Math.PI/180,R=180/Math.PI;function nd(x){x%=360;return x<0?x+360:x;}var gml=nd(280.46646+t*(36000.76983+t*0.0003032));var gma=357.52911+t*(35999.05029-0.0001537*t);var ecc=0.016708634-t*(0.000042037+0.0000001267*t);var sec=Math.sin(D*gma)*(1.914602-t*(0.004817+0.000014*t))+Math.sin(D*2*gma)*(0.019993-0.000101*t)+Math.sin(D*3*gma)*0.000289;var stl=gml+sec;var sal=stl-0.00569-0.00478*Math.sin(D*(125.04-1934.136*t));var mob=23+(26+(21.448-t*(46.815+t*(0.00059-t*0.001813)))/60)/60;var oc=mob+0.00256*Math.cos(D*(125.04-1934.136*t));var sd=R*Math.asin(Math.sin(D*oc)*Math.sin(D*sal));var vy=Math.tan(D*oc/2);vy*=vy;var eot=4*R*(vy*Math.sin(2*D*gml)-2*ecc*Math.sin(D*gma)+4*ecc*vy*Math.sin(D*gma)*Math.cos(2*D*gml)-0.5*vy*vy*Math.sin(4*D*gml)-1.25*ecc*ecc*Math.sin(2*D*gma));var arg=Math.cos(D*90.833)/(Math.cos(D*lat)*Math.cos(D*sd))-Math.tan(D*lat)*Math.tan(D*sd);if(arg<-1||arg>1){var h=n.getHours()+n.getMinutes()/60;return h>=6&&h<18;}var ha=R*Math.acos(arg);var sn=720-4*lng-eot;var rise=Date.UTC(y,m,d,0,0,0)+(sn-ha*4)*6e4;var set=Date.UTC(y,m,d,0,0,0)+(sn+ha*4)*6e4;var ms=n.getTime();return ms>=rise&&ms<set;}catch(e){var h2=n.getHours()+n.getMinutes()/60;return h2>=6&&h2<18;}}`;
}
