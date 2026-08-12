export type PathParams = Record<string, string>;

/** :param segment names in declaration order, e.g. "a/:b/c/:d" -> ["b", "d"] */
export const getPathParamNames = (template: string): string[] =>
  template
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => segment.slice(1));

/** last :param in the template is always the document id */
export const getDocIdParamName = (template: string): string => {
  const names = getPathParamNames(template);
  const last = names.at(-1);
  if (!last) throw new Error(`Collection template "${template}" has no :id segment`);
  return last;
};

export const resolveCollectionPath = (template: string, params: PathParams): string => {
  return template
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const name = segment.slice(1);
      const value = params[name];
      if (!value) throw new Error(`Missing path param "${name}" for template "${template}"`);
      return value;
    })
    .join("/");
};

export const resolveDocPath = (template: string, id: string, parentParams: PathParams = {}) => {
  const idParam = getDocIdParamName(template);
  return resolveCollectionPath(template, { ...parentParams, [idParam]: id });
};

/** the collection path without its trailing :id segment, e.g. "a/:b/c/:id" -> "a/:b/c" */
export const getCollectionTemplate = (template: string): string => {
  const idParam = getDocIdParamName(template);
  return template.slice(0, template.length - `:${idParam}`.length - 1);
};
