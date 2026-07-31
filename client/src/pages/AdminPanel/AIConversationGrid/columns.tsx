import type { GridColDef } from "@mui/x-data-grid";
import { LuEye } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { AIConversationStatus, type AIConversationListItemModel } from "@/types";

const STATUS_LABELS: Record<number, string> = {
  [AIConversationStatus.Active]: "Active",
  [AIConversationStatus.Archived]: "Archived",
  [AIConversationStatus.Deleted]: "Deleted",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
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

type ColumnOptions = {
  onView: (row: AIConversationListItemModel) => void;
};

export function createConversationColumns({
  onView,
}: ColumnOptions): GridColDef<AIConversationListItemModel>[] {
  return [
    {
      field: "lastMessageAt",
      headerName: "Last message",
      minWidth: 150,
      sortable: false,
      valueGetter: (_value, row) => formatDateTime(row.lastMessageAt),
    },
    {
      field: "userEmail",
      headerName: "User",
      flex: 1,
      minWidth: 200,
      sortable: false,
      valueGetter: (_value, row) => row.userEmail ?? `User ${row.userId}`,
    },
    {
      field: "title",
      headerName: "Title",
      flex: 1.2,
      minWidth: 200,
      sortable: false,
      valueGetter: (_value, row) => row.title ?? "—",
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 110,
      sortable: false,
      valueGetter: (_value, row) => STATUS_LABELS[row.status] ?? "—",
    },
    {
      field: "messageCount",
      headerName: "Messages",
      minWidth: 100,
      sortable: false,
    },
    {
      field: "runCount",
      headerName: "Runs",
      minWidth: 80,
      sortable: false,
    },
    {
      field: "estimatedCost",
      headerName: "Cost",
      minWidth: 100,
      sortable: false,
      valueGetter: (_value, row) => `$${row.estimatedCost.toFixed(4)}`,
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
          onClick={() => onView(params.row)}
          className="liquid-pill inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
          aria-label="View conversation"
        >
          <LuEye className="h-4 w-4" />
        </button>
      ),
    },
  ];
}
