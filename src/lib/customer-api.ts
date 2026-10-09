import { buildApiUrl } from "@/lib/api-base";
import { useCustomerAuthStore } from "@/store/customer-auth-store";

export class CustomerApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CustomerApiError";
    this.status = status;
  }
}

function customerAuthHeaders(): HeadersInit {
  const token = useCustomerAuthStore.getState().accessToken;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseCustomerJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as {
    data?: T | null;
    error?: { message?: string } | null;
  } | null;
  if (!res.ok || body?.error || body?.data == null) {
    throw new CustomerApiError(res.status, body?.error?.message ?? res.statusText ?? "Request failed");
  }
  return body.data;
}

export async function customerApiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "GET",
    headers: customerAuthHeaders(),
    cache: "no-store",
  });
  return parseCustomerJson<T>(res);
}

export async function customerApiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(buildApiUrl(path), {
    method: "GET",
    headers: customerAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } | null } | null;
    throw new CustomerApiError(res.status, body?.error?.message ?? res.statusText ?? "Request failed");
  }
  return res.blob();
}
