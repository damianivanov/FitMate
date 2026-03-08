using Reinforced.Typings;
using Reinforced.Typings.Fluent;
using System.Reflection;

namespace FitMate.Web.Infrastructure;

public static class ReinforcedTypingsConfiguration
{
    public static void Configure(Reinforced.Typings.Fluent.ConfigurationBuilder builder)
    {
        builder.Global(config =>
        {
            config.ExportPureTypings(false);
            config.UseModules(useModules: true, discardNamespaces: false);
            config.CamelCaseForProperties(true);
        });

        var loadedAssemblies = AppDomain.CurrentDomain.GetAssemblies().ToList();
        var coreAssembly = loadedAssemblies.FirstOrDefault(a => "FitMate.Core".Equals(a.GetName()?.Name));
        var dbAssembly = loadedAssemblies.FirstOrDefault(a => "FitMate.DB".Equals(a.GetName()?.Name));
        var webAssembly = loadedAssemblies.FirstOrDefault(a => "FitMate.Web".Equals(a.GetName()?.Name));

        if (coreAssembly != null)
        {
            builder.TryLookupDocumentationForAssembly(coreAssembly, "FitMate.Core.xml");
        }

        if (dbAssembly != null)
        {
            builder.TryLookupDocumentationForAssembly(dbAssembly, "FitMate.DB.xml");
        }

        if (webAssembly != null)
        {
            builder.TryLookupDocumentationForAssembly(webAssembly, "FitMate.Web.xml");
        }

        if (coreAssembly == null)
        {
            return;
        }

        const string modelNamespace = "FitMate.Core";
        var modelsToExport = coreAssembly
            .GetExportedTypes()
            .Where(t =>
                (t.Namespace?.StartsWith($"{modelNamespace}.JsonModels") ?? false)
                || (t.Namespace?.StartsWith($"{modelNamespace}.Common") ?? false))
            .ToList();

        var enums = modelsToExport
            .Where(t => t.IsEnum)
            .Concat(modelsToExport.SelectMany(model =>
                model.GetProperties().SelectMany(property => GetEnumTypes(property.PropertyType))))
            .DistinctBy(e => e.FullName)
            .ToList();

        foreach (var enumType in enums)
        {
            builder.ExportAsEnums([enumType], cfg => cfg.OverrideNamespace("Enums"));
        }

        var nullabilityInfoContext = new NullabilityInfoContext();
        var dateTimeType = typeof(DateTime);
        var dateOnlyType = typeof(DateOnly);

        foreach (var model in modelsToExport.Where(model => !model.IsEnum))
        {
            builder.ExportAsInterfaces([model], cfg =>
            {
                cfg.AutoI(false);

                if (model.Name.StartsWith("CommonJsonModel"))
                {
                    cfg.DontIncludeToNamespace();
                    cfg.OverrideName("JsonData");
                }

                cfg.OverrideNamespace(model.Namespace?.Replace(modelNamespace + ".", string.Empty) ?? string.Empty);
                cfg.WithPublicProperties(pcfg =>
                {
                    var nullableUnderlyingType = Nullable.GetUnderlyingType(pcfg.Member.PropertyType);
                    var nullabilityInfo = nullabilityInfoContext.Create(pcfg.Member);

                    if (nullabilityInfo.WriteState == NullabilityState.Nullable
                        || nullabilityInfo.ReadState == NullabilityState.Nullable
                        || nullableUnderlyingType != null)
                    {
                        pcfg.ForceNullable(true);
                    }

                    if (pcfg.Member.PropertyType == dateTimeType
                        || nullableUnderlyingType == dateTimeType
                        || pcfg.Member.PropertyType == dateOnlyType
                        || nullableUnderlyingType == dateOnlyType)
                    {
                        pcfg.Type<string>();
                    }
                });
            });
        }
    }

    private static IEnumerable<Type> GetEnumTypes(Type type)
    {
        var nullableType = Nullable.GetUnderlyingType(type);
        if (nullableType != null)
        {
            type = nullableType;
        }

        if (type.IsEnum)
        {
            yield return type;
            yield break;
        }

        if (type.IsArray)
        {
            var elementType = type.GetElementType();
            if (elementType == null)
            {
                yield break;
            }

            foreach (var enumType in GetEnumTypes(elementType))
            {
                yield return enumType;
            }

            yield break;
        }

        if (!type.IsGenericType)
        {
            yield break;
        }

        foreach (var argument in type.GetGenericArguments())
        {
            foreach (var enumType in GetEnumTypes(argument))
            {
                yield return enumType;
            }
        }
    }
}
