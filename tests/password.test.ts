import { describe, expect, it } from "vitest";
import { validatePassword } from "@/lib/services/password";

describe("password validation", () => {
  it("accepts a strong password", () => {
    expect(validatePassword("Admin@1234").valid).toBe(true);
  });
  it("requires length > 8", () => {
    expect(validatePassword("Ab@12345").valid).toBe(false); // exactly 8
    expect(validatePassword("Ab@123456").valid).toBe(true); // 9
  });
  it("requires an uppercase letter", () => {
    expect(validatePassword("admin@1234").errors).toContain("Password needs at least one uppercase letter");
  });
  it("requires a lowercase letter", () => {
    expect(validatePassword("ADMIN@1234").errors).toContain("Password needs at least one lowercase letter");
  });
  it("requires a special character", () => {
    expect(validatePassword("Admin12345").errors).toContain("Password needs at least one special character");
  });
});
