import type { Business } from "@/lib/types";
import { Section, Container, Heading } from "@/components/site/primitives";

/**
 * Menu / price list for food businesses (restaurants, cafés, takeaways). Renders
 * only when `business.menu` is populated by the Industry Profiler. Token-themed.
 */
export default function Menu({ business }: { business: Business }) {
  const menu = business.menu;
  if (!menu?.sections?.length) return null;
  return (
    <Section tone="surface">
      <Container className="max-w-3xl">
        <Heading className="text-3xl sm:text-4xl">{menu.heading ?? "Our menu"}</Heading>
        <div className="mt-8 space-y-10">
          {menu.sections.map((sec) => (
            <div key={sec.name}>
              <h3 className="text-xl font-bold text-brand">{sec.name}</h3>
              <ul className="mt-4 space-y-3">
                {sec.items.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-baseline justify-between gap-4 border-b border-dashed border-[rgb(var(--border))] pb-2"
                  >
                    <div>
                      <p className="font-medium text-[rgb(var(--ink))]">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-[rgb(var(--ink-muted))]">{item.description}</p>
                      )}
                    </div>
                    {item.price && (
                      <span className="shrink-0 font-semibold text-[rgb(var(--ink))]">{item.price}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
