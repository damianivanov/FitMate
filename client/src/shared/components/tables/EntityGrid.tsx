import {
  DataGrid,
  type DataGridProps,
  type GridPaginationModel,
  type GridRowId,
  type GridValidRowModel,
} from "@mui/x-data-grid";

type EntityGridProps<TRow extends GridValidRowModel> = {
  rows: readonly TRow[];
  columns: DataGridProps<TRow>["columns"];
  loading?: boolean;
  rowCount?: number;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  getRowId?: (row: TRow) => GridRowId;
  pageSizeOptions?: readonly number[];
  sx?: DataGridProps<TRow>["sx"];
};

export default function EntityGrid<TRow extends GridValidRowModel>({
  rows,
  columns,
  loading = false,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  getRowId,
  pageSizeOptions = [10, 25, 50],
  sx,
}: EntityGridProps<TRow>) {
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={loading}
      rowCount={rowCount ?? rows.length}
      getRowId={getRowId}
      pagination
      paginationMode="server"
      pageSizeOptions={pageSizeOptions}
      paginationModel={paginationModel}
      onPaginationModelChange={onPaginationModelChange}
      disableRowSelectionOnClick
      autoHeight
      sx={{
        border: 0,
        "& .MuiDataGrid-columnHeaders": {
          backgroundColor: "rgba(248, 250, 252, 0.95)",
        },
        ...sx,
      }}
    />
  );
}
