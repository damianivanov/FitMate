import type { GridColDef } from "@mui/x-data-grid";
import { LuBadgeCheck, LuPencil, LuTrash2, LuUndo2 } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { EntitlementSource } from "@/types";
import type { AdminUser } from "@/types";

type UserGridColumnsOptions = {
  currentUserId: number;
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onAssignPlan: (user: AdminUser) => void;
  onRemoveOverride: (user: AdminUser) => void;
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

function fullName(user: AdminUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "—";
}

export function createUserGridColumns({
  currentUserId,
  onEdit,
  onDelete,
  onAssignPlan,
  onRemoveOverride,
}: UserGridColumnsOptions): GridColDef<AdminUser>[] {
  return [
    {
      field: "email",
      headerName: "Email",
      flex: 1,
      minWidth: 220,
    },
    {
      field: "name",
      headerName: "Name",
      minWidth: 160,
      flex: 1,
      sortable: false,
      valueGetter: (_value, row) => fullName(row),
    },
    {
      field: "isAdmin",
      headerName: "Role",
      minWidth: 110,
      renderCell: (params) => (
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
            params.row.isAdmin ? "bg-primary-200 text-primary" : "bg-white/8 text-secondary",
          ].join(" ")}
        >
          {params.row.isAdmin ? "Admin" : "Member"}
        </span>
      ),
    },
    {
      field: "isActive",
      headerName: "Status",
      minWidth: 110,
      renderCell: (params) => (
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
            params.row.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-secondary",
          ].join(" ")}
        >
          {params.row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      field: "effectivePlanName",
      headerName: "Plan",
      minWidth: 150,
      sortable: false,
      renderCell: (params) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-foreground">{params.row.effectivePlanName || "—"}</span>
          {params.row.source === EntitlementSource.AdminOverride ? (
            <span
              className="inline-flex rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
              title="Granted by an admin override"
            >
              override
            </span>
          ) : null}
        </div>
      ),
    },
    {
      field: "dateCreated",
      headerName: "Joined",
      minWidth: 130,
      sortable: false,
      valueGetter: (_value, row) => formatDate(row.dateCreated),
    },
    {
      field: "lastLoginAt",
      headerName: "Last login",
      minWidth: 130,
      sortable: false,
      valueGetter: (_value, row) => (row.lastLoginAt ? formatDate(row.lastLoginAt) : "Never"),
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      filterable: false,
      width: 200,
      renderCell: (params) => {
        const isSelf = params.row.id === currentUserId;

        const handleEditClick = () => {
          onEdit(params.row);
        };

        const handleDeleteClick = () => {
          onDelete(params.row);
        };

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="liquid-pill rounded-full p-2 text-primary"
              onClick={() => onAssignPlan(params.row)}
              aria-label="Assign plan"
              title="Assign a plan"
            >
              <LuBadgeCheck className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!params.row.hasActiveOverride}
              className="liquid-pill rounded-full p-2 disabled:opacity-40"
              onClick={() => onRemoveOverride(params.row)}
              aria-label="Remove plan override"
              title={
                params.row.hasActiveOverride
                  ? "Remove the override and fall back to their real plan"
                  : "No active override"
              }
            >
              <LuUndo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={isSelf}
              className="liquid-pill rounded-full p-2 text-primary disabled:opacity-40"
              onClick={handleEditClick}
              aria-label="Edit user"
              title={isSelf ? "You can't edit yourself" : "Edit"}
            >
              <LuPencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={isSelf}
              className="liquid-pill liquid-pill-danger rounded-full p-2 disabled:opacity-40"
              onClick={handleDeleteClick}
              aria-label="Delete user"
              title={isSelf ? "You can't delete yourself" : "Delete"}
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];
}
