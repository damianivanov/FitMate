import { Dropdown, PageBody, PageHeader } from "@/shared/components";
import type { AISettingsFormValues } from "./hooks/useAISettingsPage";
import { useAISettingsPage } from "./hooks/useAISettingsPage";

type NumberFieldProps = {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
};

function NumberField({ label, hint, value, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="liquid-input rounded-xl px-3 py-2.5"
      />
      {hint ? <span className="text-xs text-tertiary">{hint}</span> : null}
    </label>
  );
}

type TextFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
};

function TextField({ label, hint, value, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="liquid-input rounded-xl px-3 py-2.5"
      />
      {hint ? <span className="text-xs text-tertiary">{hint}</span> : null}
    </label>
  );
}

type ModelFieldProps = TextFieldProps & {
  options: string[];
};

function ModelField({ label, hint, value, options, onChange }: ModelFieldProps) {
  // No list means the provider is unconfigured or unreachable — fall back to free text rather
  // than leaving an empty picker the admin cannot use.
  if (options.length === 0) {
    return <TextField label={label} hint={hint} value={value} onChange={onChange} />;
  }

  // A previously saved model may since have been retired. Keep it in the list so simply opening
  // this page never silently rewrites what is stored.
  const choices = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <Dropdown
      label={label}
      helperText={hint}
      searchable
      searchPlaceholder="Search models..."
      clearable
      placeholder="Not set"
      value={value || null}
      options={choices.map((option) => ({ label: option, value: option }))}
      onChange={(next) => onChange(next ?? "")}
    />
  );
}

export default function AISettings() {
  const { state, actions } = useAISettingsPage();
  const { settings, values } = state;

  const setNumber = (key: keyof AISettingsFormValues) => (value: number) =>
    actions.changeField(key, value as never);

  const setText = (key: keyof AISettingsFormValues) => (value: string) =>
    actions.changeField(key, value as never);

  return (
    <>
      <PageHeader
        title="AI Settings"
        subtitle="Global defaults for the coach. Per-plan ceilings live on each subscription plan."
      />

      <PageBody>
        {state.error ? <p className="mb-4 text-sm text-danger">{state.error}</p> : null}

        {state.isLoading || !values || !settings ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : (
          <div className="space-y-5">
            {!settings.isStored ? (
              <div className="liquid-surface rounded-3xl p-4 text-sm text-secondary">
                No settings have been saved yet, so these are the values the app was deployed with.
                Saving stores them in the database and they take effect without a redeploy.
              </div>
            ) : null}

            <section className="liquid-surface rounded-3xl p-5 md:p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Models</h2>
              <p className="mb-2 text-xs text-tertiary">
                Provider is <span className="font-semibold">{settings.provider}</span>, set in
                configuration — it selects the adapter at startup and cannot be changed here.
              </p>
              <p className="mb-4 text-xs text-tertiary">
                {state.availableModels.length > 0
                  ? `${state.availableModels.length} models available on this account.`
                  : "Model list unavailable — check the provider API key. You can still type an id."}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <ModelField
                  label="Default model"
                  hint="Used by every plan without its own tier."
                  options={state.availableModels}
                  value={values.defaultModel}
                  onChange={setText("defaultModel")}
                />
                <ModelField
                  label="Fast model"
                  hint="Used by plans on the Fast tier."
                  options={state.availableModels}
                  value={values.fastModel}
                  onChange={setText("fastModel")}
                />
                <ModelField
                  label="Reasoning model"
                  hint="Used by plans on the Reasoning tier."
                  options={state.availableModels}
                  value={values.reasoningModel}
                  onChange={setText("reasoningModel")}
                />
                <ModelField
                  label="Vision model"
                  options={state.availableModels}
                  value={values.visionModel}
                  onChange={setText("visionModel")}
                />
                <ModelField
                  label="Image model"
                  options={state.availableModels}
                  value={values.imageModel}
                  onChange={setText("imageModel")}
                />
              </div>
            </section>

            <section className="liquid-surface rounded-3xl p-5 md:p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Limits</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Max context tokens"
                  hint="Hard ceiling. A plan may ask for less, never more."
                  value={values.maximumContextTokens}
                  onChange={setNumber("maximumContextTokens")}
                />
                <NumberField
                  label="Max output tokens"
                  hint="Caps the length of a single reply."
                  value={values.maximumOutputTokens}
                  onChange={setNumber("maximumOutputTokens")}
                />
                <NumberField
                  label="Max conversation messages"
                  hint="History window before trimming."
                  value={values.maximumConversationMessages}
                  onChange={setNumber("maximumConversationMessages")}
                />
                <NumberField
                  label="Max message characters"
                  hint="A single message longer than this is refused."
                  value={values.maximumMessageCharacters}
                  onChange={setNumber("maximumMessageCharacters")}
                />
                <NumberField
                  label="Timeout (seconds)"
                  value={values.timeoutSeconds}
                  onChange={setNumber("timeoutSeconds")}
                />
                <NumberField
                  label="Max tool iterations"
                  value={values.maximumToolIterations}
                  onChange={setNumber("maximumToolIterations")}
                />
                <NumberField
                  label="Max tool calls per run"
                  value={values.maximumToolCallsPerRun}
                  onChange={setNumber("maximumToolCallsPerRun")}
                />
              </div>

              <label className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={values.storeRawProviderPayload}
                  onChange={(event) =>
                    actions.changeField("storeRawProviderPayload", event.target.checked)
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm text-foreground">Store raw provider payloads</span>
              </label>
            </section>

            <section className="liquid-surface rounded-3xl p-5 md:p-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Retention</h2>
              <p className="mb-4 text-xs text-tertiary">
                Stored and editable now, but nothing enforces them yet — the cleanup jobs that
                read these values are still to come.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Conversations (days)"
                  hint="How long coach threads are kept."
                  value={values.conversationRetentionDays}
                  onChange={setNumber("conversationRetentionDays")}
                />
                <NumberField
                  label="Operational logs (days)"
                  hint="Runs, tool executions and usage records."
                  value={values.operationalLogRetentionDays}
                  onChange={setNumber("operationalLogRetentionDays")}
                />
                <NumberField
                  label="Temporary uploads (hours)"
                  hint="Images sent to the coach but never attached to anything."
                  value={values.temporaryUploadRetentionHours}
                  onChange={setNumber("temporaryUploadRetentionHours")}
                />
                <NumberField
                  label="Expired actions (days)"
                  hint="Suggestions the user never confirmed or rejected."
                  value={values.expiredActionRetentionDays}
                  onChange={setNumber("expiredActionRetentionDays")}
                />
              </div>
            </section>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={state.isSaving}
                onClick={() => void actions.save()}
                className="liquid-primary-btn rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                {state.isSaving ? "Saving…" : "Save settings"}
              </button>
              {state.savedAt ? <span className="text-sm text-secondary">Saved.</span> : null}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
