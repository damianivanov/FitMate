import type { GridColDef } from "@mui/x-data-grid";
import { Tooltip } from "@mui/material";
import { LuImage, LuPencil, LuTrash2 } from "react-icons/lu";
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
      renderCell: (params) => {
        const imageUrl = params.row.imageUrl?.trim();

        return (
          <div className="flex w-full items-center gap-2">
            <span className="truncate">{params.row.name}</span>
            {imageUrl ? (
              <Tooltip
                arrow
                placement="right"
                enterDelay={80}
                slotProps={{
                  tooltip: {
                    sx: {
                      backgroundColor: "white",
                      color: "#0f172a",
                      border: "1px solid #ffffffb3",
                      boxShadow: "0 18px 36px #0000001f",
                      borderRadius: "16px",
                      p: 1,
                    },
                  },
                  arrow: {
                    sx: {
                      color: "white",
                    },
                  },
                }}
                title={
                  <img
                    src={imageUrl}
                    alt={`${params.row.name} preview`}
                    className="h-52 w-80 rounded-xl object-contain"
                    loading="lazy"
                  />
                }
              >
                <span
                  className="liquid-pill inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-700"
                  aria-label={`Preview ${params.row.name} image`}
                  title="Preview image"
                >
                  <LuImage className="h-4 w-4" />
                </span>
              </Tooltip>
            ) : null}
          </div>
        );
      },
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
      width: 120,
      renderCell: (params) => {
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
              className="liquid-pill rounded-full p-2 text-slate-800"
              onClick={handleEditClick}
              aria-label="Edit exercise"
              title="Edit"
            >
              <LuPencil className="h-4 w-4" />
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
