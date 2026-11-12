import { describe, expect, it } from "vitest";
import { homeFor } from "./home";

describe("homeFor (spec overview-dashboard \"Dashboard as home page\")", () => {
  it("ทุก role เริ่มที่หน้าภาพรวม", () => {
    expect(homeFor()).toBe("/");
  });
});
