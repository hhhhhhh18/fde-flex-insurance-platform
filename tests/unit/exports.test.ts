import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/exports/csv";
import { canonicalJson, checksumsFor, sha256 } from "@/lib/exports/dataset";

describe("CSV export", () => {
  it("writes a stable header and LF line endings", () => {
    const csv = toCsv([{ b: 2, a: 1 }], ["a", "b"]);
    expect(csv).toBe("a,b\n1,2\n");
  });

  it("escapes commas, quotes and newlines per RFC 4180", () => {
    const csv = toCsv([{ name: 'Smith, "Jr"\nline', value: 1 }], ["name", "value"]);
    expect(csv).toBe('name,value\n"Smith, ""Jr""\nline",1\n');
  });

  it("renders null and undefined as empty cells", () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }], ["a", "b", "c"]);
    expect(csv).toBe("a,b,c\n,,0\n");
  });

  it("produces identical output for identical input", () => {
    const rows = [{ ref: "QTE-1", premium: "10.00" }];
    expect(toCsv(rows)).toBe(toCsv(rows));
  });
});

describe("canonical JSON and checksums", () => {
  it("sorts keys so serialization is independent of insertion order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    const nested = canonicalJson({ z: { y: 1, x: 2 } });
    expect(nested.indexOf('"x"')).toBeLessThan(nested.indexOf('"y"'));
  });

  it("preserves array order", () => {
    expect(JSON.parse(canonicalJson([2, 1]))).toEqual([2, 1]);
  });

  it("hashes to a stable sha256", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("changes the checksum when dataset content changes", () => {
    const base = { applicants: [{ reference: "APP-2026-00001", firstName: "A" }] };
    const changed = { applicants: [{ reference: "APP-2026-00001", firstName: "B" }] };

    expect(checksumsFor(base).applicants).toBe(checksumsFor(base).applicants);
    expect(checksumsFor(base).applicants).not.toBe(checksumsFor(changed).applicants);
  });

  it("computes one checksum per entity plus a dataset digest", () => {
    const dataset = {
      applicants: [{ reference: "APP-1" }],
      quotes: [{ reference: "QTE-1" }],
    };
    const checksums = checksumsFor(dataset);

    expect(checksums.applicants).toBeTruthy();
    expect(checksums.quotes).toBeTruthy();
    expect(checksums.__dataset__).toBeTruthy();
  });
});
