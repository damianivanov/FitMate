import { useMemo, type ReactNode } from "react";
import { GridColumnFilterHeader } from "./GridColumnFilterHeader";
import type { GridFiltersState } from "./useGridFilters";
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
  filters: GridFiltersState;
  filterOptionImages?: Readonly<Record<string, ReadonlyMap<string, string>>>;
  toolbarActions?: ReactNode;
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
  filters,
  filterOptionImages,
  toolbarActions,
  sx,
}: EntityGridProps<TRow>) {
  const gridColumns = useMemo(() => columns.map((column) => {
    const options = filters.options.find((item) => item.field === column.field);
    if (column.filterable === false || !options) {
      return { ...column, filterable: false, hideSortIcons: true };
    }

    return {
      ...column,
      filterable: false,
      hideSortIcons: true,
      renderHeader: (params: Parameters<NonNullable<typeof column.renderHeader>>[0]) => (
        <GridColumnFilterHeader
          field={column.field}
          title={column.headerName ?? column.field}
          options={options.options}
          optionImages={filterOptionImages?.[column.field]}
          selected={filters.selections.find((item) => item.field === column.field)?.values ?? []}
          sortable={column.sortable !== false}
          onChange={filters.changeSelection}
        >
          {column.renderHeader?.(params) ?? column.headerName ?? column.field}
        </GridColumnFilterHeader>
      ),
    };
  }), [columns, filters.options, filters.selections, filters.changeSelection, filterOptionImages]);

  return (
    <>
      {filters.error && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-sm text-danger">
          <span>{filters.error}</span>
          <button type="button" onClick={filters.retry} className="liquid-pill cursor-pointer rounded-full px-3 py-1 text-primary">Retry options</button>
        </div>
      )}
      {(toolbarActions || filters.selections.length > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {toolbarActions && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbarActions}</div>
          )}
          {filters.selections.length > 0 && (
            <button
              type="button"
              onClick={filters.clearSelections}
              className="liquid-pill ml-auto h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm font-semibold text-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      <DataGrid
        rows={rows}
        columns={gridColumns}
        loading={!filters.error && (loading || filters.loading)}
        disableColumnFilter
        disableColumnMenu
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
          "& .MuiDataGrid-columnHeaderTitleContainerContent": { flex: 1, minWidth: 0 },
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
    </>
  );
}
