import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildJoybuySignParameters,
  concatenateJoybuySignParameters,
  createJoybuySignature,
  serializeJoybuyBody,
} from "../sign";

/** Independent digest helpers for expected values (must match production algorithm). */
function expectedMd5(appSecret: string, concatenated: string): string {
  return createHash("md5")
    .update(appSecret + concatenated + appSecret, "utf8")
    .digest("hex")
    .toUpperCase();
}

function expectedHmac(algo: "sha256" | "md5", appSecret: string, concatenated: string): string {
  return createHmac(algo, appSecret).update(concatenated, "utf8").digest("hex").toUpperCase();
}

describe("Joybuy signature — parameter assembly", () => {
  it("sorts parameter names using ASCII order", () => {
    const parameters = {
      zebra: "z",
      Apple: "a",
      banana: "b",
      "X-JOS-App-Key": "k",
    };
    expect(concatenateJoybuySignParameters(parameters)).toBe(
      "AppleaX-JOS-App-Keykbananabzebraz",
    );
  });

  it("includes path and query parameters when present", () => {
    const parameters = buildJoybuySignParameters({
      appKey: "APP",
      accessToken: "TOK",
      timestamp: 1000,
      pathParams: { orderId: "123456" },
      queryParams: { scopeSet: "consigneeInfo,buyerRemark" },
    });
    expect(parameters.orderId).toBe("123456");
    expect(parameters.scopeSet).toBe("consigneeInfo,buyerRemark");
    expect(parameters["X-JOS-App-Key"]).toBe("APP");
    expect(parameters["X-JOS-Access-Token"]).toBe("TOK");
    expect(parameters["X-JOS-Timestamp"]).toBe("1000");
  });

  it("includes the exact body string under the empty parameter name", () => {
    const body = serializeJoybuyBody({ product: "Widget", quantity: 2 });
    const parameters = buildJoybuySignParameters({
      appKey: "APP",
      timestamp: 1,
      body,
    });
    expect(parameters[""]).toBe(body);
    expect(body).toBe('{"product":"Widget","quantity":2}');
  });

  it("omits body when empty or absent", () => {
    expect(
      buildJoybuySignParameters({ appKey: "APP", timestamp: 1, body: "" })[""],
    ).toBeUndefined();
    expect(
      buildJoybuySignParameters({ appKey: "APP", timestamp: 1, body: null })[""],
    ).toBeUndefined();
    expect(buildJoybuySignParameters({ appKey: "APP", timestamp: 1 })[""]).toBeUndefined();
  });

  it("omits access token when missing or empty", () => {
    const without = buildJoybuySignParameters({
      appKey: "APP",
      timestamp: 1,
      accessToken: null,
    });
    expect(without["X-JOS-Access-Token"]).toBeUndefined();

    const empty = buildJoybuySignParameters({
      appKey: "APP",
      timestamp: 1,
      accessToken: "",
    });
    expect(empty["X-JOS-Access-Token"]).toBeUndefined();
  });

  it("skips null/undefined/empty path and query values", () => {
    const parameters = buildJoybuySignParameters({
      appKey: "APP",
      timestamp: 1,
      pathParams: { keep: "1", drop: null, empty: "" },
      queryParams: { q: "yes", nope: undefined },
    });
    expect(parameters.keep).toBe("1");
    expect(parameters.q).toBe("yes");
    expect(parameters.drop).toBeUndefined();
    expect(parameters.empty).toBeUndefined();
    expect(parameters.nope).toBeUndefined();
  });
});

describe("Joybuy signature — digests", () => {
  const appSecret = "TESTSECRET";
  const base = {
    appKey: "APPKEY",
    accessToken: "TOKEN",
    timestamp: 1751545370000,
    appSecret,
  };

  it("produces uppercase MD5 signatures (default)", () => {
    const result = createJoybuySignature({ ...base, signMethod: "md5" });
    expect(result.signature).toBe(result.signature.toUpperCase());
    expect(result.signature).toMatch(/^[0-9A-F]+$/);
    expect(result.signature).toBe(
      expectedMd5(appSecret, result.concatenatedParameters),
    );
    expect(result.signMethod).toBe("md5");
  });

  it("produces uppercase HMAC-SHA256 signatures", () => {
    const result = createJoybuySignature({ ...base, signMethod: "hmacsha256" });
    expect(result.signature).toBe(result.signature.toUpperCase());
    expect(result.signature).toBe(
      expectedHmac("sha256", appSecret, result.concatenatedParameters),
    );
  });

  it("produces uppercase HMAC-MD5 signatures", () => {
    const result = createJoybuySignature({ ...base, signMethod: "hmacmd5" });
    expect(result.signature).toBe(result.signature.toUpperCase());
    expect(result.signature).toBe(
      expectedHmac("md5", appSecret, result.concatenatedParameters),
    );
  });

  it("defaults to MD5 when signMethod omitted", () => {
    const result = createJoybuySignature(base);
    expect(result.signMethod).toBe("md5");
    expect(result.signature).toBe(
      expectedMd5(appSecret, result.concatenatedParameters),
    );
  });
});

describe("Joybuy signature — official documentation fixture", () => {
  /**
   * Fixture values from Joybuy SP-API docs:
   * orderId, scopeSet, body, X-JOS-App-Key, X-JOS-Access-Token, X-JOS-Timestamp
   *
   * AppSecret is a test secret (docs do not publish a real secret).
   * Canonical string is derived from the algorithm description (name+value, ASCII sort,
   * no "$" separators). Body uses empty parameter name so the exact body string is signed.
   */
  const appKey = "123456";
  const accessToken = "TOKEN";
  const timestamp = 1751545370000;
  const orderId = "123456";
  const scopeSet = "consigneeInfo,buyerRemark";
  const body = '{"product":"Widget","quantity":2}';
  const appSecret = "APP_SECRET_FIXTURE";

  const expectedConcat =
    '{"product":"Widget","quantity":2}' +
    "X-JOS-Access-Token" +
    "TOKEN" +
    "X-JOS-App-Key" +
    "123456" +
    "X-JOS-Timestamp" +
    "1751545370000" +
    "orderId" +
    "123456" +
    "scopeSet" +
    "consigneeInfo,buyerRemark";

  it("builds the canonical concatenated parameter string without $ separators", () => {
    const parameters = buildJoybuySignParameters({
      appKey,
      accessToken,
      timestamp,
      pathParams: { orderId },
      queryParams: { scopeSet },
      body,
    });

    // Empty body key sorts first in ASCII.
    expect(Object.keys(parameters).sort()).toEqual([
      "",
      "X-JOS-Access-Token",
      "X-JOS-App-Key",
      "X-JOS-Timestamp",
      "orderId",
      "scopeSet",
    ]);

    const concatenated = concatenateJoybuySignParameters(parameters);
    expect(concatenated).toBe(expectedConcat);
    expect(concatenated.includes("$")).toBe(false);
  });

  it("matches independently calculated MD5 / HMAC signatures for the fixture", () => {
    const md5 = createJoybuySignature({
      appKey,
      accessToken,
      timestamp,
      pathParams: { orderId },
      queryParams: { scopeSet },
      body,
      appSecret,
      signMethod: "md5",
    });
    expect(md5.concatenatedParameters).toBe(expectedConcat);
    expect(md5.signature).toBe(expectedMd5(appSecret, expectedConcat));

    const sha = createJoybuySignature({
      appKey,
      accessToken,
      timestamp,
      pathParams: { orderId },
      queryParams: { scopeSet },
      body,
      appSecret,
      signMethod: "hmacsha256",
    });
    expect(sha.signature).toBe(expectedHmac("sha256", appSecret, expectedConcat));

    const hmacMd5 = createJoybuySignature({
      appKey,
      accessToken,
      timestamp,
      pathParams: { orderId },
      queryParams: { scopeSet },
      body,
      appSecret,
      signMethod: "hmacmd5",
    });
    expect(hmacMd5.signature).toBe(expectedHmac("md5", appSecret, expectedConcat));
  });

  it("uses compact JSON serialization identical to the fixture body", () => {
    expect(serializeJoybuyBody({ product: "Widget", quantity: 2 })).toBe(body);
  });
});

describe("Joybuy signature — body used for signing equals wire body", () => {
  it("keeps one serialized string for sign input and HTTP body", () => {
    const payload = { product: "Widget", quantity: 2, nested: { a: 1 } };
    const wireBody = serializeJoybuyBody(payload);
    const signed = createJoybuySignature({
      appKey: "K",
      accessToken: "T",
      timestamp: 42,
      body: wireBody,
      appSecret: "S",
    });
    expect(signed.parameters[""]).toBe(wireBody);
    expect(JSON.parse(wireBody)).toEqual(payload);
  });
});
