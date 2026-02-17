import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode as atob } from "base-64";
import { notify, notifyError } from "@/utils/notify";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://camping-again-breath-meal.trycloudflare.com/api";
const TOKEN_STORAGE_KEY = "auth_tokens";
const CURRENT_USER_STORAGE_KEY = "currentUser";

type ApiRole = "Admin" | "Driver" | "Manager" | "User" | "Logistics";

interface ApiUser {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  roles: ApiRole[] | string[];
  driverId?: string;
}

interface AuthResponseDto {
  user?: ApiUser;
  accessToken?: string;
  accessTokenExpiration?: string;
  token?: string;
  expiration?: string;
  refreshToken: string;
  refreshTokenExpiration: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface ApiErrorPayload {
  statusCode?: number;
  error?: string;
  message?: string;
  details?: Record<string, string[]>;
}

export type UserRole = "superadmin" | "gerente" | "logistica" | "chofer";

export interface UserPermissions {
  canViewMap: boolean;
  canCreateRoutes: boolean;
  canManageVehicles: boolean;
  canManageTeam: boolean;
  canViewOwnRoute: boolean;
  canAccessSuperAdmin?: boolean;
  canManageAllOrganizations?: boolean;
  canViewSystemLogs?: boolean;
  canExportData?: boolean;
}

interface User {
  id: string;
  nombres: string;
  apellidos: string;
  usuario: string;
  email?: string;
  identificacion?: string;
  role: UserRole;
  permissions: UserPermissions;
  teamId?: string;
  teamName?: string;
  isActive?: boolean;
  driverId?: string;
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  retry?: boolean;
  tokensOverride?: AuthTokens | null;
}

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; message?: string }>;
  register: (data: RegisterData) => Promise<boolean>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string
  ) => Promise<{ ok: boolean; message?: string }>;
  logoutAll: () => Promise<void>;
  createUser: (
    data: RegisterData & { role: UserRole; teamId?: string; email?: string }
  ) => Promise<boolean>;
  refreshTeamUsers: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoadingUser: boolean;
  updateUserPermissions: (
    userId: string,
    permissions: Partial<UserPermissions>
  ) => void;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  updateUserStatus: (userId: string, isActive: boolean) => Promise<void>;
  updateTeamName: (teamName: string) => void;
  getAllUsers: () => User[];
  getTeamUsers: () => User[];
  getManagers: () => User[];
  isSuperAdmin: () => boolean;
  apiFetch: <T>(path: string, options?: ApiRequestOptions) => Promise<T>;
}

interface RegisterData {
  nombres: string;
  apellidos: string;
  usuario: string;
  password: string;
  identificacion?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const roleMap: Record<ApiRole, UserRole> = {
  Admin: "gerente",
  Driver: "chofer",
  Manager: "logistica",
  User: "logistica",
  Logistics: "logistica",
};

const uiRoleToBackendRole: Record<UserRole, ApiRole> = {
  superadmin: "Admin",
  gerente: "Admin",
  logistica: "Logistics",
  chofer: "Driver",
};

const DEFAULT_REGISTER_ROLE: ApiRole = "Admin";

const defaultPermissions: Record<UserRole, UserPermissions> = {
  superadmin: {
    canViewMap: true,
    canCreateRoutes: true,
    canManageVehicles: true,
    canManageTeam: true,
    canViewOwnRoute: true,
    canAccessSuperAdmin: true,
    canManageAllOrganizations: true,
    canViewSystemLogs: true,
    canExportData: true,
  },
  gerente: {
    canViewMap: true,
    canCreateRoutes: true,
    canManageVehicles: true,
    canManageTeam: true,
    canViewOwnRoute: true,
    canAccessSuperAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemLogs: false,
    canExportData: false,
  },
  logistica: {
    canViewMap: true,
    canCreateRoutes: true,
    canManageVehicles: false,
    canManageTeam: false,
    canViewOwnRoute: false,
    canAccessSuperAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemLogs: false,
    canExportData: false,
  },
  chofer: {
    canViewMap: false,
    canCreateRoutes: false,
    canManageVehicles: false,
    canManageTeam: false,
    canViewOwnRoute: true,
    canAccessSuperAdmin: false,
    canManageAllOrganizations: false,
    canViewSystemLogs: false,
    canExportData: false,
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const tokensRef = useRef<AuthTokens | null>(null);
  const isAuthenticated = !!user;

  const saveTokens = async (tokens: AuthTokens | null) => {
    tokensRef.current = tokens;
    if (!tokens) {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  };

  const persistUser = async (value: User | null) => {
    setUser(value);
    if (!value) {
      await AsyncStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(value));
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [tokenEntry, userEntry] = await AsyncStorage.multiGet([
          TOKEN_STORAGE_KEY,
          CURRENT_USER_STORAGE_KEY,
        ]);

        const tokenRaw = tokenEntry?.[1];
        const userRaw = userEntry?.[1];

        if (userRaw) {
          const parsed = JSON.parse(userRaw) as User;
          setUser(parsed);
        }
        if (tokenRaw) {
          const parsedTokens = JSON.parse(tokenRaw) as AuthTokens;
          tokensRef.current = parsedTokens;
          if (!userRaw) {
            const fetched = await fetchMeUser(parsedTokens);
            if (fetched) {
              await persistUser(fetched);
            } else {
              const derived = deriveUserFromToken(parsedTokens.accessToken);
              if (derived) await persistUser(derived);
            }
          }
        }
      } finally {
        setIsLoadingUser(false);
      }
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "chofer") {
      void refreshTeamUsers();
    } else {
      setTeamUsers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.role]);

  const buildApiError = async (response: Response) => {
    let data: ApiErrorPayload | null = null;
    try {
      const text = await response.text();
      data = text ? (JSON.parse(text) as ApiErrorPayload) : null;
    } catch {
      // ignore parse errors
    }
    const enrichedError = new Error(
      data?.message ?? response.statusText
    ) as Error & { status?: number; data?: ApiErrorPayload | null };
    enrichedError.status = response.status;
    enrichedError.data = data;
    return enrichedError;
  };

  const refreshAccessToken = async () => {
    const refreshToken = tokensRef.current?.refreshToken;
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/Auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        await clearAuthState();
        return false;
      }
      const data = (await response.json()) as AuthResponseDto;
      await applyAuthResponse(data);
      return true;
    } catch (error) {
      console.error("Error al refrescar token:", error);
      await clearAuthState();
      return false;
    }
  };

  const apiFetch = async <T,>(
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<T> => {
    const { skipAuth = false, retry = true, tokensOverride, ...fetchOptions } =
      options;
    const headers = new Headers(fetchOptions.headers || {});
    if (!headers.has("Content-Type") && fetchOptions.body) {
      headers.set("Content-Type", "application/json");
    }

    if (!skipAuth) {
      let tokenSource = tokensOverride ?? tokensRef.current;
      if (!tokenSource) {
        const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) {
          tokenSource = JSON.parse(stored) as AuthTokens;
          tokensRef.current = tokenSource;
        }
      }
      if (tokenSource?.accessToken) {
        headers.set("Authorization", `Bearer ${tokenSource.accessToken}`);
      }
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (
      response.status === 401 &&
      !skipAuth &&
      retry &&
      tokensRef.current?.refreshToken
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetch<T>(path, { ...options, retry: false });
      }
    }

    if (!response.ok) {
      throw await buildApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  };

  const determineRole = (roles?: ApiRole[] | string | string[]): UserRole => {
    if (Array.isArray(roles)) {
      for (const role of roles) {
        const mapped = roleMap[role as ApiRole];
        if (mapped) return mapped;
      }
    } else if (typeof roles === "string") {
      const mapped = roleMap[roles as ApiRole];
      if (mapped) return mapped;
    }
    return "logistica";
  };

  const mapApiUser = (apiUser: ApiUser): User => {
    const mappedRole = determineRole(apiUser.roles as ApiRole[]);
    const username = apiUser.username || apiUser.email;
    const displayName = apiUser.firstName || username || apiUser.id;
    return {
      id: apiUser.id,
      nombres: displayName,
      apellidos: apiUser.lastName || "",
      usuario: username,
      email: apiUser.email,
      identificacion: undefined,
      role: mappedRole,
      permissions: defaultPermissions[mappedRole],
      isActive: apiUser.isActive,
      driverId: apiUser.driverId,
    };
  };

  const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    try {
      const [, payload] = token.split(".");
      if (!payload) return null;
      const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const getClaimValue = (
    payload: Record<string, unknown>,
    keys: string[]
  ): string | undefined => {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string") return value;
      if (Array.isArray(value) && value.length && typeof value[0] === "string") {
        return value[0];
      }
    }
    return undefined;
  };

  const deriveUserFromToken = (token?: string): User | null => {
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    const id =
      getClaimValue(payload, [
        "sub",
        "nameid",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      ]) ?? `temp-${Date.now()}`;

    const email =
      getClaimValue(payload, [
        "email",
        "unique_name",
        "upn",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      ]) ?? "";

    const usernameClaim = getClaimValue(payload, [
      "username",
      "preferred_username",
      "unique_name",
      "upn",
    ]);

    const firstName =
      getClaimValue(payload, [
        "given_name",
        "firstname",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
        "name",
      ]) ?? "";

    const lastName =
      getClaimValue(payload, [
        "family_name",
        "lastname",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
      ]) ?? "";

    const rolesClaim =
      getClaimValue(payload, [
        "role",
        "roles",
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
      ]) ?? payload["role"];

    const mappedRole = determineRole(
      Array.isArray(rolesClaim)
        ? (rolesClaim as string[])
        : (rolesClaim as string | undefined)
    );

    return {
      id,
      nombres: firstName || usernameClaim || email || id,
      apellidos: lastName,
      usuario: usernameClaim || email || id,
      email,
      role: mappedRole,
      permissions: defaultPermissions[mappedRole],
    };
  };

  const fetchMeUser = async (tokens?: AuthTokens | null) => {
    try {
      const me = await apiFetch<ApiUser>("/Auth/me", {
        tokensOverride: tokens ?? tokensRef.current,
      });
      return mapApiUser(me);
    } catch (error) {
      console.warn("No se pudo recuperar /Auth/me", error);
      return null;
    }
  };

  const applyAuthResponse = async (data: AuthResponseDto) => {
    const accessToken = data.accessToken ?? data.token ?? "";
    const refreshToken = data.refreshToken;
    if (accessToken && refreshToken) {
      await saveTokens({ accessToken, refreshToken });
    }
    let mappedUser: User | null = null;
    if (data.user) {
      mappedUser = mapApiUser(data.user);
    } else {
      mappedUser = await fetchMeUser({ accessToken, refreshToken });
      if (!mappedUser) {
        mappedUser = deriveUserFromToken(accessToken);
      }
    }
    if (mappedUser) {
      await persistUser(mappedUser);
    }
    setIsLoadingUser(false);
    return mappedUser;
  };

  const clearAuthState = async () => {
    tokensRef.current = null;
    await saveTokens(null);
    await persistUser(null);
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; message?: string }> => {
    try {
      const data = await apiFetch<AuthResponseDto>("/Auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });
      await applyAuthResponse(data);
      await refreshTeamUsers();
      notify("Sesion iniciada");
      return { ok: true };
    } catch (error) {
      const errData = (error as any)?.data as ApiErrorPayload | undefined;
      const message =
        errData?.message || (error as any)?.message || "Credenciales invalidas";
      notifyError(message);
      return { ok: false, message };
    }
  };

  const buildRegisterUsername = (data: RegisterData) => {
    const candidate = data.usuario.includes("@")
      ? data.usuario.split("@")[0] ?? data.usuario
      : data.usuario;
    const sanitized = candidate.replace(/[^a-zA-Z0-9._-]/g, "");
    if (sanitized) return sanitized;
    return `user${Date.now()}`;
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      const payload = {
        username: buildRegisterUsername(data),
        email: data.usuario,
        password: data.password,
        roleName: DEFAULT_REGISTER_ROLE,
        firstName: data.nombres,
        lastName: data.apellidos,
      };

      const response = await apiFetch<AuthResponseDto>("/Auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
        skipAuth: true,
      });
      await applyAuthResponse(response);
      notify("Registro exitoso");
      return true;
    } catch (error) {
      console.error("Error en registro:", error);
      notifyError("No se pudo completar el registro");
      return false;
    }
  };

  const logout = async () => {
    try {
      if (tokensRef.current?.refreshToken) {
        await apiFetch("/Auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: tokensRef.current.refreshToken }),
          skipAuth: true,
        });
      }
    } catch (error) {
      if ((error as any)?.status !== 401) {
        console.error("Error al cerrar sesion:", error);
      }
    } finally {
      await clearAuthState();
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string
  ): Promise<{ ok: boolean; message?: string }> => {
    try {
      await apiFetch("/Auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      return { ok: true };
    } catch (error) {
      const errData = (error as any)?.data;
      const message =
        errData?.message ||
        (Array.isArray(errData?.errors) ? errData.errors.join(", ") : "") ||
        (error as Error)?.message ||
        "No se pudo cambiar la contrasena";
      return { ok: false, message };
    }
  };

  const logoutAll = async () => {
    try {
      await apiFetch("/Auth/logout-all", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch (error) {
      const err = error as any;
      console.error("Error al cerrar sesion en todos los dispositivos:", {
        status: err?.status,
        message: err?.message,
        data: err?.data,
      });
    } finally {
      await logout();
    }
  };

  const createUser = async (
    data: RegisterData & { role: UserRole; teamId?: string; email?: string }
  ): Promise<boolean> => {
    try {
      const safePassword =
        data.password && data.password.trim().length >= 6
          ? data.password
          : "123456";
      const payload = {
        username: data.usuario,
        email: data.email ?? data.usuario,
        password: safePassword,
        roleName: uiRoleToBackendRole[data.role],
        teamId: data.teamId,
      };

      await apiFetch<ApiUser>("/Users", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await refreshTeamUsers();
      notify("Usuario creado");
      return true;
    } catch (error) {
      const errData = (error as any)?.data;
      const message =
        errData?.message ||
        (Array.isArray(errData) ? errData.join(", ") : "") ||
        (error as any)?.message ||
        "Error al crear usuario";
      console.error("Error al crear usuario:", error);
      notifyError(message);
      return false;
    }
  };

  const refreshTeamUsers = async () => {
    try {
      const data = await apiFetch<ApiUser[]>("/Users/my-team");
      const active = data.filter((u) => (u as any).isActive !== false);
      setTeamUsers(active.map(mapApiUser));
    } catch (error) {
      console.error("Error obteniendo equipo:", error);
    }
  };

  const getAllUsers = (): User[] => teamUsers;

  const getTeamUsers = (): User[] => teamUsers;

  const getManagers = (): User[] =>
    teamUsers.filter((u) => u.role === "gerente");

  const updateUserPermissions = (
    userId: string,
    permissions: Partial<UserPermissions>
  ) => {
    setTeamUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, permissions: { ...u.permissions, ...permissions } } : u
      )
    );
    if (user?.id === userId) {
      const updated = {
        ...(user as User),
        permissions: { ...user.permissions, ...permissions },
      };
      void persistUser(updated);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    const targetRole = uiRoleToBackendRole[newRole];
    const backendRoles: ApiRole[] = ["Admin", "Driver", "Logistics"];

    try {
      for (const role of backendRoles) {
        if (role !== targetRole) {
          try {
            await apiFetch(`/Users/${userId}/roles/${role}`, { method: "DELETE" });
          } catch {
            // ignore missing role
          }
        }
      }
      await apiFetch(`/Users/${userId}/roles/${targetRole}`, { method: "POST" });

      setTeamUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, role: newRole, permissions: defaultPermissions[newRole] }
            : u
        )
      );
      if (user?.id === userId) {
        void persistUser({
          ...(user as User),
          role: newRole,
          permissions: defaultPermissions[newRole],
        });
      }
    } catch (error) {
      console.error("Error actualizando rol:", error);
      notifyError("No se pudo actualizar el rol");
    }
  };

  const updateUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await apiFetch(`/Users/${userId}/status?isActive=${isActive}`, {
        method: "PUT",
      });
      setTeamUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive } : u)));
    } catch (error) {
      console.error("Error actualizando estado de usuario:", error);
    }
  };

  const isSuperAdmin = () => user?.role === "superadmin";

  const updateTeamName = (teamName: string) => {
    if (!user || user.role !== "gerente") return;
    const updatedUser = { ...user, teamName };
    setUser(updatedUser);
    void persistUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        changePassword,
        logoutAll,
        createUser,
        logout,
        isAuthenticated,
        isLoadingUser,
        updateUserPermissions,
        updateUserRole,
        updateUserStatus,
        updateTeamName,
        getAllUsers,
        getTeamUsers,
        refreshTeamUsers,
        getManagers,
        isSuperAdmin,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}
