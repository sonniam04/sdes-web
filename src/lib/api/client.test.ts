import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./client";

const user = { id: "u1", email: "a@b.c", displayName: "ผู้ทดสอบ", roles: ["AP_CLERK"], mustChangePassword: false };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(url), init ?? {})));
  return { client: new ApiClient(fetchMock as unknown as typeof fetch), fetchMock };
}

describe("ApiClient", () => {
  it("แนบ access token ที่ได้จาก login และไม่เก็บใน storage", async () => {
    const { client, fetchMock } = setup((url) =>
      url === "/auth/login" ? json(200, { accessToken: "A1", expiresIn: 900, user }) : json(200, { ok: true }),
    );
    await client.login("a@b.c", "pw");
    await client.request("/documents");
    const [, init] = fetchMock.mock.calls[1]!;
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer A1");
    expect(globalThis.localStorage?.length ?? 0).toBe(0);
  });

  it("401 → refresh → ลองใหม่ด้วย token ใหม่", async () => {
    let docsCalls = 0;
    const { client, fetchMock } = setup((url, init) => {
      if (url === "/auth/login") return json(200, { accessToken: "OLD", expiresIn: 900, user });
      if (url === "/auth/refresh") return json(200, { accessToken: "NEW", expiresIn: 900, user });
      docsCalls++;
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer NEW" ? json(200, { items: [1] }) : json(401, { message: "เซสชันหมดอายุ" });
    });
    await client.login("a@b.c", "pw");
    await expect(client.request("/documents")).resolves.toEqual({ items: [1] });
    expect(docsCalls).toBe(2);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(["/auth/login", "/api/documents", "/auth/refresh", "/api/documents"]);
    expect(client.accessToken).toBe("NEW");
  });

  it("refresh ไม่ผ่าน → โยน 401 และล้าง session", async () => {
    const onSession = vi.fn();
    const { client } = setup((url) => (url === "/auth/refresh" ? json(401, { message: "หมดอายุ" }) : json(401, { message: "หมดอายุ" })));
    client.onSession(onSession);
    await expect(client.request("/documents")).rejects.toMatchObject({ status: 401 });
    expect(onSession).toHaveBeenLastCalledWith(null);
    expect(client.accessToken).toBeNull();
  });

  it("คำขอหลายตัวที่ได้ 401 พร้อมกัน refresh เพียงครั้งเดียว", async () => {
    let refreshes = 0;
    const { client } = setup((url, init) => {
      if (url === "/auth/refresh") {
        refreshes++;
        return json(200, { accessToken: "NEW", expiresIn: 900, user });
      }
      return (init.headers as Record<string, string>).Authorization === "Bearer NEW" ? json(200, {}) : json(401, {});
    });
    await Promise.all([client.request("/a"), client.request("/b"), client.request("/c")]);
    expect(refreshes).toBe(1);
  });

  it("ไม่ retry error อื่นนอกจาก 401 และใช้ข้อความภาษาไทยจาก server", async () => {
    const { client, fetchMock } = setup(() => json(403, { message: "ไม่มีสิทธิ์ทำรายการนี้" }));
    const err = await client.request("/admin/users").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, message: "ไม่มีสิทธิ์ทำรายการนี้" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ข้อความ error ที่อ่านไม่ได้ ไม่แสดงรายละเอียดภายใน", async () => {
    const { client } = setup(() => new Response("<html>stack trace</html>", { status: 500 }));
    await expect(client.request("/x")).rejects.toMatchObject({ status: 500, message: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
  });

  it("refresh ที่ค้างอยู่ตอนผู้ใช้ล็อกอิน ไม่ล้าง session ใหม่", async () => {
    let releaseRefresh!: () => void;
    const { client } = setup((url) => {
      if (url === "/auth/refresh") return new Promise((r) => (releaseRefresh = () => r(json(401, {}))));
      return json(200, { accessToken: "LOGIN", expiresIn: 900, user });
    });
    const pending = client.refresh();
    await client.login("a@b.c", "pw");
    releaseRefresh();
    await pending;
    expect(client.accessToken).toBe("LOGIN");
  });

  it("บังคับเปลี่ยนรหัส: ส่ง code password_change_required กลับมาให้ UI", async () => {
    const { client } = setup(() => json(403, { code: "password_change_required", message: "กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน" }));
    await expect(client.request("/documents")).rejects.toMatchObject({ code: "password_change_required" });
  });
});
