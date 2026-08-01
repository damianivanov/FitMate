import { useEffect } from "react";
import { useLocation } from "react-router";
import { legalSections } from "./content";
import type { LegalSubsection } from "./content";

function Subsection({ subsection }: { subsection: LegalSubsection }) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground">{subsection.heading}</h3>

      {subsection.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed text-secondary">
          {paragraph}
        </p>
      ))}

      {subsection.bullets && (
        <ul className="space-y-2 pl-5">
          {subsection.bullets.map((bullet) => (
            <li key={bullet} className="list-disc text-sm leading-relaxed text-secondary">
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {subsection.table && (
        <div className="liquid-scrollbar overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
            <thead>
              <tr>
                {subsection.table.columns.map((column) => (
                  <th
                    key={column}
                    className="border-b border-current/10 px-3 py-2 font-semibold text-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subsection.table.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell) => (
                    <td
                      key={cell}
                      className="border-b border-current/5 px-3 py-2 align-top text-secondary"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Legal() {
  const { hash } = useLocation();

  // Anchor links land here from the cookie banner and footer, but the target
  // section only exists after this page renders.
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="w-full p-6 md:pt-10 min-[1920px]:mx-auto min-[1920px]:w-[75%]">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header>
          {/* Kept for the document outline: the sections below are h2s and need a page-level
              heading above them, but nothing needs to be drawn. */}
          <h1 className="sr-only">Legal</h1>

          <nav aria-label="Legal sections" className="flex flex-wrap gap-2">
            {legalSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="liquid-pill rounded-full px-4 py-2 text-xs font-semibold"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </header>

        {legalSections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="liquid-surface scroll-mt-6 space-y-6 rounded-3xl px-5 py-6 md:px-7"
          >
            <h2 className="text-xl font-bold text-foreground">{section.title}</h2>

            <div className="space-y-6">
              {section.subsections.map((subsection) => (
                <Subsection key={subsection.heading} subsection={subsection} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
