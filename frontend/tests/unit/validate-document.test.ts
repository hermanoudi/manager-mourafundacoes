import { describe, expect, it } from "vitest";

import { isValidDocument } from "@/lib/documents";

describe("isValidDocument", () => {
  it.each(["529.982.247-25", "11.222.333/0001-81", "12.ABC.345/01DE-35", "12abc34501de35"])(
    "aceita %s",
    (d) => expect(isValidDocument(d)).toBe(true),
  );
  it.each(["111.111.111-11", "529.982.247-24", "00.000.000/0000-00", "11.222.333/0001-82", "12345", ""])(
    "rejeita %s",
    (d) => expect(isValidDocument(d)).toBe(false),
  );
});
