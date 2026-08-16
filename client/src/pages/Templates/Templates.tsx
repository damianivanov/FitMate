import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  LuDumbbell,
  LuLoaderCircle,
  LuPencil,
  LuPlay,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import {
  ActionMenu,
  AsyncSection,
  DeleteConfirmationModal,
  NativePage,
  NativeSearch,
  PageBody,
  PageIntro,
  type ActionMenuItem,
  type NativeTint,
} from "@/shared/components";
import { getTemplateExerciseSummary } from "./utils/templateDisplay";
import { useTemplatesPage } from "./hooks/useTemplatesPage";
import type { WorkoutTemplate } from "@/types";
import "./templates.css";

/** Stable per template, so a card keeps its colour between visits instead of reshuffling. */
const CARD_TINTS: NativeTint[] = ["orange", "purple", "blue", "green", "cyan", "pink"];

function tintFor(template: WorkoutTemplate): NativeTint {
  return CARD_TINTS[template.id % CARD_TINTS.length];
}

function metaFor(template: WorkoutTemplate): string {
  return [
    `${template.exerciseCount} exercise${template.exerciseCount === 1 ? "" : "s"}`,
    template.setCount > 0 ? `${template.setCount} sets` : null,
    template.estimatedDurationMinutes ? `~${template.estimatedDurationMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function Templates() {
  const { state, actions } = useTemplatesPage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const visibleTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return state.templates;
    }

    return state.templates.filter((template) =>
      template.name.toLowerCase().includes(normalizedQuery),
    );
  }, [query, state.templates]);

  const buildMenu = (template: WorkoutTemplate): ActionMenuItem[] => [
    {
      key: "start",
      label: state.startingTemplateId === template.id ? "Starting…" : "Start workout",
      icon:
        state.startingTemplateId === template.id ? (
          <LuLoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <LuPlay className="h-4 w-4 shrink-0" />
        ),
      onSelect: () => actions.start(template.id),
      variant: "primary",
      disabled: state.startingTemplateId !== null,
    },
    {
      key: "edit",
      label: "Edit template",
      icon: <LuPencil className="h-4 w-4 shrink-0" />,
      onSelect: () => actions.edit(template.id),
    },
    {
      key: "delete",
      label: "Delete",
      icon:
        state.deletingTemplateId === template.id ? (
          <LuLoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <LuTrash2 className="h-4 w-4 shrink-0" />
        ),
      onSelect: () => actions.requestDelete(template),
      variant: "danger",
      disabled: state.deletingTemplateId !== null,
    },
  ];

  return (
    <>
      <PageBody>
        <NativePage className="tp-page">
          <PageIntro
            eyebrow="Reusable workouts"
            title="Templates"
            action={
              <button
                type="button"
                onClick={actions.create}
                className="app-round-btn liquid-press"
                aria-label="New template"
              >
                <LuPlus className="h-5 w-5" />
              </button>
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading templates..."
            isEmpty={state.templates.length === 0}
            emptyState={
              <button type="button" className="tp-card tp-new" onClick={actions.create}>
                <span>
                  <LuPlus className="h-6 w-6" />
                </span>
                <b>Create a template</b>
                <small>Build a reusable training day you can start in one tap</small>
              </button>
            }
          >
            <NativeSearch
              value={query}
              onChange={setQuery}
              placeholder="Search templates"
              label="Search templates"
            />

            <div className="tp-grid">
              {visibleTemplates.map((template) => (
                <article className="tp-card" key={template.id}>
                  <button
                    type="button"
                    className="tp-card-open"
                    onClick={() => navigate(`/templates/view/${template.id}`)}
                  >
                    <span className={`native-glyph native-glyph-lg tint-${tintFor(template)}`}>
                      <LuDumbbell className="h-5 w-5" />
                    </span>
                    <span className="tp-card-copy">
                      <b>{template.name}</b>
                      <small>{getTemplateExerciseSummary(template)}</small>
                    </span>
                    <em>{metaFor(template)}</em>
                  </button>

                  <ActionMenu
                    triggerAriaLabel={`${template.name} actions`}
                    items={buildMenu(template)}
                  />
                </article>
              ))}

              {visibleTemplates.length === 0 ? (
                <p className="tp-empty">No templates match “{query.trim()}”.</p>
              ) : (
                <button type="button" className="tp-card tp-new" onClick={actions.create}>
                  <span>
                    <LuPlus className="h-6 w-6" />
                  </span>
                  <b>Create a template</b>
                  <small>Build a reusable training day</small>
                </button>
              )}
            </div>
          </AsyncSection>
        </NativePage>
      </PageBody>

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={state.templatePendingDeleteName}
        title="Delete template"
        isDeleting={state.deletingTemplateId !== null}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
