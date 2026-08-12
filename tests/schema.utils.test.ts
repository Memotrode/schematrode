import { expect, test } from "vite-plus/test";
import { z } from "zod";
import {
  decimalStringSchema,
  defineEnum,
  generateId,
  getDateToday,
  getSchemaDateFieldNames,
  getSchemaFieldNames,
  ianaTimeZoneSchema,
  isIanaTimeZone,
  isServerTimestampSentinel,
  localeSchema,
  nullableObject,
  ServerTimestampSentinel,
  serverTimestampSentinel,
} from "../src/schema.utils.ts";

const sampleSchema = z.object({
  id: z.string(),
  created_at: z.date(),
  updated_at: z.date().optional(),
  title: z.string().optional(),
});

test("getSchemaFieldNames returns all field names", () => {
  expect(getSchemaFieldNames(sampleSchema)).toEqual(["id", "created_at", "updated_at", "title"]);
});

test("getSchemaDateFieldNames returns only date fields, including optional dates", () => {
  expect(getSchemaDateFieldNames(sampleSchema)).toEqual(["created_at", "updated_at"]);
});

test("nullableObject makes every field nullable", () => {
  const schema = nullableObject(z.object({ id: z.string(), title: z.string() }));

  expect(schema.parse({ id: null, title: null })).toEqual({ id: null, title: null });
  expect(schema.parse({ id: "1", title: "hello" })).toEqual({ id: "1", title: "hello" });
});

test("nullableObject leaves already-nullable fields unwrapped twice", () => {
  const schema = nullableObject(z.object({ id: z.string().nullable() }));

  expect(schema.parse({ id: null })).toEqual({ id: null });
  expect(schema.parse({ id: "1" })).toEqual({ id: "1" });
});

test("decimalStringSchema accepts integer and decimal numeric strings", () => {
  expect(decimalStringSchema.parse("42")).toBe("42");
  expect(decimalStringSchema.parse("42.50")).toBe("42.50");
});

test("decimalStringSchema rejects non-numeric strings", () => {
  expect(() => decimalStringSchema.parse("abc")).toThrow();
  expect(() => decimalStringSchema.parse("42.")).toThrow();
});

test("defineEnum derives a zod schema and an options list from the same array", () => {
  const status = defineEnum([
    { label: "Draft", value: "draft" },
    { label: "Sent", value: "sent" },
  ] as const);

  expect(status.values).toEqual(["draft", "sent"]);
  expect(status.options).toEqual([
    { label: "Draft", value: "draft" },
    { label: "Sent", value: "sent" },
  ]);
  expect(status.schema.parse("draft")).toBe("draft");
  expect(() => status.schema.parse("archived")).toThrow();
});

test("generateId returns a valid uuid, unique per call", () => {
  const a = generateId();
  const b = generateId();

  expect(z.uuid().safeParse(a).success).toBe(true);
  expect(a).not.toBe(b);
});

test("getDateToday formats a given date as YYYY-MM-DD", () => {
  expect(getDateToday(new Date(2026, 0, 15))).toBe("2026-01-15");
});

test("ServerTimestampSentinel is a Date subclass detectable via isServerTimestampSentinel", () => {
  const sentinel = serverTimestampSentinel();

  expect(sentinel).toBeInstanceOf(Date);
  expect(sentinel).toBeInstanceOf(ServerTimestampSentinel);
  expect(isServerTimestampSentinel(sentinel)).toBe(true);
  expect(isServerTimestampSentinel(new Date())).toBe(false);
});

test("localeSchema accepts a bare language code", () => {
  expect(localeSchema.parse("en")).toBe("en");
});

test("localeSchema accepts a language-region code", () => {
  expect(localeSchema.parse("en-US")).toBe("en-US");
});

test("localeSchema accepts a language-script-region code", () => {
  expect(localeSchema.parse("zh-Hant-TW")).toBe("zh-Hant-TW");
});

test("localeSchema accepts a language-region code using a numeric UN M49 region", () => {
  expect(localeSchema.parse("es-419")).toBe("es-419");
});

test("localeSchema rejects an invalid locale", () => {
  const result = localeSchema.safeParse("not_a_locale!");
  expect(result.success).toBe(false);
});

test("localeSchema rejects a lowercase region code", () => {
  const result = localeSchema.safeParse("en-us");
  expect(result.success).toBe(false);
});

test("isIanaTimeZone accepts a valid IANA time zone", () => {
  expect(isIanaTimeZone("America/New_York")).toBe(true);
  expect(isIanaTimeZone("UTC")).toBe(true);
});

test("isIanaTimeZone rejects an invalid time zone", () => {
  expect(isIanaTimeZone("Not/A_Zone")).toBe(false);
  expect(isIanaTimeZone("")).toBe(false);
});

test("ianaTimeZoneSchema parses a valid time zone", () => {
  expect(ianaTimeZoneSchema.parse("America/New_York")).toBe("America/New_York");
});

test("ianaTimeZoneSchema rejects an invalid time zone", () => {
  const result = ianaTimeZoneSchema.safeParse("Not/A_Zone");
  expect(result.success).toBe(false);
});
