#!/usr/bin/env node
/**
 * Scaffold a new Warrington business website from the command line.
 *
 *   node scripts/new-business.mjs "Aqua Flow Plumbing" plumber
 *
 * Creates lib/data/<slug>.ts pre-filled with a valid Business object and prints
 * the one line to add to lib/data/index.ts. Edit the generated file's details
 * and you have a complete, SEO-optimised website at /<slug> — no other code.
 */
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const [, , nameArg, categoryArg] = process.argv;

if (!nameArg) {
  console.error(
    'Usage: node scripts/new-business.mjs "Business Name" <category>\n' +
      "Categories: plumber, barber, restaurant, electrician, cleaner,\n" +
      "            landscaper, dentist, mechanic, beauty-salon, roofer"
  );
  process.exit(1);
}

const category = (categoryArg || "plumber").toLowerCase();
const name = nameArg.trim();

const slug =
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-warrington";

const constName = slug
  .replace(/-warrington$/, "")
  .replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const filePath = path.join("lib", "data", `${slug.replace(/-warrington$/, "")}.ts`);

if (existsSync(filePath)) {
  console.error(`✗ ${filePath} already exists. Choose a different name.`);
  process.exit(1);
}

const PRIMARY = {
  plumber: "Plumber",
  barber: "Barber",
  restaurant: "Restaurant",
  electrician: "Electrician",
  cleaner: "Cleaner",
  landscaper: "Landscaper",
  dentist: "Dentist",
  mechanic: "Mechanic",
  "beauty-salon": "Beauty Salon",
  roofer: "Roofer",
};
const primaryService = PRIMARY[category] || "Local Business";

const template = `import type { Business } from "../types";

export const ${constName}: Business = {
  slug: "${slug}",
  name: "${name}",
  category: "${category}",
  categoryLabel: "${primaryService} in Warrington",
  primaryService: "${primaryService}",
  tagline: "Trusted ${primaryService.toLowerCase()} serving Warrington and the surrounding areas.",
  about:
    "Add 1–2 paragraphs about ${name} here. Separate paragraphs with a blank line (\\\\n\\\\n). Mention experience, what makes you different, and the areas you cover.",
  established: ${new Date().getFullYear() - 5},
  phone: "01925 000 000",
  email: "hello@${slug.replace(/-warrington$/, "")}.co.uk",
  address: {
    line1: "1 Example Street",
    city: "Warrington",
    postcode: "WA1 1AA",
  },
  serviceAreas: [
    "Warrington Town Centre",
    "Stockton Heath",
    "Great Sankey",
    "Latchford",
  ],
  services: [
    {
      name: "Service One",
      description: "Benefit-led description of this service.",
      price: "From £00",
      icon: "star",
    },
    {
      name: "Service Two",
      description: "Benefit-led description of this service.",
      price: "Free quote",
      icon: "shield",
    },
    {
      name: "Service Three",
      description: "Benefit-led description of this service.",
      price: "From £00",
      icon: "sparkles",
    },
  ],
  openingHours: [
    { day: "Monday", hours: "09:00 – 17:00" },
    { day: "Tuesday", hours: "09:00 – 17:00" },
    { day: "Wednesday", hours: "09:00 – 17:00" },
    { day: "Thursday", hours: "09:00 – 17:00" },
    { day: "Friday", hours: "09:00 – 17:00" },
    { day: "Saturday", hours: "Closed" },
    { day: "Sunday", hours: "Closed" },
  ],
  testimonials: [
    {
      author: "Customer Name",
      rating: 5,
      location: "Warrington",
      quote: "Add a real customer testimonial here.",
    },
  ],
  rating: { value: 4.9, count: 50 },
  badges: ["Fully Insured", "Free Quotes", "Local & Trusted"],
  enableBooking: true,
};
`;

await writeFile(filePath, template, "utf8");

// Best-effort: remind the developer how to register it.
const indexPath = path.join("lib", "data", "index.ts");
let registerHint = "";
try {
  await readFile(indexPath, "utf8");
  registerHint =
    `\nNext, register it in ${indexPath}:\n` +
    `  import { ${constName} } from "./${slug.replace(/-warrington$/, "")}";\n` +
    `  // …then add \`${constName}\` to the LOCAL_BUSINESSES array.`;
} catch {
  /* index optional */
}

console.log(`✓ Created ${filePath}`);
console.log(`  Edit the details, then visit /${slug}`);
console.log(registerHint);
