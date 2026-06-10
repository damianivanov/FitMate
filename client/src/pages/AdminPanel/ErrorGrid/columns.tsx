import type { GridColDef } from "@mui/x-data-grid";
import { LuEye, LuTrash2 } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import type { ErrorModel } from "@/types";

type ErrorGridColumnsOptions = {
  onView: (error: ErrorModel) => void;
  onDelete: (error: ErrorModel) => void;
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME_FORMATTER.format(date);
}

export function createErrorGridColumns({
  onView,
  onDelete,
}: ErrorGridColumnsOptions): GridColDef<ErrorModel>[] {
  return [
    {
      field: "dateCreated",
      headerName: "When",
      minWidth: 170,
      sortable: false,
      valueGetter: (_value, row) => formatDateTime(row.dateCreated),
    },
    {
      field: "message",
      headerName: "Message",
      flex: 1.4,
      minWidth: 260,
      sortable: false,
      renderCell: (params) => (
        <span className="block w-full truncate text-danger" title={params.row.message}>
          {params.row.message}
        </span>
      ),
    },
    {
      field: "requestUrl",
      headerName: "Request",
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => (
        <span className="block w-full truncate font-mono text-xs" title={params.row.requestUrl}>
          {params.row.requestUrl}
        </span>
      ),
    },
    {
      field: "source",
      headerName: "Source",
      minWidth: 140,
      flex: 0.6,
      sortable: false,
      valueGetter: (_value, row) => row.source || "—",
    },
    {
      field: "createdByEmail",
      headerName: "User",
      minWidth: 180,
      flex: 0.8,
      sortable: false,
      valueGetter: (_value, row) => row.createdByEmail || "Anonymous",
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      filterable: false,
      width: 120,
      renderCell: (params) => {
        const handleViewClick = () => {
          onView(params.row);
        };

        const handleDeleteClick = () => {
          onDelete(params.row);
        };

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="liquid-pill rounded-full p-2 text-primary"
              onClick={handleViewClick}
              aria-label="View error details"
              title="View details"
            >
              <LuEye className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="liquid-pill liquid-pill-danger rounded-full p-2"
              onClick={handleDeleteClick}
              aria-label="Delete error"
              title="Delete"
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];
}
