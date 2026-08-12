import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      "document.config": "src/document.config.ts",
      "document.mapping": "src/document.mapping.ts",
      "document.path": "src/document.path.ts",
      "model.registry": "src/model.registry.ts",
      "schema.utils": "src/schema.utils.ts",
    },
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
