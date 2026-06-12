import type { GridColDef } from "@mui/x-data-grid";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import type { Exercise, MuscleGroup } from "@/types";
import { ExerciseNameCell, ExerciseSearchHeader } from "./components/ExerciseGridCells";

type ExerciseGridColumnsOptions = {
  resolveMuscleGroupName: (id?: number) => string;
  resolveMuscleGroup: (id?: number) => MuscleGroup | null;
  onSearchChange: (value: string) => void;
  onEdit: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
  onImage: (exercise: Exercise) => void;
};

function renderMuscleGroupCell(name: string, imageUrl?: string) {
  return (
    <div className="flex w-full items-center gap-2">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-md object-cover"
          loading="lazy"
        />
      ) : null}
      <span className="truncate">{name}</span>
    </div>
  );
}

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

export function createExerciseGridColumns({
  resolveMuscleGroupName,
  resolveMuscleGroup,
  onSearchChange,
  onEdit,
  onDelete,
  onImage,
}: ExerciseGridColumnsOptions): GridColDef<Exercise>[] {
  return [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 240,
      sortable: false,
      disableColumnMenu: true,
      renderHeader: () => <ExerciseSearchHeader onChange={onSearchChange} />,
      renderCell: (params) => <ExerciseNameCell exercise={params.row} />,
    },
    {
      field: "slug",
      headerName: "Slug",
      flex: 1,
      minWidth: 190,
    },
    {
      field: "primaryMuscleGroupId",
      headerName: "Primary Muscle",
      minWidth: 180,
      valueGetter: (_value, row) => resolveMuscleGroupName(row.primaryMuscleGroupId),
      renderCell: (params) =>
        renderMuscleGroupCell(
          resolveMuscleGroupName(params.row.primaryMuscleGroupId),
          resolveMuscleGroup(params.row.primaryMuscleGroupId)?.imageUrl,
        ),
    },
    {
      field: "secondaryMuscleGroupId",
      headerName: "Secondary Muscle",
      minWidth: 190,
      valueGetter: (_value, row) => resolveMuscleGroupName(row.secondaryMuscleGroupId),
      renderCell: (params) =>
        renderMuscleGroupCell(
          resolveMuscleGroupName(params.row.secondaryMuscleGroupId),
          resolveMuscleGroup(params.row.secondaryMuscleGroupId)?.imageUrl,
        ),
    },
    {
      field: "dateCreated",
      headerName: "Created",
      minWidth: 130,
      valueGetter: (_value, row) => formatDate(row.dateCreated),
    },
    {
      field: "dateModified",
      headerName: "Modified",
      minWidth: 130,
      valueGetter: (_value, row) => formatDate(row.dateModified),
    },
    {
      field: "creatorDisplayName",
      headerName: "Created by",
      minWidth: 160,
      sortable: false,
      valueGetter: (_value, row) => row.creatorDisplayName?.trim() || "—",
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      filterable: false,
      width: 160,
      renderCell: (params) => {
        const handleEditClick = () => {
          onEdit(params.row);
        };

        const handleImageClick = () => {
          onImage(params.row);
        };

        const handleDeleteClick = () => {
          onDelete(params.row);
        };

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="liquid-pill rounded-full p-2 text-primary"
              onClick={handleEditClick}
              aria-label="Edit exercise"
              title="Edit"
            >
              <LuPencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="liquid-pill rounded-full p-2 text-secondary"
              onClick={handleImageClick}
              aria-label="Change exercise image"
              title="Change image"
            >
              <LuImage className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="liquid-pill liquid-pill-danger rounded-full p-2"
              onClick={handleDeleteClick}
              aria-label="Delete exercise"
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

