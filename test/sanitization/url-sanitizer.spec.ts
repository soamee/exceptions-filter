import {
  getUrlPathname,
  MALFORMED_URL_PLACEHOLDER,
  sanitizeUrl,
} from "../../src/sanitization";

describe("sanitizeUrl", () => {
  it("sanitizes relative URLs and preserves repeated and encoded parameters", () => {
    expect(
      sanitizeUrl("/search?q=hello%20world&token=one&TOKEN=two&next=%2Fhome"),
    ).toBe(
      "/search?q=hello+world&token=******&TOKEN=******&next=%2Fhome",
    );
  });

  it("preserves absolute URL components and redacts common key variants", () => {
    expect(
      sanitizeUrl(
        "https://example.com:8443/path?access_token=a&api-key=b&safe=c#part",
      ),
    ).toBe(
      "https://example.com:8443/path?access_token=******&api-key=******&safe=c#part",
    );
  });

  it("supports extra fields and returns a safe value for malformed URLs", () => {
    expect(sanitizeUrl("/path?private=value", ["private"])).toBe(
      "/path?private=******",
    );
    expect(sanitizeUrl("http://[invalid?token=secret")).toBe(
      MALFORMED_URL_PLACEHOLDER,
    );
  });

  it("extracts only the pathname", () => {
    expect(getUrlPathname("/path/to?a=secret#fragment")).toBe("/path/to");
    expect(getUrlPathname("http://[invalid?token=secret")).toBe(
      MALFORMED_URL_PLACEHOLDER,
    );
  });
});
