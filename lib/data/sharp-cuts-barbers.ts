import type { Business } from "../types";

export const sharpCutsBarbers: Business = {
  slug: "sharp-cuts-barbers-warrington",
  name: "Sharp Cuts Barbers",
  category: "barber",
  categoryLabel: "Traditional & Modern Barbershop",
  primaryService: "Barber",
  tagline: "Warrington's go-to barbershop for sharp fades, classic cuts and hot-towel shaves.",
  about:
    "Sharp Cuts is a modern barbershop in the heart of Warrington built on one idea: every client leaves looking and feeling their best. Our master barbers combine traditional techniques — straight-razor finishes and hot-towel shaves — with the latest styles and fades.\n\nWalk-ins are always welcome, but you can skip the wait by booking online. Great coffee, good chat and a proper attention to detail. That's the Sharp Cuts way.",
  established: 2016,
  phone: "01925 654 321",
  email: "bookings@sharpcutswarrington.co.uk",
  address: {
    line1: "48 Sankey Street",
    city: "Warrington",
    postcode: "WA1 1SB",
  },
  serviceAreas: [
    "Warrington Town Centre",
    "Bewsey",
    "Orford",
    "Westbrook",
    "Stockton Heath",
  ],
  services: [
    {
      name: "Skin Fade",
      description:
        "Precision fade tailored to your style, finished with a razor-sharp line-up.",
      price: "£18",
      icon: "scissors",
    },
    {
      name: "Classic Cut & Style",
      description:
        "A timeless cut, washed, styled and finished to perfection.",
      price: "£15",
      icon: "scissors",
    },
    {
      name: "Hot-Towel Shave",
      description:
        "Traditional straight-razor shave with hot towels and premium oils.",
      price: "£22",
      icon: "sparkles",
    },
    {
      name: "Beard Trim & Shape",
      description:
        "Sculpt and tidy your beard with clippers, scissors and a razor finish.",
      price: "£12",
      icon: "star",
    },
    {
      name: "Kids' Cut (under 12)",
      description:
        "Patient, friendly cuts for little ones in a relaxed chair.",
      price: "£11",
      icon: "scissors",
    },
    {
      name: "The Full Works",
      description:
        "Cut, hot-towel shave and beard shape — the complete grooming experience.",
      price: "£38",
      icon: "sparkles",
    },
  ],
  openingHours: [
    { day: "Monday", hours: "Closed" },
    { day: "Tuesday", hours: "09:00 – 18:00" },
    { day: "Wednesday", hours: "09:00 – 18:00" },
    { day: "Thursday", hours: "09:00 – 19:00" },
    { day: "Friday", hours: "09:00 – 19:00" },
    { day: "Saturday", hours: "08:00 – 17:00" },
    { day: "Sunday", hours: "10:00 – 14:00" },
  ],
  testimonials: [
    {
      author: "Tom B.",
      rating: 5,
      location: "Westbrook",
      quote:
        "Best fade in Warrington, hands down. The lads take their time and it always comes out perfect. Booking online makes it dead easy too.",
    },
    {
      author: "Aaron P.",
      rating: 5,
      location: "Orford",
      quote:
        "Proper old-school hot-towel shave with a modern finish. Relaxing, friendly and the result speaks for itself. My regular spot now.",
    },
    {
      author: "Michael K.",
      rating: 5,
      location: "Stockton Heath",
      quote:
        "Took my son for his first proper haircut and they were brilliant with him. Great atmosphere and a quality cut every time.",
    },
  ],
  rating: { value: 4.8, count: 342 },
  badges: ["Walk-Ins Welcome", "Online Booking", "Master Barbers", "Card & Cash"],
  brand: { primary: "#0f172a", accent: "#d4a23c" },
  enableBooking: true,
  geo: { lat: 53.3899, lng: -2.5972 },
};
