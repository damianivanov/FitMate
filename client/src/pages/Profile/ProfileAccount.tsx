import { useNavigate } from "react-router";
import { LuCookie, LuScale } from "react-icons/lu";
import { PrimaryButton } from "@/shared/components/Buttons";
import { NativeGlyph, NativeList, NativeRow, NativeSection } from "@/shared/components";
import { useConsentStore } from "@/stores/consentStore";
import ChangePassword from "./ChangePassword";
import { useProfileAccountPage } from "./hooks/useProfileAccountPage";

export default function ProfileAccount() {
  const { state, actions } = useProfileAccountPage();
  const navigate = useNavigate();
  const reopenBanner = useConsentStore((store) => store.reopenBanner);

  return (
    <div className="space-y-6">
      <div className="liquid-panel rounded-2xl p-5 md:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-foreground">Account Details</h2>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={actions.save}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary" htmlFor="firstName">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            value={state.formValues.firstName}
            onChange={actions.changeField}
            autoComplete="given-name"
            className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
            placeholder="Enter your first name"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary" htmlFor="lastName">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            value={state.formValues.lastName}
            onChange={actions.changeField}
            autoComplete="family-name"
            className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
            placeholder="Enter your last name"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-secondary" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            readOnly
            value={state.email}
            className="liquid-input mt-2 w-full cursor-not-allowed rounded-full px-3 py-2.5 text-tertiary"
          />
        </div>

        {state.error ? <p className="text-sm text-danger md:col-span-2">{state.error}</p> : null}
        {state.successMessage ? (
          <p className="text-sm text-success md:col-span-2">{state.successMessage}</p>
        ) : null}

        <div className="flex justify-end md:col-span-2">
          <PrimaryButton type="submit" disabled={!state.canSubmit} className="w-full md:w-auto">
            {state.isSaving ? "Saving..." : "Save Profile"}
          </PrimaryButton>
        </div>
        </form>
      </div>

      <ChangePassword />

      {/* Legal and cookie preferences live here rather than in the navigation drawer: they are
          settings you visit once, not sections you navigate between. */}
      <NativeSection title="Privacy">
        <NativeList>
          <NativeRow
            glyph={
              <NativeGlyph tint="blue">
                <LuScale className="h-5 w-5" />
              </NativeGlyph>
            }
            title="Legal"
            subtitle="Terms, privacy and AI transparency"
            onClick={() => navigate("/legal")}
          />
          <NativeRow
            glyph={
              <NativeGlyph tint="yellow">
                <LuCookie className="h-5 w-5" />
              </NativeGlyph>
            }
            title="Cookie preferences"
            subtitle="Choose what analytics you allow"
            onClick={reopenBanner}
          />
        </NativeList>
      </NativeSection>
    </div>
  );
}
