import {
  DRAFT_STORAGE_KEYS,
  clearDraftStorage,
  loadDraftStorage,
  saveDraftStorage,
} from "@/lib/draftStorage";
import type { TemplateDraft } from "@/pages/TemplateBuilder/utils/templateDraft";

// Bump when the persisted draft shape changes in a non-backwards-compatible way.
const TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION = 3;
const TEMPLATE_BUILDER_DRAFT_STORAGE_KEY = DRAFT_STORAGE_KEYS.templateBuilder;

export function loadTemplateBuilderDraft(): TemplateDraft | null {
  return loadDraftStorage<TemplateDraft>({
    key: TEMPLATE_BUILDER_DRAFT_STORAGE_KEY,
    version: TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION,
  });
}

export function saveTemplateBuilderDraft(draft: TemplateDraft): boolean {
  return saveDraftStorage(
    TEMPLATE_BUILDER_DRAFT_STORAGE_KEY,
    draft,
    TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION,
  );
}

export function clearTemplateBuilderDraft(): void {
  clearDraftStorage(TEMPLATE_BUILDER_DRAFT_STORAGE_KEY);
}
