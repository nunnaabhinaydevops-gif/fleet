export type FleetxVehicle = Record<string, unknown>;

export async function fetchFleetxRealtime(vehicleNumber?: string): Promise<unknown> {
  const query = vehicleNumber ? `?vehicleNumber=${encodeURIComponent(vehicleNumber)}` : "";
  const response = await fetch(`/api/fleetx/realtime${query}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : "Fleetx realtime data is unavailable.");
  return payload;
}

export function extractFleetxVehicles(payload: unknown): FleetxVehicle[] {
  const candidates: unknown[] = [
    payload,
    (payload as any)?.data,
    (payload as any)?.vehicles,
    (payload as any)?.data?.vehicles,
    (payload as any)?.results,
    (payload as any)?.data?.results,
    (payload as any)?.items,
    (payload as any)?.data?.items,
    (payload as any)?.content,
    (payload as any)?.data?.content,
    (payload as any)?.result,
  ];
  const list = candidates.find(Array.isArray) as unknown[] | undefined;
  return (list ?? []).filter((item): item is FleetxVehicle => Boolean(item && typeof item === "object"));
}

export function readFleetxValue(item: FleetxVehicle, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}
