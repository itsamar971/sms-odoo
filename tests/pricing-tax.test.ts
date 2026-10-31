import { describe, expect, it } from "vitest";
import { variantPrice } from "@/lib/services/pricing";
import { computeLineTax } from "@/lib/services/tax";
import { round2 } from "@/lib/money";

describe("variant price", () => {
  it("is sales price + sum of attribute extra prices", () => {
    expect(variantPrice({ salesPrice: 899 }, [{ extraPrice: 560 }])).toBe(1459);
    expect(variantPrice({ salesPrice: 2499 }, [{ extraPrice: 560 }, { extraPrice: 1200 }])).toBe(4259);
  });
  it("falls back to sales price with no values / zero extras", () => {
    expect(variantPrice({ salesPrice: 899 }, [])).toBe(899);
    expect(variantPrice({ salesPrice: 899 }, [{ extraPrice: 0 }])).toBe(899);
  });
  it("does not suffer from float drift", () => {
    expect(variantPrice({ salesPrice: 0.1 }, [{ extraPrice: 0.2 }])).toBe(0.3);
  });
});

describe("tax calculation", () => {
  const gst = { id: "g", name: "GST", type: "PERCENT" as const, rate: 18, active: true };
  const cess = { id: "c", name: "Cess", type: "FIXED" as const, rate: 25, active: true };

  it("applies PERCENT to the post-discount amount", () => {
    expect(computeLineTax(900, 1, [gst]).total).toBe(162);
  });
  it("applies FIXED per unit", () => {
    expect(computeLineTax(1000, 4, [cess]).total).toBe(100);
  });
  it("sums multiple taxes", () => {
    const r = computeLineTax(1000, 2, [gst, cess]);
    expect(r.total).toBe(230);
    expect(r.breakdown).toHaveLength(2);
  });
  it("rounds half-up to 2dp", () => {
    // 18% of 10.25 = 1.845 -> 1.85 (half-up)
    expect(computeLineTax(10.25, 1, [gst]).total).toBe(1.85);
    expect(round2(2.675)).toBe(2.68);
  });
  it("ignores inactive taxes", () => {
    expect(computeLineTax(1000, 1, [{ ...gst, active: false }]).total).toBe(0);
  });
});
