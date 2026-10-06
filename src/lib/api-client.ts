import { useAuthStore } from "@/store/auth-store";
import { buildApiUrl } from "./api-base";
import { toast } from "sonner";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function showApiConflictToast(message?: string): void {
  if (typeof window === "undefined") return;
  toast.error(
    message ?? "Data conflict — operation was blocked to prevent data loss."
  );
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: {
    data: T | null;
    error: (Record<string, unknown> & { message?: string; code?: string }) | null;
  };
  try {
    body = text ? (JSON.parse(text) as typeof body) : { data: null, error: { message: "Empty response" } };
  } catch {
    const hint =
      res.status >= 500
        ? " Server may be waking up (Render free tier) — wait ~60s and retry. Also verify NEXT_PUBLIC_API_URL has no trailing /api."
        : "";
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new ApiError(
      res.status,
      preview ? `${preview}${hint}` : `Non-JSON response (${res.status}).${hint}`
    );
  }
  if (!res.ok || body.error) {
    const { message, code, ...rest } = body.error ?? {};
    if (res.status === 409) {
      showApiConflictToast(
        typeof message === "string" && message.trim().length > 0
          ? message
          : "Data conflict — operation was blocked to prevent data loss."
      );
    }
    throw new ApiError(
      res.status,
      (typeof message === "string" ? message : null) ?? res.statusText ?? "Request failed",
      typeof code === "string" ? code : undefined,
      Object.keys(rest).length ? rest : undefined
    );
  }
  return body.data as T;
}

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().accessToken;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  return parseResponse<T>(res);
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(buildApiUrl(path), {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    await parseResponse<never>(res);
    throw new ApiError(res.status, res.statusText || "Request failed");
  }
  return res.blob();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

/** POST multipart body (do not set Content-Type; browser sets boundary). */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: h,
    body: form,
  });
  return parseResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseResponse<T>(res);
}
