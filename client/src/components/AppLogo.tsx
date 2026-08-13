import { Link } from "react-router";

type AppLogoProps = {
  className?: string;
};

export default function AppLogo({ className = "" }: AppLogoProps) {
  return (
    <Link to="/" className={`app-logo ${className}`.trim()} aria-label="FitMate home">
      Fit<span>Mate</span>
    </Link>
  );
}
