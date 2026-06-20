import type { Business } from "../types";

export const elitePlumbing: Business = {
  slug: "elite-plumbing-warrington",
  name: "Elite Plumbing & Heating",
  category: "plumber",
  categoryLabel: "Emergency Plumber & Heating Engineer",
  primaryService: "Plumber",
  tagline: "Fast, reliable plumbing across Warrington — 24/7 emergency call-outs.",
  about:
    "Elite Plumbing & Heating has kept Warrington homes and businesses running for over 15 years. From burst pipes and blocked drains to full boiler installations, our Gas Safe registered engineers deliver honest pricing and workmanship you can trust. We're a local, family-run team — when you call, you speak to a real Warrington plumber, not a national call centre.\n\nWe cover the whole of Warrington and surrounding areas, with no call-out charge for quotes and a 12-month guarantee on all installations.",
  established: 2009,
  phone: "01925 123 456",
  email: "hello@eliteplumbingwarrington.co.uk",
  address: {
    line1: "12 Bridge Street",
    city: "Warrington",
    postcode: "WA1 2RU",
  },
  serviceAreas: [
    "Warrington Town Centre",
    "Stockton Heath",
    "Great Sankey",
    "Latchford",
    "Lymm",
    "Padgate",
  ],
  services: [
    {
      name: "Emergency Plumbing",
      description:
        "Burst pipes, leaks and no hot water sorted fast — 24/7 across Warrington.",
      price: "From £75",
      icon: "wrench",
    },
    {
      name: "Boiler Installation",
      description:
        "A-rated boilers supplied and fitted by Gas Safe engineers, with a 10-year warranty.",
      price: "From £1,800",
      icon: "flame",
    },
    {
      name: "Boiler Servicing & Repair",
      description:
        "Annual servicing and same-day repairs to keep your heating safe and efficient.",
      price: "From £69",
      icon: "shield",
    },
    {
      name: "Bathroom Installation",
      description:
        "Complete bathroom design and fitting — from a new shower to a full refurbishment.",
      price: "Free quote",
      icon: "sparkles",
    },
    {
      name: "Blocked Drains",
      description:
        "Fast drain unblocking and CCTV surveys for stubborn blockages.",
      price: "From £85",
      icon: "wrench",
    },
    {
      name: "Radiators & Underfloor Heating",
      description:
        "Upgrades, power-flushing and new installations to warm your whole home.",
      price: "Free quote",
      icon: "flame",
    },
  ],
  openingHours: [
    { day: "Monday", hours: "07:00 – 18:00" },
    { day: "Tuesday", hours: "07:00 – 18:00" },
    { day: "Wednesday", hours: "07:00 – 18:00" },
    { day: "Thursday", hours: "07:00 – 18:00" },
    { day: "Friday", hours: "07:00 – 18:00" },
    { day: "Saturday", hours: "08:00 – 16:00" },
    { day: "Sunday", hours: "Emergency call-outs only" },
  ],
  testimonials: [
    {
      author: "Sarah M.",
      rating: 5,
      location: "Stockton Heath",
      quote:
        "Called at 9pm with a burst pipe and they were here within the hour. Polite, tidy and fixed it for a fair price. Wouldn't use anyone else now.",
    },
    {
      author: "David R.",
      rating: 5,
      location: "Great Sankey",
      quote:
        "New boiler fitted in a single day with no mess. The quote was the price I paid — no surprises. Highly recommend to anyone in Warrington.",
    },
    {
      author: "Joanne T.",
      rating: 5,
      location: "Latchford",
      quote:
        "Fantastic from start to finish. They talked me through every option and never tried to upsell. Genuinely trustworthy local plumbers.",
    },
  ],
  rating: { value: 4.9, count: 187 },
  badges: ["Gas Safe Registered", "12-Month Guarantee", "No Call-Out Fee", "DBS Checked"],
  enableBooking: true,
  geo: { lat: 53.3905, lng: -2.5955 },
};
