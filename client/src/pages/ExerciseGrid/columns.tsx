import type { GridColDef } from "@mui/x-data-grid";
import type { Exercise } from "@/types";

type ExerciseGridColumnsOptions = {
  resolveMuscleGroupName: (id?: number) => string;
  onEdit: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
};

export function createExerciseGridColumns({
  resolveMuscleGroupName,
  onEdit,
  onDelete,
}: ExerciseGridColumnsOptions): GridColDef<Exercise>[] {
  return [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 220,
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
    },
    {
      field: "secondaryMuscleGroupId",
      headerName: "Secondary Muscle",
      minWidth: 190,
      valueGetter: (_value, row) => resolveMuscleGroupName(row.secondaryMuscleGroupId),
    },
    {
      field: "actions",
      headerName: "Actions",
      sortable: false,
      filterable: false,
      width: 170,
      renderCell: (params) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="liquid-pill rounded-full px-3 py-1 text-xs font-semibold text-slate-800"
            onClick={() => onEdit(params.row)}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
            onClick={() => onDelete(params.row)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];
}
