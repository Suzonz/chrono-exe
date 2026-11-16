import { globToRegExp, hostOf, matchesGlob, matchesUrl, sanitizeUrl, siteLabel } from "@/lib/glob";

describe("matchesGlob", () => {
  it("matches subdomains and the bare domain with a leading *.", () => {
    expect(matchesGlob("api.github.com", "*.github.com")).toBe(true);
    expect(matchesGlob("github.com", "*.github.com")).toBe(true);
    expect(matchesGlob("notgithub.com", "*.github.com")).toBe(false);
  });

  it("supports ports and ? wildcards", () => {
    expect(globToRegExp("localhost:*").test("localhost:3000")).toBe(true);
    expect(matchesGlob("localhost:5173", "localhost:51?3")).toBe(true);
  });

  it("is case-insensitive and escapes regex characters", () => {
    expect(matchesGlob("WWW.Example.COM", "www.example.com")).toBe(true);
    expect(matchesGlob("wwwxexample.com", "www.example.com")).toBe(false);
  });
});

describe("matchesUrl", () => {
  it.each([
    ["https://github.com/vercel/next.js", "*.github.com", true],
    ["https://gist.github.com/someone", "*.github.com", true],
    ["http://localhost:3000/settings", "localhost:*", true],
    ["http://localhost:3000/", "localhost:3000", true],
    ["https://www.notion.so/workspace", "*notion.so*", true],
    ["https://mail.google.com/mail/u/0/", "mail.google.com", true],
    ["https://www.google.fr/search?q=x", "*.google.*", true],
    ["https://github.com/my-org/repo", "github.com/my-org/*", true],
    ["https://github.com/other/repo", "github.com/my-org/*", false],
    ["https://stackoverflow.com/questions/1", "https://stackoverflow.com/*", true],
    ["https://youtube.com.evil.io/", "*.youtube.com", false]
  ])("%s ~ %s → %s", (url, pattern, expected) => {
    expect(matchesUrl(url, pattern)).toBe(expected);
  });

  it("never matches an empty pattern", () => {
    expect(matchesUrl("https://example.com", "  ")).toBe(false);
  });
});

describe("hostOf", () => {
  it("returns the host without www and keeps the port", () => {
    expect(hostOf("https://www.github.com/a")).toBe("github.com");
    expect(hostOf("http://localhost:5173/")).toBe("localhost:5173");
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("privacy and labels", () => {
  it("drops query strings and fragments", () => {
    expect(sanitizeUrl("https://mail.google.com/mail/u/0/?token=abc#inbox")).toBe("https://mail.google.com/mail/u/0/");
    expect(sanitizeUrl("chrono://outside.chrome")).toBe("chrono://outside.chrome");
  });

  it("names special hosts", () => {
    expect(siteLabel("outside.chrome")).toBe("Outside Chrome");
    expect(siteLabel("github.com")).toBe("github.com");
  });
});
