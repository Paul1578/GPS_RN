type DriverLike =
  | {
      firstName?: string | null;
      lastName?: string | null;
      nombres?: string | null;
      apellidos?: string | null;
      username?: string | null;
      userName?: string | null;
      name?: string | null;
    }
  | null
  | undefined;

const clean = (value?: string | null) => value?.trim() ?? "";

export const formatDriverLabel = (
  driver?: DriverLike,
  fallback = "N/D"
): string => {
  if (!driver) return fallback;

  const fullName = [clean(driver.firstName), clean(driver.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;

  const profileName = [clean(driver.nombres), clean(driver.apellidos)]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (profileName) return profileName;

  const userLike = clean(driver.username) || clean(driver.userName) || clean(driver.name);
  if (userLike) return userLike;

  return fallback;
};
