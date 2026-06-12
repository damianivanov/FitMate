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
  columnHeaderHeight?: number;
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
  columnHeaderHeight,
  sx,
}: EntityGridProps<TRow>) {
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={loading}
      rowCount={rowCount ?? rows.length}
      getRowId={getRowId}
      {...(columnHeaderHeight ? { columnHeaderHeight } : {})}
      pagination
      paginationMode="server"
      pageSizeOptions={pageSizeOptions}
      paginationModel={paginationModel}
      onPaginationModelChange={onPaginationModelChange}
      disableRowSelectionOnClick
      autoHeight
      sx={{
        // Blend the grid into the surrounding liquid-surface panel and follow the
        // app's theme tokens (these flip automatically with the `.dark` class).
        border: 0,
        color: "var(--foreground)",
        backgroundColor: "transparent",
        "--DataGrid-containerBackground": "transparent",
        "--DataGrid-rowBorderColor": "var(--border)",
        "& .MuiDataGrid-main, & .MuiDataGrid-filler, & .MuiDataGrid-scrollbarFiller": {
          backgroundColor: "transparent",
        },
        // v8 paints the header fill on the headers container / header row, so the
        // transparent override has to land there (not just on each header cell) for
        // the liquid-surface panel to show through like the body rows do.
        "& .MuiDataGrid-topContainer, & .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeaderRow, & .MuiDataGrid-topContainer::after": {
          backgroundColor: "transparent",
        },
        "& .MuiDataGrid-columnHeaders": {
          borderColor: "var(--border)",
        },
        "& .MuiDataGrid-columnHeader": {
          backgroundColor: "transparent",
        },
        "& .MuiDataGrid-columnHeaderTitle": {
          color: "var(--text-secondary)",
          fontWeight: 600,
        },
        "& .MuiDataGrid-cell": {
          alignItems: "center",
          display: "flex",
          color: "var(--foreground)",
          borderColor: "var(--border)",
        },
        "& .MuiDataGrid-row:hover": {
          backgroundColor: "rgba(var(--primary-rgb), 0.08)",
        },
        "& .MuiDataGrid-columnSeparator": {
          color: "var(--border)",
        },
        "& .MuiDataGrid-menuIcon .MuiSvgIcon-root, & .MuiDataGrid-sortIcon, & .MuiDataGrid-filterIcon": {
          color: "var(--text-secondary)",
        },
        "& .MuiDataGrid-footerContainer": {
          borderColor: "var(--border)",
        },
        "& .MuiDataGrid-overlay": {
          backgroundColor: "transparent",
          color: "var(--text-secondary)",
        },
        "& .MuiTablePagination-root, & .MuiTablePagination-selectIcon, & .MuiTablePagination-actions .MuiIconButton-root": {
          color: "var(--text-secondary)",
        },
        "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within, & .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
          outline: "none",
        },
        "& .MuiDataGrid-withBorderColor": {
          borderColor: "var(--border)",
        },
        ...sx,
      }}
    />
  );
}
