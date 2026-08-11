import { useEffect, useState } from "react";
import { LuServer, LuMonitor } from "react-icons/lu";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { BuildInfoModel } from "@/types";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const minutes = Math.round((Date.now() - parsed.getTime()) / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

function Row({
  icon,
  label,
  timestamp,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  timestamp: string | null | undefined;
  detail?: string | null;
}) {
  const relative = formatRelative(timestamp);

  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 shrink-0 text-secondary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">
          {formatTimestamp(timestamp)}
          {relative ? <span className="ml-2 font-normal text-secondary">({relative})</span> : null}
        </p>
        {detail ? <p className="mono truncate text-xs text-secondary">{detail}</p> : null}
      </div>
    </div>
  );
}

export function BuildInfoPanel() {
  const [serverBuild, setServerBuild] = useState<BuildInfoModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadBuildInfo() {
      try {
        const response = await adminService.buildInfo();
        const info = unwrap(response.data, "Unable to read build info.");
        if (!isCancelled) {
          setServerBuild(info);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to read build info.");
        }
      }
    }

    void loadBuildInfo();
    return () => {
      isCancelled = true;
    };
  }, []);

  const serverDetail = [
    serverBuild?.environmentName,
    serverBuild?.commitSha ? serverBuild.commitSha.slice(0, 7) : null,
    serverBuild?.startedAtUtc ? `up since ${formatTimestamp(serverBuild.startedAtUtc)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="liquid-pill mt-4 grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
      <Row
        icon={<LuMonitor className="h-4 w-4" />}
        label="Frontend built"
        timestamp={__BUILD_TIME__}
      />
      <Row
        icon={<LuServer className="h-4 w-4" />}
        label="Backend built"
        timestamp={serverBuild?.buildTimeUtc}
        detail={error ?? (serverDetail || null)}
      />
    </div>
  );
}
