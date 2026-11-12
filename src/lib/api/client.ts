// API client: access token อยู่ใน memory เท่านั้น (ไม่ลง localStorage)
// refresh token อยู่ใน cookie HttpOnly ที่ browser ส่งให้เองเมื่อเรียก /auth/refresh

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  roles: ("AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN")[];
  mustChangePassword: boolean;
};

export type Session = { accessToken: string; expiresIn: number; user: SessionUser };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Listener = (s: Session | null) => void;

/** ข้อความกลางเมื่อ server ไม่ส่งข้อความที่อ่านได้ — ไม่แสดงรายละเอียดภายใน */
const GENERIC = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

function messageOf(body: unknown): { message: string; code?: string } {
  if (body && typeof body === "object") {
    const b = body as { message?: unknown; code?: unknown };
    const m = Array.isArray(b.message) ? b.message[0] : b.message;
    return { message: typeof m === "string" ? m : GENERIC, code: typeof b.code === "string" ? b.code : undefined };
  }
  return { message: GENERIC };
}

export class ApiClient {
  private token: string | null = null;
  private refreshing: Promise<Session | null> | null = null;
  private listeners = new Set<Listener>();
  /** เพิ่มทุกครั้งที่ login — refresh ที่เริ่มก่อนหน้านั้นจะไม่ล้าง session ใหม่ */
  private generation = 0;

  constructor(
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    /** path prefix ของ API ที่เว็บส่งต่อไป backend (next.config rewrites) */
    private readonly apiBase = "/api",
  ) {}

  get accessToken() {
    return this.token;
  }

  onSession(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private setSession(s: Session | null) {
    this.token = s?.accessToken ?? null;
    for (const l of this.listeners) l(s);
  }

  async login(email: string, password: string): Promise<Session> {
    const s = await this.raw<Session>("/auth/login", { method: "POST", json: { email, password } });
    this.generation++;
    this.setSession(s);
    return s;
  }

  /** ต่ออายุ session — เรียกพร้อมกันหลายที่ได้ จะยิง /auth/refresh ครั้งเดียว */
  refresh(): Promise<Session | null> {
    const gen = this.generation;
    this.refreshing ??= this.raw<Session>("/auth/refresh", { method: "POST" })
      .then((s) => {
        if (gen === this.generation) this.setSession(s);
        return s;
      })
      .catch(() => {
        // ผู้ใช้ล็อกอินใหม่ระหว่างรอ → ไม่ล้าง session ที่ใหม่กว่า
        if (gen !== this.generation) return null;
        this.setSession(null);
        return null;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async logout() {
    await this.raw("/auth/logout", { method: "POST" }).catch(() => {});
    this.setSession(null);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const r = await this.request<{ accessToken: string }>("/auth/change-password", {
      method: "POST",
      json: { currentPassword, newPassword },
      base: "",
    });
    // token ใหม่ไม่มีเครื่องหมายบังคับเปลี่ยนรหัสแล้ว — ต่ออายุเพื่อให้ได้ข้อมูลผู้ใช้ล่าสุดด้วย
    this.token = r.accessToken;
    return this.refresh();
  }

  /** เรียก API พร้อม access token; ถ้า 401 จะ refresh แล้วลองใหม่หนึ่งครั้ง */
  async request<T>(path: string, init: { method?: string; json?: unknown; body?: BodyInit; base?: string } = {}): Promise<T> {
    const base = init.base ?? this.apiBase;
    try {
      return await this.raw<T>(`${base}${path}`, init, this.token);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      const s = await this.refresh();
      if (!s) throw e;
      return this.raw<T>(`${base}${path}`, init, s.accessToken);
    }
  }

  /** โหลดไฟล์ (เช่น ต้นฉบับเอกสาร) พร้อม access token; ถ้า 401 จะ refresh แล้วลองใหม่หนึ่งครั้ง */
  async requestBinary(path: string): Promise<{ data: ArrayBuffer; contentType: string; headers: Headers }> {
    const get = async (token: string | null) => {
      const res = await this.fetchImpl(`${this.apiBase}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "same-origin",
      });
      if (!res.ok) {
        const { message, code } = messageOf(safeJson(await res.text()));
        throw new ApiError(res.status, message, code);
      }
      return { data: await res.arrayBuffer(), contentType: res.headers.get("Content-Type") ?? "", headers: res.headers };
    };
    try {
      return await get(this.token);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      const s = await this.refresh();
      if (!s) throw e;
      return get(s.accessToken);
    }
  }

  private async raw<T>(url: string, init: { method?: string; json?: unknown; body?: BodyInit }, token?: string | null): Promise<T> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.json !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.fetchImpl(url, {
      method: init.method ?? "GET",
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      credentials: "same-origin",
    });
    const text = await res.text();
    const body = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const { message, code } = messageOf(body);
      throw new ApiError(res.status, message, code, body);
    }
    return body as T;
  }
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

export const api = new ApiClient();
