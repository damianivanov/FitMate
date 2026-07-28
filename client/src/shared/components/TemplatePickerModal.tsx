import { useEffect, useMemo, useState } from "react";
import { LuClock, LuDumbbell, LuLoaderCircle, LuSearch } from "react-icons/lu";
import { unwrap } from "@/lib/unwrap";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import type { WorkoutTemplateModel } from "@/types";
import { Modal } from "./Modal";

type TemplatePickerModalProps = {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (template: WorkoutTemplateModel) => void;
};

export function TemplatePickerModal({
  isOpen,
  title = "Choose a workout template",
  onClose,
  onSelect,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<WorkoutTemplateModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen || templates !== null) {
      return;
    }

    let cancelled = false;

    async function loadTemplates() {
      setError(null);
      try {
        const response = await workoutTemplateService.list();
        if (!cancelled) {
          setTemplates(unwrap(response.data, "Unable to load templates."));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load templates.");
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [isOpen, templates]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const all = templates ?? [];
    if (!normalizedQuery) {
      return all;
    }

    return all.filter((template) => template.name.toLowerCase().includes(normalizedQuery));
  }, [templates, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="lg">
      <div className="flex max-h-[70vh] flex-col gap-3 p-5">
        <label className="liquid-input flex items-center gap-2 rounded-full px-3 py-2.5">
          <LuSearch className="h-4 w-4 shrink-0 text-muted" />
          <span className="sr-only">Search templates</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates..."
            className="w-full bg-transparent text-sm outline-none"
            autoFocus
          />
        </label>

        {error ? (
          <p className="py-6 text-center text-sm text-danger">{error}</p>
        ) : templates === null ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-secondary">
            <LuLoaderCircle className="h-4 w-4 animate-spin" />
            Loading templates...
          </p>
        ) : filteredTemplates.length === 0 ? (
          <p className="py-6 text-center text-sm text-secondary">
            {templates.length === 0
              ? "No templates yet — create one on the Templates page first."
              : "No templates match your search."}
          </p>
        ) : (
          <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template)}
                className="liquid-panel flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-200 hover:border-primary-300/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {template.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-3 text-xs text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <LuDumbbell className="h-3.5 w-3.5 text-primary" />
                      {template.exerciseCount} exercise{template.exerciseCount === 1 ? "" : "s"}
                    </span>
                    {template.estimatedDurationMinutes ? (
                      <span className="inline-flex items-center gap-1">
                        <LuClock className="h-3.5 w-3.5 text-primary" />
                        {template.estimatedDurationMinutes} min
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
