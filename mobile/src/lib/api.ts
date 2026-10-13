export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface SessionResponse {
  token: string;
  expiresAt: string;
  user: UserProfile;
}

export interface DashboardResponse {
  academic: {
    year: string;
    semester: string | null;
    cgpa: number;
    semesterGpa: number;
    completedCreditUnits: number;
    remainingCreditUnits: number;
    courses: {
      id: string;
      code: string;
      title: string;
      creditUnits: number;
      grade: string | null;
    }[];
  } | null;
  tasks: {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    courseCode: string | null;
  }[];
  study: { today: string; thisWeek: string };
  habits: { completedToday: number; total: number };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBaseUrl(): string | null {
  const baseUrl = process.env.EXPO_PUBLIC_CATALYSTS_API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return null;
  const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;
  if (!isDevelopment && !baseUrl.startsWith("https://")) return null;
  return baseUrl;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Set EXPO_PUBLIC_CATALYSTS_API_URL in mobile/.env.local to connect to Catalysts.");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Could not reach Catalysts. Check the API URL and network connection.");
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Catalysts could not complete the request.";
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export function createMobileSession(email: string, password: string) {
  return request<SessionResponse>("/api/mobile/v1/session", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMobileSession(token: string) {
  return request<{ user: UserProfile }>("/api/mobile/v1/session", {}, token);
}

export function revokeMobileSession(token: string) {
  return request<void>("/api/mobile/v1/session", { method: "DELETE" }, token);
}

export function getDashboard(token: string) {
  return request<DashboardResponse>("/api/mobile/v1/dashboard", {}, token);
}
