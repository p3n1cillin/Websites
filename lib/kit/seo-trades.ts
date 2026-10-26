/**
 * Programmatic SEO trade definitions for the Map Pack Kit digital product.
 *
 * Each trade gets a high-ranking landing page at /map-pack-kit/[trade] targeting
 * searches like "Google Business Profile posts for plumbers UK", "Google Business
 * description template electrician", etc.
 */

export interface TradeDefinition {
  slug: string;
  singular: string;
  plural: string;
  headline: string;
  subheading: string;
  typicalServices: string[];
  keySeasonality: string;
  samplePost: {
    title: string;
    body: string;
    type: string;
    cta: string;
  };
}

export const SEO_TRADES: TradeDefinition[] = [
  {
    slug: "plumbers",
    singular: "Plumber",
    plural: "Plumbers",
    headline: "Google Business Profile Kit for UK Plumbers & Heating Engineers",
    subheading: "52 weekly posts, review request templates, and profile optimisation tailored for local plumbing and heating businesses.",
    typicalServices: ["Emergency leak repairs", "Boiler servicing", "Radiator replacement", "Power flushing", "Bathroom installations"],
    keySeasonality: "Autumn boiler health checks, winter burst pipes, spring bathroom renovations.",
    samplePost: {
      title: "Hearing banging pipes or cold radiators?",
      type: "Helpful Tip",
      body: "If your radiators are cold at the bottom or making clunking noises, sludge buildup in your central heating could be pushing your boiler harder than needed. A quick power flush or radiator balance can cut your energy bills and prevent sudden winter breakdowns.",
      cta: "Call now",
    },
  },
  {
    slug: "electricians",
    singular: "Electrician",
    plural: "Electricians",
    headline: "Google Business Profile Kit for UK Electricians",
    subheading: "A full year of dated weekly posts, 5-star review request scripts, and Google Maps SEO for local electrical contractors.",
    typicalServices: ["EV home charger installation", "Consumer unit (fuse box) upgrades", "Full & partial rewires", "EICR landlord certificates", "Garden & security lighting"],
    keySeasonality: "Spring outdoor lighting, summer air conditioning feeds, autumn EV charger installs, winter security lighting.",
    samplePost: {
      title: "Thinking of installing a home EV charger?",
      type: "Service Spotlight",
      body: "Charging your electric vehicle overnight on a dedicated 7kW home charger is up to three times faster than a standard 3-pin plug. We conduct full fuse board checks and handle all DNO notifications before fitting.",
      cta: "Get quote",
    },
  },
  {
    slug: "roofers",
    singular: "Roofer",
    plural: "Roofers",
    headline: "Google Business Profile Kit for UK Roofers & Roofing Contractors",
    subheading: "52 weeks of post copy, seasonal storm check prompts, and review reply scripts built specifically for roofers.",
    typicalServices: ["Slate & tile roof repairs", "EPDM flat roofing", "Chimney repointing", "Dry verge & ridge systems", "Fascias, soffits & guttering"],
    keySeasonality: "Autumn storm damage prep, winter emergency leak fixes, spring re-roofs, summer flat roof replacements.",
    samplePost: {
      title: "Notice any slipped tiles after recent high winds?",
      type: "Inspection Advice",
      body: "A single displaced tile or damaged flashing can allow rainwater into your roof rafters, turning a £100 repair into a £2,000 ceiling plaster fix. We offer fast visual inspections and fixed written quotes before any work begins.",
      cta: "Call now",
    },
  },
  {
    slug: "builders",
    singular: "Builder",
    plural: "Builders",
    headline: "Google Business Profile Kit for UK Builders & Extension Specialists",
    subheading: "Keep your Google profile active with project spotlights, extension advice, and review request scripts that win bids.",
    typicalServices: ["Single & double storey extensions", "Garage conversions", "Structural wall knock-throughs", "Renovations & structural repairs"],
    keySeasonality: "Spring planning & groundworks, summer build phases, autumn weathertight finishes, winter interior conversions.",
    samplePost: {
      title: "Planning an open-plan kitchen-diner this year?",
      type: "Project Tip",
      body: "Knocking through an internal load-bearing wall to create a modern open-plan living space requires steel RSJ calculations and building control sign-off. Here is how our team manages the structural process from day one.",
      cta: "Learn more",
    },
  },
  {
    slug: "landscapers",
    singular: "Landscaper",
    plural: "Landscapers",
    headline: "Google Business Profile Kit for UK Landscapers & Paving Specialists",
    subheading: "Transform searches into booked patio and garden projects with a full year of seasonal Google posts.",
    typicalServices: ["Porcelain & sandstone patios", "Block paving driveways", "Composite decking", "Artificial grass installation", "Timber fencing & gates"],
    keySeasonality: "Late winter design bookings, spring turfing & patio builds, summer maintenance, autumn drainage & paving.",
    samplePost: {
      title: "Why porcelain paving is replacing traditional stone",
      type: "Material Spotlight",
      body: "Porcelain paving is virtually non-porous, meaning moss and algae cannot root into the surface. A simple pressure rinse once a season keeps it looking brand new without harsh chemical scrubbing.",
      cta: "Get offer",
    },
  },
  {
    slug: "painters",
    singular: "Painter & Decorator",
    plural: "Painters & Decorators",
    headline: "Google Business Profile Kit for UK Painters & Decorators",
    subheading: "52 weekly posts showcasing surface prep, interior finishes, and review generation scripts for decorators.",
    typicalServices: ["Interior room decorating", "Exterior masonry painting", "Woodwork restoration", "Feature wallpaper hanging", "Commercial decorating"],
    keySeasonality: "Spring/summer exterior masonry, autumn/winter interior living rooms and hallway refreshes before Christmas.",
    samplePost: {
      title: "80% of a flawless paint finish happens before the tin opens",
      type: "Behind the Scenes",
      body: "Proper surface preparation—filling hairline settling cracks, sanding with dustless extraction, and applying quality primers—is what prevents peeling and gives that crisp, razor-sharp edge along the skirting.",
      cta: "Book visit",
    },
  },
  {
    slug: "locksmiths",
    singular: "Locksmith",
    plural: "Locksmiths",
    headline: "Google Business Profile Kit for UK Locksmiths",
    subheading: "Dominate high-intent emergency lock searches and secure local commercial work with our tailored Google kit.",
    typicalServices: ["Emergency lockout entry", "Anti-snap cylinder upgrades", "uPVC door gearbox repairs", "Commercial master key systems", "Burglary repair"],
    keySeasonality: "Consistent all year with winter dark evenings driving domestic lock upgrades.",
    samplePost: {
      title: "Are your external doors fitted with 3-star anti-snap cylinders?",
      type: "Home Security",
      body: "Standard euro cylinders can be snapped by intruders in under 15 seconds. Upgrading to British Standard TS007 3-star anti-snap locks stops lock-snapping instantly and satisfies insurer requirements.",
      cta: "Call now",
    },
  },
  {
    slug: "cleaners",
    singular: "Cleaner",
    plural: "Cleaners",
    headline: "Google Business Profile Kit for UK Cleaning Companies",
    subheading: "Keep residential and commercial cleaning leads flowing with weekly seasonal posts and review workflows.",
    typicalServices: ["Deep end-of-tenancy cleans", "Regular domestic cleaning", "Commercial office cleaning", "Carpet & upholstery extraction", "Oven cleaning"],
    keySeasonality: "Spring deep cleans, summer student tenancy turnarounds, autumn back-to-school, pre-Christmas party cleans.",
    samplePost: {
      title: "Moving home? Guarantee your tenancy deposit return",
      type: "Service Spotlight",
      body: "Our comprehensive end-of-tenancy deep clean follows standard letting agent inventory checklists, including inside oven degreasing, skirting board wiping, and bathroom descaling.",
      cta: "Get quote",
    },
  },
  {
    slug: "joiners",
    singular: "Joiner & Carpenter",
    plural: "Joiners & Carpenters",
    headline: "Google Business Profile Kit for UK Joiners & Carpenters",
    subheading: "52 weekly posts highlighting bespoke alcove units, door hanging, kitchens, and architectural woodwork.",
    typicalServices: ["Fitted alcove wardrobes", "Internal door hanging", "Kitchen fitting", "Bespoke storage units", "Staircase refurbishment"],
    keySeasonality: "Autumn fitted wardrobes before winter, spring kitchen renovations, year-round custom storage.",
    samplePost: {
      title: "Maximising awkward chimney breast alcoves",
      type: "Craft Spotlight",
      body: "Victorian and modern homes alike often lose valuable floor space to alcoves. Bespoke fitted cabinetry with integrated shelving and cable concealment creates seamless storage that flatpack furniture cannot match.",
      cta: "Learn more",
    },
  },
  {
    slug: "gas-engineers",
    singular: "Gas Engineer",
    plural: "Gas Engineers",
    headline: "Google Business Profile Kit for UK Gas Engineers",
    subheading: "Attract annual boiler service bookings and high-margin boiler installations through an active Google Map Pack profile.",
    typicalServices: ["Boiler installations", "Annual gas safety certificates (CP12)", "Boiler breakdown diagnosis", "Radiator smart valve fitting", "Cooker installations"],
    keySeasonality: "Autumn servicing rush, winter emergency breakdown calls, spring/summer planned system upgrades.",
    samplePost: {
      title: "Why an annual boiler service pays for itself",
      type: "Money-Saving Tip",
      body: "A clean burner and balanced flue combustion ensure your boiler converts gas into heat at maximum efficiency. Catching minor seal degradation or pressure drops early avoids costly mid-winter emergency callouts.",
      cta: "Call now",
    },
  },
];

export function getTradeBySlug(slug: string): TradeDefinition | undefined {
  return SEO_TRADES.find((t) => t.slug === slug);
}

export function findTradeForCategory(category?: string | null): TradeDefinition | undefined {
  if (!category) return undefined;
  const c = category.toLowerCase().trim();
  return SEO_TRADES.find((t) => {
    const sing = t.singular.toLowerCase();
    const plur = t.plural.toLowerCase();
    const stem = sing.slice(0, 4);
    return (
      t.slug === c ||
      sing === c ||
      plur === c ||
      c.includes(sing) ||
      c.includes(plur) ||
      t.slug.includes(c) ||
      (stem.length >= 4 && c.includes(stem))
    );
  });
}
