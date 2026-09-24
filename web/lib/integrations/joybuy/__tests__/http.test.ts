import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJoybuySignature, serializeJoybuyBody } from "../sign";

/**
 * HTTP-layer behaviour tests that avoid importing server-only modules.
 * They verify the contract joybuyRequest uses: same body string for sign + fetch.
 */

describe("Joybuy HTTP signing contract", () => {
  it("signs with the identical compact body string that would be sent", () => {
    const bodyObject = { sku: "ABC", quantity: 3 };
    const requestBody = serializeJoybuyBody(bodyObject);

    const signed = createJoybuySignature({
      appKey: "key",
      accessToken: "token",
      timestamp: 1751545370000,
      pathParams: { orderId: "9" },
      queryParams: { scopeSet: "a,b" },
      body: requestBody,
      appSecret: "secret",
      signMethod: "md5",
    });

    expect(signed.parameters[""]).toBe(requestBody);

    const expected = createHash("md5")
      .update("secret" + signed.concatenatedParameters + "secret", "utf8")
      .digest("hex")
      .toUpperCase();
    expect(signed.signature).toBe(expected);
  });

  it("does not put site/currency/language into the signature parameter set", () => {
    const signed = createJoybuySignature({
      appKey: "key",
      accessToken: "token",
      timestamp: 1,
      appSecret: "secret",
    });
    expect(signed.parameters["X-JOS-site"]).toBeUndefined();
    expect(signed.parameters["X-JOS-currency"]).toBeUndefined();
    expect(signed.parameters["X-JOS-language"]).toBeUndefined();
    expect(signed.parameters["X-JOS-Request-Identity"]).toBeUndefined();
    expect(signed.parameters["X-JOS-Request-BizId"]).toBeUndefined();
    expect(signed.parameters["X-JOS-timeZone"]).toBeUndefined();
  });
});

describe("Joybuy HTTP header contract (simulated)", () => {
  function buildHeaders(input: {
    appKey: string;
    accessToken?: string | null;
    timestamp: number;
    signature: string;
    signMethod: "md5" | "hmacsha256" | "hmacmd5";
    site?: string;
    currency?: string;
    language?: string;
    timeZone?: string | null;
    requestBizId?: string | null;
  }) {
    const headers: Record<string, string> = {
      "X-JOS-App-Key": input.appKey,
      "X-JOS-Timestamp": String(input.timestamp),
      "X-JOS-Sign": input.signature,
      "X-JOS-Content-Type": "application/json; charset=utf-8",
      "X-JOS-Request-Identity": "vender",
    };
    if (input.accessToken) headers["X-JOS-Access-Token"] = input.accessToken;
    if (input.signMethod !== "md5") headers["X-JOS-Sign-Method"] = input.signMethod;
    if (input.site) headers["X-JOS-site"] = input.site;
    if (input.currency) headers["X-JOS-currency"] = input.currency;
    if (input.language) headers["X-JOS-language"] = input.language;
    if (input.timeZone) headers["X-JOS-timeZone"] = input.timeZone;
    if (input.requestBizId) headers["X-JOS-Request-BizId"] = input.requestBizId;
    return headers;
  }

  it("omits X-JOS-Sign-Method for default MD5", () => {
    const signed = createJoybuySignature({
      appKey: "k",
      accessToken: "t",
      timestamp: 1,
      appSecret: "s",
      signMethod: "md5",
    });
    const headers = buildHeaders({
      appKey: "k",
      accessToken: "t",
      timestamp: 1,
      signature: signed.signature,
      signMethod: "md5",
      site: "UK-Site",
      currency: "GBP",
      language: "en_GB",
    });
    expect(headers["X-JOS-Sign-Method"]).toBeUndefined();
    expect(headers["X-JOS-site"]).toBe("UK-Site");
    expect(headers["X-JOS-currency"]).toBe("GBP");
    expect(headers["X-JOS-language"]).toBe("en_GB");
    expect(headers["X-JOS-timeZone"]).toBeUndefined();
    expect(headers["X-JOS-Request-BizId"]).toBeUndefined();
  });

  it("sets X-JOS-Sign-Method for hmacsha256 and hmacmd5", () => {
    for (const signMethod of ["hmacsha256", "hmacmd5"] as const) {
      const signed = createJoybuySignature({
        appKey: "k",
        accessToken: "t",
        timestamp: 1,
        appSecret: "s",
        signMethod,
      });
      const headers = buildHeaders({
        appKey: "k",
        accessToken: "t",
        timestamp: 1,
        signature: signed.signature,
        signMethod,
      });
      expect(headers["X-JOS-Sign-Method"]).toBe(signMethod);
    }
  });

  it("omits access token header when token is absent", () => {
    const signed = createJoybuySignature({
      appKey: "k",
      timestamp: 1,
      appSecret: "s",
    });
    const headers = buildHeaders({
      appKey: "k",
      accessToken: null,
      timestamp: 1,
      signature: signed.signature,
      signMethod: "md5",
    });
    expect(headers["X-JOS-Access-Token"]).toBeUndefined();
  });
});

describe("Joybuy HTTP request mock (fetch)", () => {
  const keys = [
    "JOYBUY_APP_KEY",
    "JOYBUY_APP_SECRET",
    "JOYBUY_ACCESS_TOKEN",
    "JOYBUY_API_BASE_URL",
    "JOYBUY_CALLBACK_URL",
    "JOYBUY_SITE",
    "JOYBUY_CURRENCY",
    "JOYBUY_LANGUAGE",
    "JOYBUY_TIMEZONE",
    "JOYBUY_REQUEST_BIZ_ID",
    "JOYBUY_SIGN_METHOD",
  ] as const;

  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
    process.env.JOYBUY_APP_KEY = "test-app-key";
    process.env.JOYBUY_APP_SECRET = "test-app-secret";
    process.env.JOYBUY_ACCESS_TOKEN = "test-access-token";
    process.env.JOYBUY_API_BASE_URL = "https://api-pre.joybuy.com/rest";
  });

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
    vi.resetModules();
  });

  it("sends the same serialized body that was signed", async () => {
    const { joybuyRequest } = await import("../http");
    const bodyObject = { product: "Widget", quantity: 2 };
    const expectedBody = serializeJoybuyBody(bodyObject);
    const expectedSign = createJoybuySignature({
      appKey: "test-app-key",
      accessToken: "test-access-token",
      timestamp: 1751545370000,
      pathParams: { orderId: "123456" },
      queryParams: { scopeSet: "consigneeInfo,buyerRemark" },
      body: expectedBody,
      appSecret: "test-app-secret",
      signMethod: "md5",
    });

    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { url: String(input), init: init ?? {} };
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await joybuyRequest({
      method: "POST",
      path: "/order/{orderId}",
      pathParams: { orderId: "123456" },
      queryParams: { scopeSet: "consigneeInfo,buyerRemark" },
      body: bodyObject,
      timestampMs: 1751545370000,
      fetchImpl,
    });

    expect(result.requestBody).toBe(expectedBody);
    expect(result.signature).toBe(expectedSign.signature);
    expect(captured).not.toBeNull();
    expect(captured!.init.body).toBe(expectedBody);
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers["X-JOS-Sign"]).toBe(expectedSign.signature);
    expect(headers["X-JOS-App-Key"]).toBe("test-app-key");
    expect(headers["X-JOS-Access-Token"]).toBe("test-access-token");
    expect(headers["X-JOS-Timestamp"]).toBe("1751545370000");
    expect(headers["X-JOS-Content-Type"]).toBe("application/json; charset=utf-8");
    expect(headers["X-JOS-Request-Identity"]).toBe("vender");
    expect(headers["X-JOS-Sign-Method"]).toBeUndefined();
    expect(headers["X-JOS-site"]).toBe("UK-Site");
    expect(headers["X-JOS-currency"]).toBe("GBP");
    expect(headers["X-JOS-language"]).toBe("en_GB");
    expect(captured!.url).toContain("https://api-pre.joybuy.com/rest/order/123456");
    expect(captured!.url).toContain("scopeSet=consigneeInfo%2CbuyerRemark");
  });

  it("parses Joybuy errorList into JoybuyApiError", async () => {
    const { joybuyRequest } = await import("../http");
    const { JoybuyApiError } = await import("../errors");

    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          errorList: [{ code: "E001", message: "Bad request", details: "sku missing" }],
          data: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await expect(
      joybuyRequest({
        method: "GET",
        path: "/ping",
        timestampMs: 1,
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: "JoybuyApiError",
      joybuyCode: "E001",
      details: "sku missing",
      httpStatus: 200,
    } satisfies Partial<InstanceType<typeof JoybuyApiError>>);
  });
});
