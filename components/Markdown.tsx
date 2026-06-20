import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Minimal Markdown renderer for the SEO engine's generated article bodies.
 *
 * The content is produced by lib/seo-automation.ts (trusted, not user input), so
 * this only needs to cover what the generator emits: `##`/`###` headings, `-`
 * bullet lists, blank-line-separated paragraphs, `**bold**` and `[text](href)`
 * links. Output is real React nodes — no dangerouslySetInnerHTML — and internal
 * links use next/link for client-side navigation.
 *
 * Keeping this in-house avoids pulling a Markdown/MDX dependency into a codebase
 * that is otherwise deliberately zero-dependency for content.
 */

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(INLINE).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={key}>{bold[1]}</strong>;

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const internal = href.startsWith("/");
      return internal ? (
        <Link key={key} href={href} className="font-medium text-brand hover:underline">
          {label}
        </Link>
      ) : (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand hover:underline"
        >
          {label}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const key = `p-${blocks.length}`;
    blocks.push(
      <p key={key} className="leading-relaxed text-gray-700">
        {renderInline(para.join(" "), key)}
      </p>
    );
    para = [];
  };

  const flushList = () => {
    if (!list.length) return;
    const key = `ul-${blocks.length}`;
    blocks.push(
      <ul key={key} className="ml-1 space-y-2">
        {list.map((item, i) => (
          <li key={`${key}-${i}`} className="flex gap-2.5 text-gray-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            <span>{renderInline(item, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushPara();
      flushList();
      const key = `h2-${blocks.length}`;
      blocks.push(
        <h2 key={key} className="mt-10 text-2xl font-extrabold tracking-tight text-gray-900">
          {renderInline(line.slice(3), key)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushPara();
      flushList();
      const key = `h3-${blocks.length}`;
      blocks.push(
        <h3 key={key} className="mt-8 text-xl font-bold text-gray-900">
          {renderInline(line.slice(4), key)}
        </h3>
      );
    } else if (line.startsWith("- ")) {
      flushPara();
      list.push(line.slice(2));
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-5">{blocks}</div>;
}
