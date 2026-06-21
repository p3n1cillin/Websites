/**
 * Industry landing-page content for the agency's own SEO (Empire SEO division).
 *
 * Each entry powers a real, indexable page at /websites/[slug] targeting
 * "website design for {trade}". Copy is DISTINCT per trade (no thin/duplicate
 * pages) so search engines treat each as genuine content. Pure data — zero deps,
 * zero tokens; consumed by app/(marketing)/websites.
 */

export interface ServicePage {
  slug: string;
  label: string; // singular, e.g. "Plumber"
  plural: string; // e.g. "Plumbers"
  headline: string;
  intro: string;
  painPoints: string[];
  outcomes: string[];
}

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "plumbers",
    label: "Plumber",
    plural: "Plumbers",
    headline: "Websites for plumbers that turn emergencies into booked jobs",
    intro:
      "When someone has a burst pipe at 9pm they search, tap the first credible result and call. If your site is slow, hard to call from a phone, or buried below competitors, that job goes to someone else. We build plumbing websites designed for exactly that moment.",
    painPoints: [
      "No tap-to-call button, so mobile customers can't reach you in one tap",
      "Slow or dated site that ranks below newer competitors",
      "No clear service list or coverage area, so visitors aren't sure you cover them",
      "No reviews on the page to prove you're trustworthy in an emergency",
    ],
    outcomes: [
      "One-tap calling and an enquiry form wired straight to your phone",
      "Local SEO so you show up for 'emergency plumber near me'",
      "Clear services, coverage towns and pricing guidance",
      "Real reviews front and centre to win the call",
    ],
  },
  {
    slug: "electricians",
    label: "Electrician",
    plural: "Electricians",
    headline: "Electrician websites that win local, high-value work",
    intro:
      "From rewires to EV chargers, the jobs worth winning start with a search. A clean, fast, trustworthy site that ranks locally is the difference between a full diary and a quiet week.",
    painPoints: [
      "No proof of certifications (NICEIC/Part P) to build instant trust",
      "Generic template that looks like every other trade site",
      "No quote form, so enquiries leak to competitors",
      "Invisible on Google for the services you actually want",
    ],
    outcomes: [
      "Trust badges and accreditations placed where they convert",
      "A quote/booking form that lands in your inbox instantly",
      "Local SEO targeting your highest-value services and towns",
      "Mobile-first design that loads fast on site",
    ],
  },
  {
    slug: "dentists",
    label: "Dentist",
    plural: "Dentists",
    headline: "Dental practice websites that fill the appointment book",
    intro:
      "New patients judge a practice by its website before they ever walk in. A modern, reassuring site with easy booking turns searches into registrations, and showcases the high-value treatments that grow the practice.",
    painPoints: [
      "Clunky or no online booking, so prospective patients bounce",
      "Treatments and prices hidden, creating friction and doubt",
      "Outdated design that undermines a premium, clinical impression",
      "Not ranking for 'dentist near me' or cosmetic treatment searches",
    ],
    outcomes: [
      "Frictionless enquiry/booking flow for new patients",
      "Clear treatment pages, including high-value cosmetic work",
      "A polished, trustworthy design that reflects your standards",
      "Local SEO + reviews to win the new-patient search",
    ],
  },
  {
    slug: "builders",
    label: "Builder",
    plural: "Builders",
    headline: "Builder & construction websites that showcase the work and win bids",
    intro:
      "Big jobs come from confidence. A portfolio-led site that proves quality and makes enquiring effortless turns browsers into quote requests for extensions, renovations and new builds.",
    painPoints: [
      "No project gallery, so quality is impossible to judge",
      "No clear way to request a quote for a specific job",
      "Weak local visibility for the areas you build in",
      "Nothing that separates you from cheaper, riskier competitors",
    ],
    outcomes: [
      "A project portfolio that sells your craftsmanship",
      "A detailed quote form that pre-qualifies enquiries",
      "Local SEO across every town you work in",
      "Trust signals: guarantees, accreditations, testimonials",
    ],
  },
  {
    slug: "hairdressers",
    label: "Salon",
    plural: "Hair & Beauty Salons",
    headline: "Salon websites that keep the chair full",
    intro:
      "Beauty is visual and bookings are impulsive. A stylish, mobile-first site with instant booking turns an Instagram glance or a quick search into a confirmed appointment.",
    painPoints: [
      "No online booking, so you lose late-night and impulse bookings",
      "Photos that don't do the work justice",
      "No service menu or pricing, creating hesitation",
      "Hard to find for 'hairdresser/salon near me'",
    ],
    outcomes: [
      "Easy online booking that captures impulse appointments",
      "A gallery and service menu that sell the experience",
      "A look that matches your brand, not a template",
      "Local SEO + reviews to fill quiet days",
    ],
  },
  {
    slug: "restaurants",
    label: "Restaurant",
    plural: "Restaurants & Cafés",
    headline: "Restaurant websites that drive bookings and orders",
    intro:
      "Diners decide in seconds from their phone. A fast site with the menu, photos and a clear way to book or order is the difference between a full service and empty tables.",
    painPoints: [
      "Menu trapped in a slow PDF or missing entirely",
      "No booking or order link where hungry visitors expect it",
      "Photos that don't make the food look worth the trip",
      "Invisible for 'restaurant near me' and your cuisine",
    ],
    outcomes: [
      "A fast, mobile menu plus clear book/order calls-to-action",
      "Appetising photography that converts",
      "Local SEO for your area and cuisine",
      "Reviews and opening hours built in",
    ],
  },
];

export function getServicePage(slug: string): ServicePage | undefined {
  return SERVICE_PAGES.find((s) => s.slug === slug);
}
