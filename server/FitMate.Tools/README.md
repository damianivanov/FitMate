# FitMate.Tools

Small console app for one-off operational commands that run **directly against a real
environment's database and blob storage**. Treat every run as production unless you've pointed it
elsewhere.

## Setup

1. Copy the credentials template and fill it in (this file is git-ignored):

   ```bash
   cp appsettings.Local.example.json appsettings.Local.json
   ```

2. Set in `appsettings.Local.json`:
   - `ConnectionStrings:DefaultConnection` — the target Postgres connection string in Npgsql
     key-value form (`Host=...;Port=...;Database=...;Username=...;Password=...;SSL Mode=Require`).
     Npgsql does not accept `postgresql://` URLs, so if you have a Railway-style URL
     (`DATABASE_PUBLIC_URL`), reformat it into key-value form. Use the **public** proxy host/port
     (`*.proxy.rlwy.net`), not the internal `*.railway.internal` host.
   - `AzureStorage:ConnectionString` — the storage account connection string (must include an
     account key so SAS read URLs can be generated, same as the web app).
   - `AzureStorage:ContainerName` — **must match the container the target environment's web app
     reads from** (otherwise uploaded images won't show up in the app).

Configuration can also come from environment variables, e.g.
`ConnectionStrings__DefaultConnection` and `AzureStorage__ConnectionString`.

## Commands

### `import-exercise-images <folder> [--dry-run]`

Uploads every image in `<folder>` to Azure blob storage and sets it as the matching exercise's
image, exactly like the in-app upload (same image processing, same blob path scheme, the bare file
name is stored in `Exercise.ImageUrl`).

- **Matching:** each file is matched to an exercise by **slug** — the file name without its
  extension must equal the exercise slug. `bench-press.png` → exercise with slug `bench-press`.
  Matching is case-insensitive on the file name (slugs are stored lowercase).
- Supported extensions: `.jpg .jpeg .png .webp .gif .bmp`. Other files are ignored.
- Files with no matching exercise, or that aren't valid images, are skipped and reported.
- If an exercise already has an uploaded image, its old blobs are deleted first (same as the app).
- All operations run as the **first user with the `Admin` role**; the command aborts if no admin
  exists in the target database.

```bash
# Preview without touching the DB or storage:
dotnet run -- import-exercise-images "C:\path\to\images" --dry-run

# Do it for real:
dotnet run -- import-exercise-images "C:\path\to\images"
```

Exit code is non-zero if any file failed.
