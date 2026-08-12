import { z } from "zod";

/** unwraps optional/nullable/default wrappers to reach the underlying schema type */
const unwrapSchema = (schema: z.ZodType): z.ZodType => {
  const def = schema.def as { type: string; innerType?: z.ZodType };
  if (
    (def.type === "optional" || def.type === "nullable" || def.type === "default") &&
    def.innerType
  ) {
    return unwrapSchema(def.innerType);
  }
  return schema;
};

/** converts ISO date strings back into `Date` instances wherever the schema declares a `z.date()` field */
const reviveDates = (schema: z.ZodType, value: unknown): unknown => {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodDate) {
    return typeof value === "string" ? new Date(value) : value;
  }
  if (unwrapped instanceof z.ZodArray) {
    const elementSchema = unwrapped.def.element as z.ZodType;
    return Array.isArray(value) ? value.map((item) => reviveDates(elementSchema, item)) : value;
  }
  if (unwrapped instanceof z.ZodObject) {
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, fieldValue]) => {
        const fieldSchema = unwrapped.shape[key];
        return [key, fieldSchema ? reviveDates(fieldSchema, fieldValue) : fieldValue];
      }),
    );
  }
  return value;
};

/**
 * Builds a typed model registry from a map of `_type` -> schema, plus the
 * isModel/toJson/fromJson helpers closed over it. Callers assemble their
 * own `{ account: AccountSchema, ... }` object and pass it in.
 */
export const createModelRegistry = <T extends Record<string, z.ZodType>>(registry: T) => {
  type ModelRegistry = T;
  type ModelType = keyof ModelRegistry & string;

  const isModel = (value: unknown): value is { _type: ModelType } => {
    return (
      typeof value === "object" &&
      value !== null &&
      "_type" in value &&
      typeof (value as any)._type === "string" &&
      (value as any)._type in registry
    );
  };

  const isModelOfType = <K extends ModelType>(
    value: unknown,
    type: K,
  ): value is z.infer<ModelRegistry[K]> => {
    return isModel(value) && value._type === type;
  };

  const toJson = <D>(data: D): D => {
    if (data instanceof Date) {
      return data.toISOString() as D;
    }
    if (Array.isArray(data)) {
      return data.map((item) => toJson(item)) as D;
    }
    if (data === null || typeof data !== "object") {
      return data;
    }
    const entries = Object.entries(data as Record<string, unknown>).filter(([key]) =>
      isModel(data) ? key !== "_type" : true,
    );
    return Object.fromEntries(entries.map(([key, value]) => [key, toJson(value)])) as D;
  };

  function fromJson<K extends ModelType>(
    type: K,
    data: Record<string, unknown>,
  ): z.infer<ModelRegistry[K]>;
  function fromJson<S extends z.ZodType>(
    type: ModelType,
    data: Record<string, unknown>,
    schema: S,
  ): z.infer<S>;
  function fromJson(type: ModelType, data: Record<string, unknown>, schema?: z.ZodType): unknown {
    const targetSchema = schema ?? registry[type];
    const revived = reviveDates(targetSchema, { ...data, _type: type });
    return targetSchema.parse(revived);
  }

  return { registry, isModel, isModelOfType, toJson, fromJson };
};
