import test from "node:test";
import assert from "node:assert/strict";
import { parseKitInput, toMetadata, TIERS } from "../lib/kit/catalog";
import { nextMonday, scheduleFor, sanitize } from "../lib/kit/content";
import { SEO_TRADES, getTradeBySlug } from "../lib/kit/seo-trades";

test("parseKitInput validates required fields", () => {
  const bad = parseKitInput({});
  assert.equal(bad.ok, false);
  assert.match(bad.error!, /business name/i);

  const missingTrade = parseKitInput({ businessName: "Acme Ltd" });
  assert.equal(missingTrade.ok, false);
  assert.match(missingTrade.error!, /trade/i);

  const missingTown = parseKitInput({ businessName: "Acme Ltd", trade: "Plumber" });
  assert.equal(missingTown.ok, false);
  assert.match(missingTown.error!, /town/i);

  const missingServices = parseKitInput({ businessName: "Acme Ltd", trade: "Plumber", town: "Warrington" });
  assert.equal(missingServices.ok, false);
  assert.match(missingServices.error!, /service/i);

  const good = parseKitInput({
    businessName: "Acme Plumbing",
    trade: "Plumber",
    town: "Warrington",
    services: "Boiler servicing, leaks",
    reviewLink: "https://g.page/r/test/review",
    website: "acmeplumbing.co.uk",
  });
  assert.equal(good.ok, true);
  assert.equal(good.input?.businessName, "Acme Plumbing");
  assert.equal(good.input?.website, "https://acmeplumbing.co.uk");
  assert.equal(good.input?.tone, "friendly");
});

test("toMetadata serialises fields within Stripe limits", () => {
  const parsed = parseKitInput({
    businessName: "Hartley Plumbing",
    trade: "Plumber",
    town: "Warrington",
    services: "Boilers, bathrooms",
  });
  assert.equal(parsed.ok, true);
  const md = toMetadata(parsed.input!, "complete");
  assert.equal(md.kind, "map_pack_kit");
  assert.equal(md.tier, "complete");
  assert.equal(md.businessName, "Hartley Plumbing");
  assert.ok(Object.keys(md).length <= 50, "Stripe allows max 50 keys");
  for (const val of Object.values(md)) {
    assert.ok(val.length <= 500, "Stripe allows max 500 chars per value");
  }
});

test("nextMonday always returns a Monday (UTC)", () => {
  // A Friday: 2026-10-09
  const fri = new Date(Date.UTC(2026, 9, 9));
  const m1 = nextMonday(fri);
  assert.equal(m1.getUTCDay(), 1, "Should be Monday");
  assert.equal(m1.getUTCDate(), 12);

  // Already a Monday: 2026-10-12
  const m2 = nextMonday(m1);
  assert.equal(m2.getUTCDay(), 1);
  assert.equal(m2.getUTCDate(), 12);
});

test("scheduleFor returns exact date count", () => {
  const d = new Date(Date.UTC(2026, 9, 7));
  const monthly = scheduleFor("posts_monthly", d);
  assert.equal(monthly.length, 12);

  const q1 = scheduleFor("posts_q1", d);
  assert.equal(q1.length, 13);

  const q4 = scheduleFor("posts_q4", d);
  assert.equal(q4.length, 13);
});

test("sanitize cleans em-dashes and strips emoji", () => {
  const raw = "Top quality work—fast service – guaranteed 😊👍";
  const cleaned = sanitize(raw);
  assert.equal(cleaned.includes("—"), false);
  assert.equal(cleaned.includes("😊"), false);
  assert.equal(cleaned.includes("👍"), false);
  assert.equal(cleaned, "Top quality work, fast service - guaranteed ");
});

test("SEO_TRADES has unique slugs and definitions", () => {
  const slugs = new Set<string>();
  for (const t of SEO_TRADES) {
    assert.ok(!slugs.has(t.slug), `Duplicate slug: ${t.slug}`);
    slugs.add(t.slug);
    assert.ok(t.typicalServices.length >= 3);
    assert.ok(t.samplePost.title.length > 5);
  }
  const plumber = getTradeBySlug("plumbers");
  assert.ok(plumber);
  assert.equal(plumber.singular, "Plumber");
});

test("findTradeForCategory matches singular, plural, and partial trade names", () => {
  const { findTradeForCategory } = require("../lib/kit/seo-trades");
  const t1 = findTradeForCategory("plumber");
  assert.equal(t1?.slug, "plumbers");

  const t2 = findTradeForCategory("electrician");
  assert.equal(t2?.slug, "electricians");

  const t3 = findTradeForCategory("roofing contractor");
  assert.equal(t3?.slug, "roofers");

  const tNone = findTradeForCategory("accountant");
  assert.equal(tNone, undefined);
});
