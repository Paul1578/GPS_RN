type VehicleLike = {
  marca?: string | null;
  modelo?: string | null;
  placa?: string | null;
} | null;

export const formatVehicleLabel = (
  vehicle?: VehicleLike,
  fallbackId?: string
): string => {
  const model = vehicle?.modelo?.trim() ?? "";
  const brand = vehicle?.marca?.trim() ?? "";
  const name = [model, brand].filter(Boolean).join(" ").trim();
  const plate = vehicle?.placa?.trim() ?? "";

  if (name && plate) return `${name} (${plate})`;
  if (name) return name;
  if (plate) return plate;
  return fallbackId ?? "N/D";
};
