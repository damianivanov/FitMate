using FitMate.DB;
using FitMate.Tests.TestInfrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class DataProtectionKeyRingTests
{
    // Production runs in a container with an ephemeral filesystem. With the default file-system key
    // store every deploy created a fresh key ring, so Identity password-reset tokens issued before a
    // release could no longer be unprotected after it. The key ring has to live in the database.
    [Fact]
    public async Task ProtectingAPayload_PersistsTheKeyRingToTheDatabase()
    {
        using var factory = new TestWebApplicationFactory();

        var protector = factory.Services
            .GetRequiredService<IDataProtectionProvider>()
            .CreateProtector("FitMate.Tests");

        // Forces the key ring to be created and committed to its repository.
        protector.Protect("payload");

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var keys = await dbContext.DataProtectionKeys.AsNoTracking().ToListAsync();

        Assert.NotEmpty(keys);
    }

    // The reason the key ring is shared at all: a payload protected by one host must still be readable
    // by the next one, which is what a redeploy amounts to. Asserting the second host reuses the stored
    // key rather than minting its own is what makes this specific to database persistence — a
    // file-backed ring on a developer machine would also round-trip, but via the local key directory.
    [Fact]
    public async Task SecondHost_ReusesTheStoredKeyRingInsteadOfCreatingANewOne()
    {
        using var firstHost = new TestWebApplicationFactory();
        var protectedPayload = firstHost.Services
            .GetRequiredService<IDataProtectionProvider>()
            .CreateProtector("FitMate.Tests")
            .Protect("reset-token");

        using var secondHost = new TestWebApplicationFactory(firstHost.Connection);
        var unprotected = secondHost.Services
            .GetRequiredService<IDataProtectionProvider>()
            .CreateProtector("FitMate.Tests")
            .Unprotect(protectedPayload);

        Assert.Equal("reset-token", unprotected);

        using var scope = secondHost.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var keys = await dbContext.DataProtectionKeys.AsNoTracking().ToListAsync();

        Assert.Single(keys);
    }
}
