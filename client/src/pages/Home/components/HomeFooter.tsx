export default function HomeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="px-4 pb-4">
      <div className="liquid-surface mx-auto flex w-full max-w-3xl justify-center rounded-full px-6 py-3 text-xs text-slate-600">
        <div className="text-center">(c) {currentYear} FitMate. All rights reserved.</div>
      </div>
    </div>
  );
}
