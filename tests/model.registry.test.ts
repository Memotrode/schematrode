import { expect, test } from "vite-plus/test";
import { z } from "zod";
import { createModelRegistry } from "../src/model.registry.ts";

const WidgetSchema = z.object({
  _type: z.literal("widget").default("widget"),
  id: z.string(),
  created_at: z.date().optional(),
});

const GadgetSchema = z.object({
  _type: z.literal("gadget").default("gadget"),
  id: z.string(),
});

const { registry, isModel, isModelOfType, toJson, fromJson } = createModelRegistry({
  widget: WidgetSchema,
  gadget: GadgetSchema,
});

test("registry exposes the schemas it was built from", () => {
  expect(registry.widget).toBe(WidgetSchema);
  expect(registry.gadget).toBe(GadgetSchema);
});

test("isModel recognizes a value with a _type present in the registry", () => {
  expect(isModel({ _type: "widget" })).toBe(true);
});

test("isModel rejects values without a recognized _type", () => {
  expect(isModel({ _type: "not_a_model" })).toBe(false);
  expect(isModel({})).toBe(false);
  expect(isModel(null)).toBe(false);
});

test("isModelOfType narrows to a specific model type", () => {
  const value = { _type: "widget" };

  expect(isModelOfType(value, "widget")).toBe(true);
  expect(isModelOfType(value, "gadget")).toBe(false);
});

test("toJson strips _type from a model", () => {
  expect(toJson({ _type: "widget", id: "1" })).toEqual({ id: "1" });
});

test("toJson strips _type from nested models and arrays, leaves plain values untouched", () => {
  const result = toJson({
    _type: "widget",
    id: "1",
    gadgets: [{ _type: "gadget", id: "2" }, "not-a-model"],
  });

  expect(result).toEqual({ id: "1", gadgets: [{ id: "2" }, "not-a-model"] });
});

test("toJson converts Date instances to ISO strings", () => {
  const date = new Date(2026, 0, 1);

  expect(toJson({ _type: "widget", id: "1", created_at: date })).toEqual({
    id: "1",
    created_at: date.toISOString(),
  });
});

test("fromJson restores _type and validates against the model's schema", () => {
  const result = fromJson("widget", { id: "1" });

  expect(result).toEqual({ _type: "widget", id: "1" });
});

test("fromJson throws if the data doesn't satisfy the model's schema", () => {
  expect(() => fromJson("widget", { id: 5 })).toThrow();
});

test("fromJson revives a z.date() field from its ISO string form", () => {
  const date = new Date(2026, 0, 1);
  const wire = toJson({ _type: "widget", id: "1", created_at: date });

  const revived = fromJson("widget", wire);

  expect(revived.created_at).toBeInstanceOf(Date);
  expect(revived.created_at?.getTime()).toBe(date.getTime());
});

test("fromJson validates against an explicit scoped schema when given one", () => {
  const scopeSchema = WidgetSchema.pick({ _type: true, id: true });

  const result = fromJson("widget", { id: "1" }, scopeSchema);

  expect(result).toEqual({ _type: "widget", id: "1" });
});
