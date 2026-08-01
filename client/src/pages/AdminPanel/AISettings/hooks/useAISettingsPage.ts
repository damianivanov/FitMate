import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { AISettingsModel, SaveAISettingsRequest } from "@/types";

export type AISettingsFormValues = SaveAISettingsRequest;

function toFormValues(settings: AISettingsModel): AISettingsFormValues {
  return {
    defaultModel: settings.defaultModel,
    fastModel: settings.fastModel,
    reasoningModel: settings.reasoningModel,
    visionModel: settings.visionModel,
    imageModel: settings.imageModel,
    timeoutSeconds: settings.timeoutSeconds,
    maximumToolIterations: settings.maximumToolIterations,
    maximumToolCallsPerRun: settings.maximumToolCallsPerRun,
    maximumConversationMessages: settings.maximumConversationMessages,
    maximumContextTokens: settings.maximumContextTokens,
    maximumOutputTokens: settings.maximumOutputTokens,
    maximumMessageCharacters: settings.maximumMessageCharacters,
    storeRawProviderPayload: settings.storeRawProviderPayload,
  };
}

export function useAISettingsPage() {
  const [settings, setSettings] = useState<AISettingsModel | null>(null);
  const [values, setValues] = useState<AISettingsFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.ai.settings();
        const loaded = unwrap(response.data, "Unable to load AI settings.");
        setSettings(loaded);
        setValues(toFormValues(loaded));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load AI settings.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const changeField = useCallback(
    <TKey extends keyof AISettingsFormValues>(key: TKey, value: AISettingsFormValues[TKey]) => {
      setValues((current) => (current ? { ...current, [key]: value } : current));
      setSavedAt(null);
    },
    [],
  );

  const save = useCallback(async () => {
    if (!values) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await adminService.ai.saveSettings(values);
      const saved = unwrap(response.data, "Unable to save AI settings.");
      setSettings(saved);
      setValues(toFormValues(saved));
      setSavedAt(Date.now());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save AI settings.");
    } finally {
      setIsSaving(false);
    }
  }, [values]);

  return {
    state: { settings, values, isLoading, isSaving, error, savedAt },
    actions: { changeField, save },
  };
}
