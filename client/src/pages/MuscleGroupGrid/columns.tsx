import type { GridColDef } from "@mui/x-data-grid";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import type { MuscleGroup } from "@/types";

type MuscleGroupGridColumnsOptions = {
  onEdit: (muscleGroup: MuscleGroup) => void;
  onDelete: (muscleGroup: MuscleGroup) => void;
};

export function createMuscleGroupGridColumns({
  onEdit,
  onDelete,
}: MuscleGroupGridColumnsOptions): GridColDef<MuscleGroup>[] {
  return [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 220,
    },
    {
      field: "imageUrl",
      headerName: "Image",
      minWidth: 260,
      flex: 1,
      renderCell: (params) => {
        const imageUrl = params.row.imageUrl;
        if (!imageUrl) {
          return <span className="text-xs text-slate-500">No image</span>;
        }

        return (
          <div className="flex items-center">
            <img
              src={imageUrl}
              alt={`${params.row.name} preview`}
              className="h-10 w-10 rounded-md object-cover"
              loading="lazy"
            />
          </div>
        );
      },
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
              aria-label="Edit muscle group"
              title="Edit"
            >
              <LuPencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="liquid-pill liquid-pill-danger rounded-full p-2"
              onClick={handleDeleteClick}
              aria-label="Delete muscle group"
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
