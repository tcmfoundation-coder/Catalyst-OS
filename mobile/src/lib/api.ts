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
  study: { today: string; thisWeek: string; thisWeekMinutes: number };
  performance: {
    days: { date: string; studyMinutes: number; completedTasks: number }[];
    current: { studyMinutes: number; completedTasks: number };
    previous: { studyMinutes: number; completedTasks: number };
  };
  habits: { completedToday: number; total: number };
}

export interface DailyPriorityResponse {
  recommendation: {
    title: string;
    reason: string;
    nextStep: string;
    taskId: string | null;
  };
}

export interface MobileTask {
  id: string;
  courseId: string | null;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: "todo" | "in_progress" | "completed";
  dueDate: string | null;
  courseCode: string | null;
}

export interface TutorResponse {
  ok: boolean;
  conversationId: string | null;
  answer?: string;
  error?: string;
  followUpQuestion: string | null;
  retrievalStatus: string;
  sources: { materialId: string; courseId: string | null; page: number | null; slide: number | null; heading: string | null }[];
}

export interface AcademicData {
  years: { id: string; label: string; isCurrent: boolean }[];
  semesters: { id: string; academicYearId: string; name: string; isCurrent: boolean }[];
  courses: { id: string; semesterId: string; code: string; title: string; creditUnits: number; grade: string | null }[];
}
export interface MobileMaterial { id: string; filename: string; format: string; sizeBytes: number; status: string; processingError: string | null; title: string | null; courseId: string | null; courseCode: string | null; createdAt: string }
export interface MobileNote { id: string; title: string; materialId: string; createdAt: string }
export interface MobileNoteDetail extends MobileNote { content: { title: string; overview: string; sections: { heading: string; summary: string; keyPoints: string[]; definitions: {term: string;definition: string}[]; examples: string[] }[] }; sources: {materialId: string; page?: number; slide?: number; heading?: string}[] }

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

export function getDailyPriority(token: string) {
  return request<DailyPriorityResponse>("/api/mobile/v1/daily-priority", { method: "POST" }, token);
}

export function getTasks(token: string) {
  return request<MobileTask[]>("/api/mobile/v1/tasks", {}, token);
}

export function createTask(token: string, input: {
  title: string;
  description: string;
  type: string;
  priority: string;
  dueDate: string;
  courseId: string;
}) {
  return request<{ id: string; title: string; status: string }>("/api/mobile/v1/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export function updateTask(token: string, id: string, input: {
  title: string;
  description: string;
  type: string;
  priority: string;
  dueDate: string;
  courseId: string;
}) {
  return request<{ id: string; title: string; status: string }>(`/api/mobile/v1/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }, token);
}

export function deleteTask(token: string, id: string) {
  return request<void>(`/api/mobile/v1/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }, token);
}

export function updateTaskStatus(token: string, id: string, status: MobileTask["status"]) {
  return request<{ id: string; status: string }>(`/api/mobile/v1/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }, token);
}

export function createStudySession(token: string, input: { date: string; durationMinutes: string; courseId: string; notes: string }) {
  return request<{ id: string; durationMinutes: number }>("/api/mobile/v1/study-sessions", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export function createHabit(token: string, input: { name: string; description: string }) {
  return request<{ id: string; name: string }>("/api/mobile/v1/habits", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export function createMemory(token: string, input: { content: string; category: string; courseId: string }) {
  return request<{ id: string; content: string; category: string }>("/api/mobile/v1/memories", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export function askTutor(token: string, input: { question: string; courseId?: string; materialId?: string; conversationId?: string; includeAcademicContext?: boolean; includeUpcomingTasks?: boolean }) {
  return request<TutorResponse>("/api/mobile/v1/tutor", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export function getAcademicData(token: string) { return request<AcademicData>("/api/mobile/v1/academic", {}, token); }
export function academicAction(token: string, input: Record<string, unknown>) { return request<{ok: boolean}>("/api/mobile/v1/academic", { method: "POST", body: JSON.stringify(input) }, token); }
export function getMaterials(token: string) { return request<MobileMaterial[]>("/api/mobile/v1/materials", {}, token); }
export function uploadMaterialRequest(token: string, input: { filename: string; sizeBytes: number; courseId: string }) { return request<{uploadUrl: string;storageKey: string;contentType: string}>("/api/mobile/v1/materials", {method:"POST",body:JSON.stringify({action:"requestUpload",...input})}, token); }
export function confirmMaterialUpload(token: string, input: { storageKey: string; originalFilename: string; courseId: string }) { return request<{materialId: string}>("/api/mobile/v1/materials", {method:"POST",body:JSON.stringify({action:"confirmUpload",...input})}, token); }
export function retryMaterialProcessing(token: string, materialId: string) { return request<{ok: true}>("/api/mobile/v1/materials", {method:"POST",body:JSON.stringify({action:"retryProcessing",materialId})}, token); }
export function getStudyNotes(token: string) { return request<MobileNote[]>("/api/mobile/v1/study-notes", {}, token); }
export function generateStudyNotes(token: string, materialId: string, courseId?: string) { return request<{resourceId: string;content: MobileNoteDetail["content"]}>("/api/mobile/v1/study-notes", {method:"POST",body:JSON.stringify({materialId,courseId})}, token); }
export function getStudyNote(token: string, id: string) { return request<MobileNoteDetail>(`/api/mobile/v1/study-notes/${encodeURIComponent(id)}`, {}, token); }
export function deleteStudyNote(token: string, id: string) { return request<void>(`/api/mobile/v1/study-notes/${encodeURIComponent(id)}`, {method:"DELETE"}, token); }
