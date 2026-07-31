import type { GridColDef } from "@mui/x-data-grid";
import { LuPencil } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { UnsupportedRequestStatus, type UnsupportedAIRequestModel } from "@/types";

export const STATUS_LABELS: Record<number, string> = {
  [UnsupportedRequestStatus.New]: "New",
  [UnsupportedRequestStatus.Reviewed]: "Reviewed",
  [UnsupportedRequestStatus.Planned]: "Planned",
  [UnsupportedRequestStatus.Implemented]: "Implemented",
  [UnsupportedRequestStatus.Rejected]: "Rejected",
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMATTER.format(date);
}

type ColumnOptions = {
  onTriage: (row: UnsupportedAIRequestModel) => void;
};

export function createUnsupportedColumns({
  onTriage,
}: ColumnOptions): GridColDef<UnsupportedAIRequestModel>[] {
  return [
    {
      field: "requestedFunctionality",
      headerName: "Requested",
      flex: 1.6,
      minWidth: 260,
      sortable: false,
      renderCell: (params) => (
        <span className="block w-full truncate" title={params.row.requestedFunctionality}>
          {params.row.requestedFunctionality}
        </span>
      ),
    },
    {
      field: "category",
      headerName: "Category",
      minWidth: 130,
      sortable: false,
    },
    {
      field: "occurrenceCount",
      headerName: "Asks",
      minWidth: 80,
      sortable: false,
    },
    {
      field: "distinctUserCount",
      headerName: "Users",
      minWidth: 80,
      sortable: false,
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      sortable: false,
      valueGetter: (_value, row) => STATUS_LABELS[row.status] ?? "—",
    },
    {
      field: "lastRequestedAt",
      headerName: "Last asked",
      minWidth: 130,
      sortable: false,
      valueGetter: (_value, row) => formatDate(row.lastRequestedAt),
    },
    {
      field: "externalTrackingKey",
      headerName: "Ticket",
      minWidth: 110,
      sortable: false,
      valueGetter: (_value, row) => row.externalTrackingKey ?? "—",
    },
    {
      field: "actions",
      headerName: "",
      minWidth: 70,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <button
          type="button"
          onClick={() => onTriage(params.row)}
          className="liquid-pill inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
          aria-label="Triage request"
        >
          <LuPencil className="h-4 w-4" />
        </button>
      ),
    },
  ];
}
