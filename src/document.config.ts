export type FieldConfig<T> = {
  auto_update_on?: "create" | "update" | "write" | "delete";
  cast?: "json_string";
  normalization_of?: keyof T;
};

export type DocumentConfig<T> = {
  collections: string[];
  data: Partial<Record<keyof T, FieldConfig<T>>>;
};

export type DocumentConfigRegistry<ModelType extends string = string> = Partial<
  Record<ModelType, DocumentConfig<any>>
>;
