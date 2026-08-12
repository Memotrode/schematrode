# @memotrode/schematrode

Generic Zod model-schema helpers: `createModelRegistry` (typed `_type`
registry plus `isModel`/`toJson`/`fromJson`), domain-agnostic `schema.utils` (enum
helpers, ID generation, derived-field helpers, etc), and document-store mapping helpers
(`document.config`, `document.mapping`, `document.path`) for converting between models
and Firestore-shaped documents.

Contains no knowledge of any project's concrete models or document configs - bring
your own Zod schemas and wire them into `createModelRegistry`/`configureDocumentMapping`.

## Development

- Install dependencies:

```bash
vp install
```

- Run the unit tests:

```bash
vp test
```

- Build the library:

```bash
vp pack
```
