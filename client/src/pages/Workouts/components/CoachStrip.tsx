import { Link } from "react-router";
import { LuChevronRight, LuSparkles } from "react-icons/lu";

export function CoachStrip() {
  return (
    <Link to="/ai-coach" className="wk-coach">
      <span className="wk-coach-glyph">
        <LuSparkles className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <b>Ask FitMate Coach</b>
        <small>Adapt today’s session to how you feel</small>
      </span>
      <LuChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}
