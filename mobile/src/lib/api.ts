import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import {
  enqueueMutation,
  failQueuedMutation,
  getQueuedMutations,
  mutateCachedResponse,
  readCachedResponse,
  removeQueuedMutation,
  retryFailedMutations,
  saveCachedResponse,
  type QueuedMutation,
} from "@/lib/offline-store";

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
  syncState?: "pending";
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
export type MobileAIProvider = "anthropic" | "gemini" | "openai";
export interface MobileAIPreferences {
  voiceName: string;
  voiceRate: number;
  voicePitch: number;
  autoSpeak: boolean;
  responseLength: "concise" | "balanced" | "detailed";
  tutorTone: "supportive" | "direct" | "socratic";
}
export interface MobileAISettings {
  provider: MobileAIProvider;
  defaultProvider: MobileAIProvider;
  availableProviders: MobileAIProvider[];
  preferences: MobileAIPreferences;
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

class NetworkUnavailableError extends Error {
  constructor() {
    super("Could not reach Catalysts. Check the API URL and network connection.");
    this.name = "NetworkUnavailableError";
  }
}

type RequestPolicy<T> = {
  offlineFallback?: T;
  mutationId?: string;
  queueOffline?: boolean;
  skipQueue?: boolean;
};

const TASKS_PATH = "/api/mobile/v1/tasks";
let activePushToken: string | null = null;
const taskCacheListeners = new Set<() => void>();

export function setActivePushToken(token: string | null) {
  activePushToken = token;
}

export function subscribeToTaskCacheChanges(listener: () => void) {
  taskCacheListeners.add(listener);
  return () => taskCacheListeners.delete(listener);
}

function isQueueableMutation(path: string, method: string, body: string | undefined) {
  if (!["POST", "PATCH", "DELETE"].includes(method)) return false;
  if (path === TASKS_PATH || /^\/api\/mobile\/v1\/tasks\/[a-f\d]{24}$/i.test(path)) return true;
  if (method === "POST" && [
    "/api/mobile/v1/study-sessions",
    "/api/mobile/v1/habits",
    "/api/mobile/v1/memories",
  ].includes(path)) return true;
  if (path === "/api/mobile/v1/academic" && method === "POST") {
    const action = (JSON.parse(body ?? "{}") as { action?: string }).action;
    return action === "currentYear" || action === "currentSemester" || action === "grade";
  }
  return false;
}

async function queueOfflineMutation<T>(
  path: string,
  method: string,
  options: RequestInit,
  token: string | undefined,
  policy: RequestPolicy<T>,
) {
  const body = typeof options.body === "string" ? options.body : undefined;
  if (
    policy.skipQueue
    || !policy.queueOffline
    || !policy.mutationId
    || !token
    || Platform.OS === "web"
    || !isQueueableMutation(path, method, body)
  ) {
    return null;
  }

  await enqueueMutation({
    id: policy.mutationId,
    method: method as QueuedMutation["method"],
    path,
    body: body ?? null,
    createdAt: new Date().toISOString(),
    error: null,
  });
  return { value: policy.offlineFallback as T };
}

export async function createClientMutationId() {
  const bytes = await Crypto.getRandomBytesAsync(12);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getApiBaseUrl(): string | null {
  const baseUrl = process.env.EXPO_PUBLIC_CATALYSTS_API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return null;
  const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;
  if (!isDevelopment && !baseUrl.startsWith("https://")) return null;
  return baseUrl;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  policy: RequestPolicy<T> = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Set EXPO_PUBLIC_CATALYSTS_API_URL in mobile/.env.local to connect to Catalysts.");
  }

  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(policy.mutationId ? { "X-Catalysts-Mutation-Id": policy.mutationId } : {}),
        ...(activePushToken ? { "X-Catalysts-Device-Token": activePushToken } : {}),
        ...options.headers,
      },
    });
  } catch {
    const networkError = new NetworkUnavailableError();
    if (method === "GET" && token && Platform.OS !== "web") {
      const cached = await readCachedResponse<T>(path);
      if (cached !== null) return cached;
    }
    const queued = await queueOfflineMutation(path, method, options, token, policy);
    if (queued) return queued.value;
    throw networkError;
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (method === "GET" && token && Platform.OS !== "web" && response.status >= 500) {
      const cached = await readCachedResponse<T>(path);
      if (cached !== null) return cached;
    }
    if (response.status >= 500) {
      const queued = await queueOfflineMutation(path, method, options, token, policy);
      if (queued) return queued.value;
    }
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Catalysts could not complete the request.";
    throw new ApiError(message, response.status);
  }
  if (method === "GET" && token && Platform.OS !== "web") {
    try {
      await saveCachedResponse(path, payload);
    } catch (cause) {
      console.error("Could not cache API response for offline use", cause);
    }
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

export function registerPushToken(token: string, pushToken: string, platform: "android" | "ios") {
  return request<{ ok: true }>("/api/mobile/v1/push-token", {
    method: "POST",
    body: JSON.stringify({ token: pushToken, platform }),
  }, token);
}

export function unregisterPushToken(token: string, pushToken: string) {
  return request<void>("/api/mobile/v1/push-token", {
    method: "DELETE",
    body: JSON.stringify({ token: pushToken }),
  }, token);
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
  return (async () => {
    const mutationId = await createClientMutationId();
    const result = await request<{ id: string; title: string; status: string; queued?: boolean }>(
      TASKS_PATH,
      { method: "POST", body: JSON.stringify({ ...input, clientMutationId: mutationId }) },
      token,
      { mutationId, queueOffline: true, offlineFallback: { id: mutationId, title: input.title, status: "todo", queued: true } },
    );
    await updateCachedTasks((tasks) => [
      ...(tasks ?? []).filter((task) => task.id !== result.id),
      {
        id: result.id,
        courseId: input.courseId || null,
        title: input.title,
        description: input.description || null,
        type: input.type,
        priority: input.priority,
        status: "todo",
        dueDate: input.dueDate || null,
        courseCode: null,
        ...(result.queued ? { syncState: "pending" as const } : {}),
      },
    ]);
    return result;
  })();
}

export function updateTask(token: string, id: string, input: {
  title: string;
  description: string;
  type: string;
  priority: string;
  dueDate: string;
  courseId: string;
}) {
  return (async () => {
    const result = await request<{ id: string; title: string; status: string; queued?: boolean }>(
      `/api/mobile/v1/tasks/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token,
      { mutationId: await createClientMutationId(), queueOffline: true, offlineFallback: { id, title: input.title, status: "todo", queued: true } },
    );
    await updateCachedTasks((tasks) => (tasks ?? []).map((task) => task.id === id
      ? { ...task, ...input, courseId: input.courseId || null, description: input.description || null, dueDate: input.dueDate || null, courseCode: task.courseCode, ...(result.queued ? { syncState: "pending" as const } : {}) }
      : task));
    return result;
  })();
}

export function deleteTask(token: string, id: string) {
  return (async () => {
    await request<void>(
      `/api/mobile/v1/tasks/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token,
      { mutationId: await createClientMutationId(), queueOffline: true },
    );
    await updateCachedTasks((tasks) => (tasks ?? []).filter((task) => task.id !== id));
  })();
}

export function updateTaskStatus(token: string, id: string, status: MobileTask["status"]) {
  return (async () => {
    const result = await request<{ id: string; status: string; queued?: boolean }>(
      `/api/mobile/v1/tasks/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token,
      { mutationId: await createClientMutationId(), queueOffline: true, offlineFallback: { id, status, queued: true } },
    );
    await updateCachedTasks((tasks) => (tasks ?? []).map((task) => task.id === id
      ? { ...task, status, ...(result.queued ? { syncState: "pending" as const } : {}) }
      : task));
    return result;
  })();
}

async function updateCachedTasks(update: (tasks: MobileTask[] | null) => MobileTask[]) {
  if (Platform.OS === "web") return;
  await mutateCachedResponse<MobileTask[]>(TASKS_PATH, (current) => update(current));
  for (const listener of taskCacheListeners) listener();
}

export function createStudySession(token: string, input: { date: string; durationMinutes: string; courseId: string; notes: string }) {
  return (async () => {
    const mutationId = await createClientMutationId();
    return request<{ id: string; durationMinutes: number; queued?: boolean }>("/api/mobile/v1/study-sessions", {
      method: "POST",
      body: JSON.stringify({ ...input, clientMutationId: mutationId }),
    }, token, {
      mutationId,
      queueOffline: true,
      offlineFallback: { id: mutationId, durationMinutes: Number(input.durationMinutes), queued: true },
    });
  })();
}

export function createHabit(token: string, input: { name: string; description: string }) {
  return (async () => {
    const mutationId = await createClientMutationId();
    return request<{ id: string; name: string; queued?: boolean }>("/api/mobile/v1/habits", {
      method: "POST",
      body: JSON.stringify({ ...input, clientMutationId: mutationId }),
    }, token, { mutationId, queueOffline: true, offlineFallback: { id: mutationId, name: input.name, queued: true } });
  })();
}

export function createMemory(token: string, input: { content: string; category: string; courseId: string }) {
  return (async () => {
    const mutationId = await createClientMutationId();
    return request<{ id: string; content: string; category: string; queued?: boolean }>("/api/mobile/v1/memories", {
      method: "POST",
      body: JSON.stringify({ ...input, clientMutationId: mutationId }),
    }, token, { mutationId, queueOffline: true, offlineFallback: { id: mutationId, content: input.content, category: input.category, queued: true } });
  })();
}

export function askTutor(token: string, input: { question: string; courseId?: string; materialId?: string; conversationId?: string; includeAcademicContext?: boolean; includeUpcomingTasks?: boolean }) {
  return request<TutorResponse>("/api/mobile/v1/tutor", {
    method: "POST",
    body: JSON.stringify(input),
  }, token);
}

export function getAcademicData(token: string) { return request<AcademicData>("/api/mobile/v1/academic", {}, token); }
export function academicAction(token: string, input: Record<string, unknown>) {
  return (async () => {
    const mutationId = await createClientMutationId();
    return request<{ ok: boolean; queued?: boolean }>(
      "/api/mobile/v1/academic",
      { method: "POST", body: JSON.stringify(input) },
      token,
      { mutationId, queueOffline: true, offlineFallback: { ok: true, queued: true } },
    );
  })();
}
export function getMaterials(token: string) { return request<MobileMaterial[]>("/api/mobile/v1/materials", {}, token); }
export function uploadMaterialRequest(token: string, input: { filename: string; sizeBytes: number; courseId: string }) { return request<{uploadUrl: string;storageKey: string;contentType: string}>("/api/mobile/v1/materials", {method:"POST",body:JSON.stringify({action:"requestUpload",...input})}, token); }
export function confirmMaterialUpload(token: string, input: { storageKey: string; originalFilename: string; courseId: string }) { return request<{materialId: string}>("/api/mobile/v1/materials", {method:"POST",body:JSON.stringify({action:"confirmUpload",...input})}, token); }
export function retryMaterialProcessing(token: string, materialId: string) { return request<{ok: true}>("/api/mobile/v1/materials", {method:"POST",body:JSON.stringify({action:"retryProcessing",materialId})}, token); }
export function getStudyNotes(token: string) { return request<MobileNote[]>("/api/mobile/v1/study-notes", {}, token); }
export function generateStudyNotes(token: string, materialId: string, courseId?: string) { return request<{resourceId: string;content: MobileNoteDetail["content"]}>("/api/mobile/v1/study-notes", {method:"POST",body:JSON.stringify({materialId,courseId})}, token); }
export function getStudyNote(token: string, id: string) { return request<MobileNoteDetail>(`/api/mobile/v1/study-notes/${encodeURIComponent(id)}`, {}, token); }
export function deleteStudyNote(token: string, id: string) { return request<void>(`/api/mobile/v1/study-notes/${encodeURIComponent(id)}`, {method:"DELETE"}, token); }
export function getMobileAISettings(token: string) { return request<MobileAISettings>("/api/mobile/v1/ai-settings", {}, token); }
export function updateMobileAISettings(token: string, input: { action: "provider"; provider: MobileAIProvider } | { action: "resetProvider" } | { action: "preferences"; preferences: MobileAIPreferences }) {
  return request<{ ok: true }>("/api/mobile/v1/ai-settings", { method: "PATCH", body: JSON.stringify(input) }, token);
}

export async function flushOfflineQueue(token: string) {
  const queue = await getQueuedMutations();
  let synced = 0;
  for (const mutation of queue) {
    if (mutation.error) break;
    try {
      await request(
        mutation.path,
        {
          method: mutation.method,
          ...(mutation.body ? { body: mutation.body } : {}),
        },
        token,
        { mutationId: mutation.id, skipQueue: true },
      );
      await removeQueuedMutation(mutation.id);
      await clearPendingTaskMarker(mutation);
      synced += 1;
    } catch (cause) {
      if (cause instanceof NetworkUnavailableError || (cause instanceof ApiError && cause.status >= 500)) break;
      const message = cause instanceof Error ? cause.message : "This change could not be synced.";
      await failQueuedMutation(mutation.id, message);
      break;
    }
  }
  return synced;
}

async function clearPendingTaskMarker(mutation: QueuedMutation) {
  if (!mutation.path.startsWith(`${TASKS_PATH}/`) && mutation.path !== TASKS_PATH) return;
  if (mutation.method === "DELETE") return;
  const taskId = mutation.path === TASKS_PATH
    ? mutation.id
    : mutation.path.slice(`${TASKS_PATH}/`.length);
  await updateCachedTasks((tasks) => (tasks ?? []).map((task) => {
    if (task.id !== taskId || !task.syncState) return task;
    const { syncState: _syncState, ...syncedTask } = task;
    return syncedTask;
  }));
}

export { retryFailedMutations };
