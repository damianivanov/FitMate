using System.Linq.Expressions;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;

namespace FitMate.Services.Grids;

public static class GridFilters
{
    public static IQueryable<TRow> Apply<TRow>(
        IQueryable<TRow> query, IReadOnlyList<GridColumnSelectionModel>? selections,
        IReadOnlyList<GridColumn<TRow>> columns)
    {
        if (selections == null || selections.Count == 0)
        {
            return query;
        }

        foreach (var filter in selections)
        {
            if (filter == null || filter.Values == null)
            {
                throw new FitMateException("Invalid column selections.");
            }
            var column = columns.FirstOrDefault(x => x.Field == filter.Field)
                ?? throw new FitMateException($"Unknown grid column: {filter.Field}.");
            if (filter.Values.Count > 0)
            {
                query = column.Apply(query, filter.Values);
            }
        }

        return query;
    }

    public static async Task<IReadOnlyList<GridColumnOptionsModel>> GetOptionsAsync<TRow>(
        IQueryable<TRow> query, IReadOnlyList<GridColumn<TRow>> columns)
    {
        var parameter = Expression.Parameter(typeof(TRow), "row");
        var projection = Expression.Lambda<Func<TRow, object?[]>>(
            Expression.NewArrayInit(typeof(object), columns.Select(column => column.Project(parameter))),
            parameter);
        var values = query.Select(projection);
        var options = columns.Select(_ => new Dictionary<string, GridFilterOptionModel>()).ToArray();

        void Collect(object?[] row)
        {
            for (var index = 0; index < columns.Count; index++)
            {
                var option = columns[index].ToOption(row[index]);
                options[index].TryAdd(option.Value, option);
            }
        }

        if (query.Provider is IAsyncQueryProvider)
        {
            await foreach (var row in values.AsAsyncEnumerable())
            {
                Collect(row);
            }
        }
        else
        {
            foreach (var row in values)
            {
                Collect(row);
            }
        }

        return columns.Select((column, index) => new GridColumnOptionsModel
        {
            Field = column.Field,
            Options = options[index].Values.OrderBy(option => option.Label, StringComparer.OrdinalIgnoreCase)
                .ThenBy(option => option.Value, StringComparer.Ordinal).ToList(),
        }).ToList();
    }
}
