import type { Business } from "../types";

export const oliveTreeKitchen: Business = {
  slug: "olive-tree-kitchen-warrington",
  name: "The Olive Tree Kitchen",
  category: "restaurant",
  categoryLabel: "Mediterranean Restaurant",
  primaryService: "Restaurant",
  tagline: "Fresh Mediterranean dining in the heart of Warrington — book your table tonight.",
  about:
    "The Olive Tree Kitchen brings the warmth of the Mediterranean to Warrington. Every dish is made from scratch using seasonal ingredients, with mezze to share, charcoal-grilled mains and a hand-picked wine list.\n\nWhether it's a relaxed family dinner, a date night or a celebration, our team makes every visit special. Book a table online, order takeaway, or join us for our popular weekend brunch.",
  established: 2018,
  phone: "01925 778 899",
  email: "reservations@olivetreewarrington.co.uk",
  address: {
    line1: "5 Horsemarket Street",
    city: "Warrington",
    postcode: "WA1 1XL",
  },
  serviceAreas: [
    "Warrington Town Centre",
    "Stockton Heath",
    "Grappenhall",
    "Lymm",
    "Appleton",
  ],
  services: [
    {
      name: "À La Carte Dining",
      description:
        "Charcoal-grilled mains, fresh seafood and vegetarian dishes made to order.",
      price: "Mains from £14",
      icon: "star",
    },
    {
      name: "Mezze Sharing Platters",
      description:
        "A spread of hot and cold mezze, perfect for the table to share.",
      price: "From £9",
      icon: "sparkles",
    },
    {
      name: "Weekend Brunch",
      description:
        "Mediterranean brunch served every Saturday and Sunday until 2pm.",
      price: "From £11",
      icon: "flame",
    },
    {
      name: "Private Events & Functions",
      description:
        "Birthdays, celebrations and corporate dining catered for up to 60 guests.",
      price: "Bespoke menus",
      icon: "shield",
    },
    {
      name: "Takeaway & Collection",
      description:
        "Your favourite dishes to enjoy at home — order ahead for collection.",
      price: "Menu prices",
      icon: "leaf",
    },
    {
      name: "Set Lunch Menu",
      description:
        "Two or three courses at a fixed price, served Monday to Friday.",
      price: "£16 / £19",
      icon: "star",
    },
  ],
  openingHours: [
    { day: "Monday", hours: "Closed" },
    { day: "Tuesday", hours: "12:00 – 22:00" },
    { day: "Wednesday", hours: "12:00 – 22:00" },
    { day: "Thursday", hours: "12:00 – 22:00" },
    { day: "Friday", hours: "12:00 – 23:00" },
    { day: "Saturday", hours: "10:00 – 23:00" },
    { day: "Sunday", hours: "10:00 – 21:00" },
  ],
  testimonials: [
    {
      author: "Emma L.",
      rating: 5,
      location: "Grappenhall",
      quote:
        "Honestly the best food in Warrington. The mezze is incredible and the staff make you feel so welcome. Our new go-to for date night.",
    },
    {
      author: "James W.",
      rating: 5,
      location: "Lymm",
      quote:
        "Booked for a birthday of 12 and they looked after us beautifully. Fresh, flavourful food and a lovely atmosphere. Can't fault it.",
    },
    {
      author: "Priya S.",
      rating: 4,
      location: "Appleton",
      quote:
        "Gorgeous weekend brunch and great value set lunch. Always busy but the booking system makes getting a table easy.",
    },
  ],
  rating: { value: 4.7, count: 521 },
  badges: ["Table Booking", "Takeaway Available", "Vegetarian & Vegan Options", "Licensed Bar"],
  brand: { primary: "#3f6212", accent: "#c2410c" },
  enableBooking: true,
  geo: { lat: 53.3912, lng: -2.5949 },
};
