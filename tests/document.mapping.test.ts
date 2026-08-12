import { beforeEach, expect, test } from "vite-plus/test";
import { ServerTimestampSentinel } from "../src/schema.utils.ts";
import {
  configureDocumentMapping,
  fromDocData,
  normalizeString,
  toDocData,
} from "../src/document.mapping.ts";
import type { DocumentConfigRegistry } from "../src/document.config.ts";

type TestModelType = "account" | "contact";

const isModel = (value: unknown): value is { _type: TestModelType } =>
  typeof value === "object" &&
  value !== null &&
  "_type" in value &&
  (value as { _type: unknown })._type !== undefined;

const registry: DocumentConfigRegistry<TestModelType> = {
  account: {
    collections: ["accounts/:id"],
    data: {
      id: {},
      metadata: { cast: "json_string" },
      name_normalized: { normalization_of: "name" },
    },
  },
};

beforeEach(() => {
  configureDocumentMapping(registry, isModel);
});

test("toDocData strips the _type discriminator", () => {
  expect(toDocData({ _type: "account", nickname: "Acme" })).toEqual({ nickname: "Acme" });
});

test("toDocData drops undefined fields", () => {
  expect(toDocData({ name: "Acme", nickname: undefined })).toEqual({ name: "Acme" });
});

test("toDocData replaces a ServerTimestampSentinel using the configured callback", () => {
  configureDocumentMapping(registry, isModel, () => "SERVER_TIMESTAMP");

  const result = toDocData({ _type: "account", created_at: new ServerTimestampSentinel() });

  expect(result.created_at).toBe("SERVER_TIMESTAMP");
});

test("toDocData leaves a ServerTimestampSentinel as-is when no callback is configured", () => {
  const sentinel = new ServerTimestampSentinel();

  const result = toDocData({ _type: "account", created_at: sentinel });

  expect(result.created_at).toBe(sentinel);
});

test("toDocData recursively converts nested models", () => {
  const result = toDocData({
    _type: "account",
    contact: { _type: "contact", name: "Jane" },
  });

  expect(result.contact).toEqual({ name: "Jane" });
});

test("toDocData recursively converts models inside arrays", () => {
  const result = toDocData({
    _type: "account",
    contacts: [{ _type: "contact", name: "Jane" }, "not-a-model"],
  });

  expect(result.contacts).toEqual([{ name: "Jane" }, "not-a-model"]);
});

test("toDocData JSON-stringifies fields configured with cast: json_string", () => {
  const result = toDocData({ _type: "account", metadata: { a: 1 } });

  expect(result.metadata).toBe(JSON.stringify({ a: 1 }));
});

test("toDocData accepts an explicit modelType when data has no _type of its own", () => {
  const result = toDocData({ metadata: { a: 1 } }, "account");

  expect(result.metadata).toBe(JSON.stringify({ a: 1 }));
});

test("toDocData throws if configureDocumentMapping was never called", () => {
  configureDocumentMapping(undefined as unknown as DocumentConfigRegistry<TestModelType>, isModel);

  expect(() => toDocData({ _type: "account", name: "Acme" })).toThrow();
});

test("fromDocData parses a JSON-stringified json_string field back into an object", () => {
  configureDocumentMapping(registry, isModel);

  const result = fromDocData({}, { metadata: JSON.stringify({ a: 1 }) }, "account");

  expect(result).toEqual({ metadata: { a: 1 }, _type: "account" });
});

test("fromDocData converts timestamp values via the configured callback", () => {
  const marker = { seconds: 123 };
  configureDocumentMapping(registry, isModel, undefined, (value) =>
    value === marker ? new Date(2026, 0, 1) : undefined,
  );

  const result = fromDocData<{ created_at: Date }>({}, { created_at: marker }, "account");

  expect(result.created_at).toEqual(new Date(2026, 0, 1));
});

test("fromDocData sets _type from the given modelType", () => {
  const result = fromDocData({}, { name: "Acme" }, "account");

  expect(result).toMatchObject({ _type: "account" });
});

test("fromDocData omits _type when no modelType is given", () => {
  const result = fromDocData({}, { name: "Acme" });

  expect(result).not.toHaveProperty("_type");
});

test("fromDocData syncs a path param into a field of the same name declared in the config", () => {
  const result = fromDocData({ id: "abc" }, { metadata: "{}" }, "account");

  expect(result).toMatchObject({ id: "abc" });
});

test("fromDocData syncs a path param into a field already present in the raw data", () => {
  const result = fromDocData({ id: "abc" }, { id: "stale", name: "Acme" }, "account");

  expect(result).toMatchObject({ id: "abc", name: "Acme" });
});

test("normalizeString uppercases, strips non-alphanumerics, and collapses whitespace", () => {
  expect(normalizeString("  Jane's   Diner! ")).toBe("JANES DINER");
});

test("normalizeString treats null/undefined as an empty string", () => {
  expect(normalizeString(undefined)).toBe("");
  expect(normalizeString(null)).toBe("");
});

test("toDocData computes a normalization_of field from its source field", () => {
  const result = toDocData({ _type: "account", name: "Jane's Diner" });

  expect(result.name_normalized).toBe("JANES DINER");
});

test("toDocData omits a normalization_of field when its source field is absent", () => {
  const result = toDocData({ _type: "account", metadata: { a: 1 } });

  expect(result).not.toHaveProperty("name_normalized");
});

test("toDocData recomputes a normalization_of field on partial updates that include the source", () => {
  const result = toDocData({ name: "Bob's Diner" }, "account");

  expect(result.name_normalized).toBe("BOBS DINER");
});

test("fromDocData ignores a path param with no matching data field or config entry", () => {
  configureDocumentMapping(
    {
      account: { collections: ["accounts/:id"], data: { metadata: { cast: "json_string" } } },
    },
    isModel,
  );

  const result = fromDocData({ id: "abc" }, { name: "Acme" }, "account");

  expect(result).not.toHaveProperty("id");
});
