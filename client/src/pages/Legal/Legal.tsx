import { useEffect } from "react";
import { useLocation } from "react-router";
import { LuFileText } from "react-icons/lu";
import { NativeCard, NativeGlyph, NativePage, PageBody, PageIntro } from "@/shared/components";
import { legalSections } from "./content";
import type { LegalSubsection } from "./content";
import "./legal.css";

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
          <table className="lg-table">
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
    <PageBody>
      <NativePage>
        <PageIntro eyebrow="Terms and privacy" title="Legal" />

        <nav aria-label="Legal sections" className="lg-jump">
          {legalSections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              <NativeGlyph tint="blue">
                <LuFileText className="h-4 w-4" />
              </NativeGlyph>
              {section.title}
            </a>
          ))}
        </nav>

        {legalSections.map((section) => (
          <NativeCard key={section.id} className="lg-doc">
            <section id={section.id}>
              <h2>{section.title}</h2>

              <div className="lg-body">
                {section.subsections.map((subsection) => (
                  <Subsection key={subsection.heading} subsection={subsection} />
                ))}
              </div>
            </section>
          </NativeCard>
        ))}
      </NativePage>
    </PageBody>
  );
}
