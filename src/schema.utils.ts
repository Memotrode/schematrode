import { z } from "zod";

export interface EnumOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  parent?: string;
}

export const defineEnum = <const T extends readonly EnumOption[]>(options: T) => {
  const values = options.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];
  return {
    options: options as unknown as EnumOption<T[number]["value"]>[],
    values,
    schema: z.enum(values),
  };
};

export const modelType = <T extends string>(value: T) => z.literal(value).default(value);

export const generateId = (): string => globalThis.crypto.randomUUID();

export const getSchemaFieldNames = (schema: z.ZodObject) => Object.keys(schema.shape);

export const getSchemaDateFieldNames = (schema: z.ZodObject) =>
  Object.entries(schema.shape)
    .filter(([_, value]) => {
      const unwrapped = value instanceof z.ZodOptional ? value.unwrap() : value;
      return unwrapped instanceof z.ZodDate;
    })
    .map(([key]) => key);

/** the foreign-key field this field is denormalized from, e.g. account_name's is "account_id" */
export const getDerivedFrom = (field: z.ZodType): string | undefined => {
  const derivedFrom = field.meta()?.derived_from;
  return typeof derivedFrom === "string" ? derivedFrom : undefined;
};

export const getDerivedFieldNames = (schema: z.ZodObject) =>
  Object.entries(schema.shape)
    .filter(([, value]) => getDerivedFrom(value as z.ZodType) !== undefined)
    .map(([key]) => key);

/** the schema ID this field is a single foreign key into, e.g. account_id's is "account" */
export const getBelongsTo = (field: z.ZodType): string | undefined => {
  const belongsTo = field.meta()?.belongs_to;
  return typeof belongsTo === "string" ? belongsTo : undefined;
};

/** the schema ID this field is an array of foreign keys into, e.g. tag_ids' is "tag" */
export const getBelongsToMany = (field: z.ZodType): string | undefined => {
  const belongsToMany = field.meta()?.belongs_to_many;
  return typeof belongsToMany === "string" ? belongsToMany : undefined;
};

export type ForeignKeyRef = { field: string; schema: string; many: boolean };

/** every belongs_to/belongs_to_many-tagged field on `schema`, with the schema ID each points to */
export const getForeignKeys = (schema: z.ZodObject): ForeignKeyRef[] =>
  Object.entries(schema.shape).reduce<ForeignKeyRef[]>((refs, [key, value]) => {
    const field = value as z.ZodType;
    const belongsTo = getBelongsTo(field);
    if (belongsTo !== undefined) {
      refs.push({ field: key, schema: belongsTo, many: false });
      return refs;
    }
    const belongsToMany = getBelongsToMany(field);
    if (belongsToMany !== undefined) {
      refs.push({ field: key, schema: belongsToMany, many: true });
    }
    return refs;
  }, []);

/** names of every belongs_to/belongs_to_many-tagged field on `schema` */
export const getForeignKeyFieldNames = (schema: z.ZodObject) =>
  getForeignKeys(schema).map(({ field }) => field);

export const omitDerivedFields = (schema: z.ZodObject) => {
  const derivedKeys: Record<string, true> = {};
  for (const key of getDerivedFieldNames(schema)) derivedKeys[key] = true;
  return schema.omit(derivedKeys);
};

/**
 * Picks `keys` from `modelSchema` for use as an MCP/HTTP/callable input
 * schema, throwing if any requested key is derived_from-tagged
 */
export const modelInputSchema = <
  T extends z.ZodObject,
  Keys extends Partial<Record<keyof T["shape"], true>>,
>(
  modelSchema: T,
  keys: Keys,
) => {
  const safeSchema = omitDerivedFields(modelSchema);
  const derivedKeys = new Set(getDerivedFieldNames(modelSchema));

  const pickKeys: Record<string, true> = {};
  for (const key of Object.keys(keys)) {
    if (derivedKeys.has(key)) {
      throw new Error(`modelInputSchema: cannot accept derived field "${key}" as input`);
    }
    pickKeys[key] = true;
  }
  return safeSchema.pick(pickKeys as any) as z.ZodObject<{
    [K in keyof Keys]: K extends keyof T["shape"] ? T["shape"][K] : never;
  }>;
};

export type NullableObjectReturn<T extends z.ZodRawShape> = z.ZodObject<{
  [k in keyof T]: z.ZodNullable<T[k]>;
}>;

export const nullableObject = <T extends z.ZodRawShape>(
  obj: z.ZodObject<T>,
): NullableObjectReturn<T> => {
  const newShape = Object.fromEntries(
    Object.entries(obj.shape).map(([k, v]) => {
      const field = v as z.ZodTypeAny;
      return [k, field instanceof z.ZodNullable ? field : field.nullable()];
    }),
  ) as unknown as { [k in keyof T]: z.ZodNullable<T[k]> };

  return z.object(newShape);
};

export const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a valid numeric string");

export class ServerTimestampSentinel extends Date {
  constructor() {
    super();
  }
}

export const serverTimestampSentinel = (): Date => {
  return new ServerTimestampSentinel(); // typed as Date to callers
};

export const isServerTimestampSentinel = (d: unknown): d is ServerTimestampSentinel => {
  return d instanceof ServerTimestampSentinel;
};

export const getDateToday = (now = new Date()) => {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Regular expression matching standard BCP 47 locale formats
const localeRegex = /^[a-z]{2,4}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/;

/** validates a BCP 47 locale string, e.g. "en", "en-US", "zh-Hant-TW" */
export const localeSchema = z.string().regex(localeRegex, {
  message: "Invalid locale format (e.g., 'en', 'en-US', or 'zh-Hant-TW')",
});

/** true if `value` is a name Intl/ICU recognizes as a valid IANA time zone (e.g. "America/New_York", "UTC") */
export const isIanaTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** validates an IANA time zone name against the runtime's own ICU time zone database */
export const ianaTimeZoneSchema = z.string().refine(isIanaTimeZone, {
  error: "Invalid IANA time zone",
});
