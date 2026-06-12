# syntax=docker/dockerfile:1

# ---- build stage ----
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy only the csproj files first so `restore` is cached unless dependencies change.
# (FitMate.Web transitively references Core, DB and Services; Tests isn't published.)
COPY FitMate.Core/FitMate.Core.csproj FitMate.Core/
COPY FitMate.DB/FitMate.DB.csproj FitMate.DB/
COPY FitMate.Services/FitMate.Services.csproj FitMate.Services/
COPY FitMate.Web/FitMate.Web.csproj FitMate.Web/
RUN dotnet restore FitMate.Web/FitMate.Web.csproj

# Copy the rest of the source and publish.
# RtDisable=true skips the Reinforced.Typings codegen, which would otherwise try to
# write ../../client/src/types/backend.ts (the client folder isn't in this build context;
# the generated file is already committed to the repo).
COPY . .
RUN dotnet publish FitMate.Web/FitMate.Web.csproj \
    -c Release \
    -o /app/publish \
    -p:RtDisable=true

# ---- runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production

# Railway injects $PORT at runtime. Shell form lets the variable expand so Kestrel
# binds to the port Railway routes to.
CMD ASPNETCORE_URLS=http://0.0.0.0:$PORT dotnet FitMate.Web.dll
