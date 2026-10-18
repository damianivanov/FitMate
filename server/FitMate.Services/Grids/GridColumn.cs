using System.Globalization;
using System.Linq.Expressions;
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.Grids;

public abstract class GridColumn<TRow>(string field)
{
    public string Field { get; } = field;

    public static GridColumn<TRow> Create<TValue>(
        string field,
        Expression<Func<TRow, TValue>> selector,
        Func<TValue, string>? label = null) => new ValueColumn<TValue>(field, selector, label);

    public abstract IQueryable<TRow> Apply(IQueryable<TRow> query, IReadOnlyList<string> values);
    public abstract Expression Project(ParameterExpression parameter);
    public abstract GridFilterOptionModel ToOption(object? value);

    private sealed class ValueColumn<TValue>(
        string field,
        Expression<Func<TRow, TValue>> selector,
        Func<TValue, string>? label) : GridColumn<TRow>(field)
    {
        public override IQueryable<TRow> Apply(IQueryable<TRow> query, IReadOnlyList<string> values)
        {
            TValue[] parsed;
            try
            {
                parsed = values.Select(value => JsonSerializer.Deserialize<TValue>(value)!).ToArray();
            }
            catch (JsonException)
            {
                throw new FitMateException($"Invalid selection for {Field}.");
            }

            var contains = Expression.Call(
                typeof(Enumerable), nameof(Enumerable.Contains), [typeof(TValue)],
                Expression.Constant(parsed), selector.Body);
            return query.Where(Expression.Lambda<Func<TRow, bool>>(contains, selector.Parameters));
        }

        public override Expression Project(ParameterExpression parameter) =>
            Expression.Convert(
                new ParameterReplacer(selector.Parameters[0], parameter).Visit(selector.Body)!,
                typeof(object));

        public override GridFilterOptionModel ToOption(object? value)
        {
            var typed = value == null ? default! : (TValue)value;
            return new GridFilterOptionModel
            {
                Value = JsonSerializer.Serialize(typed),
                Label = label != null ? label(typed) : value switch
                {
                    null => "—",
                    DateTime date => date.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                    bool flag => flag ? "Yes" : "No",
                    _ => Convert.ToString(value, CultureInfo.InvariantCulture) is { Length: > 0 } text
                        ? text : "—",
                },
            };
        }
    }

    private sealed class ParameterReplacer(ParameterExpression source, ParameterExpression target)
        : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) =>
            node == source ? target : base.VisitParameter(node);
    }
}
