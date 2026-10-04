import { describe, expect, test } from "vitest";
import { resetEmail, resetLink, SITE, welcomeEmail } from "../../supabase/functions/_shared/account-emails";

describe("the welcome email", () => {
  const email = welcomeEmail(5);

  test("leads with the step new keepers haven't taken: a first plant", () => {
    // Both of the first two sign-ups stopped at an empty greenhouse.
    expect(email.text.indexOf("Add your first plant")).toBeLessThan(email.text.indexOf("Tap the drop"));
    expect(email.html).toContain(`href="${SITE}"`);
  });

  test("states the photo allowance it was given, and drops it when there is none", () => {
    expect(email.text).toContain("five AI photo checks");
    expect(welcomeEmail(1).text).toContain("one AI photo check.");
    expect(welcomeEmail(0).text).not.toMatch(/photo check/);
    expect(welcomeEmail(0).text).not.toMatch(/doing\. \n/);
  });

  test("promises nothing the app doesn't do", () => {
    // Reminders are calendar entries, not push notifications, and there is
    // no price to quote.
    expect(email.text).not.toMatch(/notification|push|\$|price|premium|trial/i);
  });

  test("says how to get it removed if the address was used by someone else", () => {
    // Sign-up does not confirm the address, so this can reach a stranger.
    expect(email.text).toContain("If that wasn't you, reply and we'll remove it.");
  });

  test("carries no tracking pixel or remote image", () => {
    expect(email.html).not.toMatch(/<img/i);
  });
});

describe("the password reset email", () => {
  const email = resetEmail("keeper@example.com", "abc123");

  test("links to the front page with the token, so any build can open it", () => {
    expect(resetLink("abc123")).toBe("https://plantparlour.org/?reset=abc123");
    expect(email.html).toContain('href="https://plantparlour.org/?reset=abc123"');
    expect(email.text).toContain("https://plantparlour.org/?reset=abc123");
  });

  test("a token can't break out of the link", () => {
    expect(resetLink('a"b&c d')).toBe("https://plantparlour.org/?reset=a%22b%26c%20d");
  });

  test("names the account and tells someone who didn't ask what to do", () => {
    expect(email.text).toContain("keeper@example.com");
    expect(email.text).toContain("If you didn't ask for this, you can ignore it.");
  });

  test("an address is escaped, not rendered", () => {
    expect(resetEmail("<b>x</b>@example.com", "t").html).toContain("&lt;b&gt;x&lt;/b&gt;@example.com");
  });
});
