import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEmail, extractPhone } from "@/lib/audit";

test("pulls a mailto: address from the homepage", () => {
  const html = `<a href="mailto:info@theshop.co.uk">Email us</a>`;
  assert.equal(extractEmail(html), "info@theshop.co.uk");
});

test("filters junk (sentry/example/image assets)", () => {
  const html = `<img src="logo@2x.png"> tracking@sentry.io noreply@example.com`;
  assert.equal(extractEmail(html), null);
});

test("prefers an address on the business's own domain", () => {
  const html = `contact someone@gmail.com and hello@theshop.co.uk`;
  assert.equal(extractEmail(html, "www.theshop.co.uk"), "hello@theshop.co.uk");
});

test("returns null when there's no real email", () => {
  assert.equal(extractEmail("<p>call us on 01925 123456</p>"), null);
});

test("finds a plain-text email when no mailto is present", () => {
  assert.equal(extractEmail("Reach us at bookings@salon.com today"), "bookings@salon.com");
});

test("pulls a phone from a tel: link", () => {
  assert.equal(extractPhone(`<a href="tel:01925 123456">Call</a>`), "01925 123456");
});

test("finds a UK phone in plain text", () => {
  assert.equal(extractPhone("Call us on 020 7946 0958 anytime"), "020 7946 0958");
});

test("ignores numbers that aren't phone numbers", () => {
  assert.equal(extractPhone("<p>VAT 1234 · order 5</p>"), null);
});
