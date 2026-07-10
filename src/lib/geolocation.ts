"use client";

export type GeoCoords = {
  latitude: number;
  longitude: number;
};

/**
 * Best-effort GPS for damage metadata. Returns null if denied or unavailable.
 */
export function readGeolocation(
  timeoutMs = 10_000,
): Promise<GeoCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
