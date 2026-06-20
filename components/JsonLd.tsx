/**
 * Renders a JSON-LD <script> block. Server component — emitted into the static
 * HTML so search engines read structured data without executing JS.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Schema content is generated from trusted local data, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
