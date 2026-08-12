import { expect, test } from "vite-plus/test";
import {
  getCollectionTemplate,
  getDocIdParamName,
  getPathParamNames,
  resolveCollectionPath,
  resolveDocPath,
} from "../src/document.path.ts";

test("getPathParamNames extracts :param segment names in order", () => {
  expect(getPathParamNames("organizations/:organization_id/billing_settings/:id")).toEqual([
    "organization_id",
    "id",
  ]);
});

test("getPathParamNames returns an empty array when there are no params", () => {
  expect(getPathParamNames("accounts")).toEqual([]);
});

test("getDocIdParamName returns the last :param name", () => {
  expect(getDocIdParamName("organizations/:organization_id/billing_settings/:id")).toBe("id");
  expect(getDocIdParamName("accounts/:id")).toBe("id");
});

test("getDocIdParamName throws when the template has no :param segment", () => {
  expect(() => getDocIdParamName("accounts")).toThrow();
});

test("resolveCollectionPath substitutes every :param segment", () => {
  expect(
    resolveCollectionPath("organizations/:organization_id/billing_settings/:id", {
      organization_id: "org1",
      id: "doc1",
    }),
  ).toBe("organizations/org1/billing_settings/doc1");
});

test("resolveCollectionPath leaves static segments untouched", () => {
  expect(resolveCollectionPath("accounts/:id", { id: "abc" })).toBe("accounts/abc");
});

test("resolveCollectionPath throws when a required param is missing", () => {
  expect(() => resolveCollectionPath("accounts/:id", {})).toThrow();
});

test("resolveDocPath fills in the id param and any parent params", () => {
  expect(resolveDocPath("accounts/:id", "abc")).toBe("accounts/abc");
  expect(
    resolveDocPath("organizations/:organization_id/billing_settings/:id", "doc1", {
      organization_id: "org1",
    }),
  ).toBe("organizations/org1/billing_settings/doc1");
});

test("getCollectionTemplate strips the trailing :id segment", () => {
  expect(getCollectionTemplate("accounts/:id")).toBe("accounts");
  expect(getCollectionTemplate("organizations/:organization_id/billing_settings/:id")).toBe(
    "organizations/:organization_id/billing_settings",
  );
});
