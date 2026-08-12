import type { DocumentConfigRegistry } from "./document.config.ts";
import { ServerTimestampSentinel } from "./schema.utils.ts";

type IsModel<ModelType extends string> = (value: unknown) => value is { _type: ModelType };

let _documentConfigRegistry: DocumentConfigRegistry<string> | null = null;
let _isModel: IsModel<string> | null = null;
let _applyServerTimestamp: (() => unknown) | null = null;
let _convertTimestamp: ((value: unknown) => Date | undefined) | null = null;

export const normalizeString = (str: string | null | undefined): string =>
  (str || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const configureDocumentMapping = <ModelType extends string>(
  registry: DocumentConfigRegistry<ModelType>,
  isModel: IsModel<ModelType>,
  applyServerTimestamp?: () => unknown,
  convertTimestamp?: (value: unknown) => Date | undefined,
) => {
  _documentConfigRegistry = registry;
  _isModel = isModel as IsModel<string>;
  _applyServerTimestamp = applyServerTimestamp || null;
  _convertTimestamp = convertTimestamp || null;
};

const getDocumentConfigRegistry = (): DocumentConfigRegistry<string> => {
  if (!_documentConfigRegistry) throw new Error("configureDocumentMapping() not called");
  return _documentConfigRegistry;
};

const getIsModel = (): IsModel<string> => {
  if (!_isModel) throw new Error("configureDocumentMapping() not called");
  return _isModel;
};

export const toDocData = <T = Record<string, any>>(
  data: T,
  modelType?: string,
): Record<string, any> => {
  const registry = getDocumentConfigRegistry();
  const isModel = getIsModel();

  const isConvertingModel = isModel(data);
  const documentConfig = isConvertingModel
    ? registry[data._type]
    : modelType
      ? registry[modelType]
      : undefined;

  const result = Object.entries(data as Record<string, any>).reduce(
    (result, [key, value]) => {
      if (typeof value === "undefined" || (isConvertingModel && key === "_type")) return result;

      if (value instanceof ServerTimestampSentinel) {
        result[key] = _applyServerTimestamp ? _applyServerTimestamp() : value;
      } else if (isModel(value)) {
        result[key] = toDocData(value); // no explicit registry arg needed
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => (isModel(item) ? toDocData(item) : item));
      } else if (
        documentConfig?.data[key]?.cast === "json_string" &&
        typeof value === "object" &&
        value !== null
      ) {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = value;
      }
      return result;
    },
    {} as Record<string, any>,
  );

  if (documentConfig) {
    for (const [key, fieldConfig] of Object.entries(documentConfig.data)) {
      const sourceKey = fieldConfig?.normalization_of;
      if (!sourceKey) continue;
      const sourceValue = (data as Record<string, any>)[sourceKey as string];
      if (typeof sourceValue === "undefined") continue;
      result[key] = normalizeString(sourceValue);
    }
  }

  return result;
};

export const fromDocData = <T = Record<string, any>>(
  pathParams: Record<string, string>,
  rawData: Record<string, any>,
  modelType?: string,
): T => {
  const registry = getDocumentConfigRegistry();

  const documentConfig = modelType ? registry[modelType] : undefined;

  const mapped = Object.entries(rawData).reduce(
    (result, [key, value]) => {
      const converted = _convertTimestamp?.(value);
      if (converted !== undefined) {
        result[key] = converted;
      } else if (
        documentConfig?.data?.[key as keyof T]?.cast === "json_string" &&
        typeof value === "string"
      ) {
        result[key] = JSON.parse(value);
      } else {
        result[key] = value;
      }
      return result;
    },
    {} as Record<string, any>,
  );

  // auto-sync: only overwrite `data` fields whose name matches a path param
  Object.entries(pathParams).forEach(([key, value]) => {
    if (key in mapped || (documentConfig?.data && key in documentConfig.data)) mapped[key] = value;
  });

  if (modelType) mapped._type = modelType;

  return mapped as T;
};
