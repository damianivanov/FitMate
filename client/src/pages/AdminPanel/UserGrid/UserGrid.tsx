import { PageBody, PageHeader } from "@/shared/components";

export default function UserGrid() {
  return (
    <>
      <PageHeader title="User Grid" subtitle="Global user management for admin users." />

      <PageBody>
        <section className="liquid-surface mx-auto flex w-full max-w-[79dvw] flex-col items-center justify-center gap-2 rounded-3xl p-10 text-center md:p-12">
          <h2 className="text-lg font-bold text-primary">Coming soon</h2>
          <p className="max-w-md text-sm text-secondary">
            The user administration grid is not ready yet. This is where you&apos;ll search, review and
            manage application users.
          </p>
        </section>
      </PageBody>
    </>
  );
}
