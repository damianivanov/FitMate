using System.Collections.Generic;
using System.Security.Claims;
using FitMate.Core.JsonModels.Auth;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.Services.Auth;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using UserRoleModel = FitMate.Core.JsonModels.Auth.UserRole;

namespace FitMate.Tests.Unit.Services;

public class AuthServiceTests
{
    private const string AccessSigningKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    private const string RefreshSigningKey = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    private static ApplicationSettings BuildSettings()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SigningKey"] = AccessSigningKey,
                ["Jwt:Issuer"] = "FitMate.Access",
                ["Jwt:Audience"] = "FitMate.Access",
                ["Jwt:ExpirationMinutes"] = "60",
                ["RefreshToken:SigningKey"] = RefreshSigningKey,
                ["RefreshToken:Issuer"] = "FitMate.Refresh",
                ["RefreshToken:Audience"] = "FitMate.Refresh",
                ["RefreshToken:ExpirationDays"] = "7",
            })
            .Build();

        return new ApplicationSettings(configuration);
    }

    private static User MakeUser(long id) => new()
    {
        Id = id,
        Email = "user@test.local",
        UserName = "user@test.local",
        FirstName = "Test",
        LastName = "User1",
    };

    private static long SeedToken(
        AppDbContext db,
        long userId,
        string value,
        DateTime expiresAtUtc,
        DateTime? revokedAtUtc = null)
    {
        var token = new Token
        {
            UserId = userId,
            Value = value,
            ExpiresAtUtc = expiresAtUtc,
            RevokedAtUtc = revokedAtUtc,
        };

        db.Tokens.Add(token);
        db.SaveChanges();
        return token.Id;
    }

    private static long SeedRefreshToken(
        AppDbContext db,
        long userId,
        string value,
        DateTime expiresAtUtc,
        DateTime? revokedAtUtc = null)
    {
        var refreshToken = new RefreshToken
        {
            UserId = userId,
            Value = value,
            ExpiresAtUtc = expiresAtUtc,
            RevokedAtUtc = revokedAtUtc,
        };

        db.RefreshTokens.Add(refreshToken);
        db.SaveChanges();
        return refreshToken.Id;
    }

    [Fact]
    public async Task IssueTokensAsync_PersistsNewAccessAndRefreshToken()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        var nowBoundary = DateTime.UtcNow;

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        Assert.InRange(issued.AccessTokenExpiresAtUtc, nowBoundary.AddMinutes(59), nowBoundary.AddMinutes(61));
        Assert.InRange(issued.RefreshTokenExpiresAtUtc, nowBoundary.AddDays(7).AddMinutes(-1), nowBoundary.AddDays(7).AddMinutes(1));
        Assert.True(issued.AccessTokenExpiresAtUtc < issued.RefreshTokenExpiresAtUtc);

        using var assert = db.CreateContext();

        var tokens = await assert.Tokens
            .Where(x => x.UserId == SqliteTestDatabase.UserId && x.RevokedAtUtc == null)
            .ToListAsync();

        var refreshTokens = await assert.RefreshTokens
            .Where(x => x.UserId == SqliteTestDatabase.UserId && x.RevokedAtUtc == null)
            .ToListAsync();

        Assert.Single(tokens);
        Assert.Single(refreshTokens);
        Assert.Equal(issued.AccessToken, tokens[0].Value);
        Assert.Equal(issued.RefreshToken, refreshTokens[0].Value);
    }

    [Fact]
    public async Task IssueTokensAsync_Login_LeavesExistingSessionsActive()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        long deviceAccessId;
        long deviceRefreshId;

        using (var arrange = db.CreateContext())
        {
            deviceAccessId = SeedToken(arrange, SqliteTestDatabase.UserId, "device-a-access", DateTime.UtcNow.AddMinutes(30));
            deviceRefreshId = SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "device-a-refresh", DateTime.UtcNow.AddDays(3));
        }

        // A fresh login (no rotated tokens) adds a new session and must not disturb the existing one.
        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        using var assert = db.CreateContext();

        var deviceAccess = await assert.Tokens.SingleAsync(x => x.Id == deviceAccessId);
        var deviceRefresh = await assert.RefreshTokens.SingleAsync(x => x.Id == deviceRefreshId);
        Assert.Null(deviceAccess.RevokedAtUtc);
        Assert.Null(deviceRefresh.RevokedAtUtc);

        var activeRefreshTokens = await assert.RefreshTokens
            .Where(x => x.UserId == SqliteTestDatabase.UserId && x.RevokedAtUtc == null)
            .ToListAsync();

        Assert.Equal(2, activeRefreshTokens.Count);
        Assert.Contains(activeRefreshTokens, x => x.Value == "device-a-refresh");
        Assert.Contains(activeRefreshTokens, x => x.Value == issued.RefreshToken);
    }

    [Fact]
    public async Task IssueTokensAsync_DoesNotRevokeOtherUsersActiveTokens()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        long otherTokenId;

        using (var arrange = db.CreateContext())
        {
            otherTokenId = SeedToken(arrange, SqliteTestDatabase.OtherUserId, "other-access", DateTime.UtcNow.AddMinutes(30));
        }

        await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        using var assert = db.CreateContext();

        var otherToken = await assert.Tokens.SingleAsync(x => x.Id == otherTokenId);
        Assert.Null(otherToken.RevokedAtUtc);
    }

    [Fact]
    public async Task IssueTokensAsync_RemovesExpiredAccessTokensButKeepsActiveOnes()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        long activeTokenId;
        long expiredTokenId;

        using (var arrange = db.CreateContext())
        {
            activeTokenId = SeedToken(arrange, SqliteTestDatabase.UserId, "active-access", DateTime.UtcNow.AddMinutes(30));
            expiredTokenId = SeedToken(arrange, SqliteTestDatabase.UserId, "expired-access", DateTime.UtcNow.AddMinutes(-30));
        }

        await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        using var assert = db.CreateContext();

        // Active access tokens from other sessions are left alone; expired rows are pruned away.
        var activeToken = await assert.Tokens.SingleAsync(x => x.Id == activeTokenId);
        Assert.Null(activeToken.RevokedAtUtc);
        Assert.False(await assert.Tokens.AnyAsync(x => x.Id == expiredTokenId));
    }

    [Fact]
    public async Task IssueTokensAsync_CapsActiveRefreshTokensAtMaximum()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        long oldestRefreshId;

        using (var arrange = db.CreateContext())
        {
            // Fill the cap (5) with active sessions; the first seeded row is the oldest.
            oldestRefreshId = SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "refresh-1", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "refresh-2", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "refresh-3", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "refresh-4", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "refresh-5", DateTime.UtcNow.AddDays(3));
        }

        // A sixth device login evicts the oldest session; the total stays capped at 5.
        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        using var assert = db.CreateContext();

        var refreshTokens = await assert.RefreshTokens
            .Where(x => x.UserId == SqliteTestDatabase.UserId)
            .ToListAsync();

        Assert.Equal(5, refreshTokens.Count);
        Assert.DoesNotContain(refreshTokens, x => x.Id == oldestRefreshId);
        Assert.Contains(refreshTokens, x => x.Value == issued.RefreshToken);
    }

    [Fact]
    public async Task IssueTokensAsync_Refresh_RotatesPresentedPairAndKeepsOtherSessions()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        long rotatedAccessId;
        long rotatedRefreshId;
        long otherRefreshId;

        using (var arrange = db.CreateContext())
        {
            rotatedAccessId = SeedToken(arrange, SqliteTestDatabase.UserId, "this-access", DateTime.UtcNow.AddMinutes(30));
            rotatedRefreshId = SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "this-refresh", DateTime.UtcNow.AddDays(3));
            otherRefreshId = SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "other-device-refresh", DateTime.UtcNow.AddDays(3));
        }

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User }, "this-access", "this-refresh");

        using var assert = db.CreateContext();

        // The presented access token is revoked (kept as a deny-list row) and the presented refresh
        // token is deleted, so a replay of either fails.
        var rotatedAccess = await assert.Tokens.SingleAsync(x => x.Id == rotatedAccessId);
        Assert.NotNull(rotatedAccess.RevokedAtUtc);
        Assert.False(await assert.RefreshTokens.AnyAsync(x => x.Id == rotatedRefreshId));

        // The other device's session is untouched and the freshly issued pair is active.
        var otherRefresh = await assert.RefreshTokens.SingleAsync(x => x.Id == otherRefreshId);
        Assert.Null(otherRefresh.RevokedAtUtc);
        Assert.True(await assert.RefreshTokens.AnyAsync(x => x.Value == issued.RefreshToken && x.RevokedAtUtc == null));
    }

    [Fact]
    public async Task IssueTokensAsync_DeadRefreshTokensDoNotConsumeCapSlots()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();

        using (var arrange = db.CreateContext())
        {
            // 4 active + 1 already-revoked. The revoked row must be cleaned out rather than counted,
            // so the new login does not evict one of the active sessions.
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "active-1", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "active-2", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "active-3", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "active-4", DateTime.UtcNow.AddDays(3));
            SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "revoked", DateTime.UtcNow.AddDays(3), DateTime.UtcNow.AddMinutes(-5));
        }

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        using var assert = db.CreateContext();

        var refreshTokens = await assert.RefreshTokens
            .Where(x => x.UserId == SqliteTestDatabase.UserId)
            .ToListAsync();

        Assert.Equal(5, refreshTokens.Count);
        Assert.All(refreshTokens, x => Assert.Null(x.RevokedAtUtc));
        Assert.Contains(refreshTokens, x => x.Value == "active-1");
        Assert.Contains(refreshTokens, x => x.Value == issued.RefreshToken);
    }

    [Fact]
    public async Task TryValidateRefreshToken_IssuedRefreshToken_ReturnsTrueWithUserPrincipal()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        var result = new AuthService(db.CreateContext(), settings)
            .TryValidateRefreshToken(issued.RefreshToken, out var principal);

        Assert.True(result);
        Assert.Equal(
            SqliteTestDatabase.UserId.ToString(),
            principal.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    }

    [Fact]
    public void TryValidateRefreshToken_GarbageToken_ReturnsFalse()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();

        var result = new AuthService(db.CreateContext(), settings)
            .TryValidateRefreshToken("not-a-jwt", out _);

        Assert.False(result);
    }

    [Fact]
    public async Task TryValidateRefreshToken_AccessTokenRejected_ReturnsFalse()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        var result = new AuthService(db.CreateContext(), settings)
            .TryValidateRefreshToken(issued.AccessToken, out _);

        Assert.False(result);
    }

    [Fact]
    public async Task RevokeTokensAsync_RevokesMatchingActiveTokens()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        await new AuthService(db.CreateContext(), settings)
            .RevokeTokensAsync(issued.AccessToken, issued.RefreshToken, SqliteTestDatabase.UserId);

        using var assert = db.CreateContext();

        var token = await assert.Tokens.SingleAsync(x => x.Value == issued.AccessToken);
        var refreshToken = await assert.RefreshTokens.SingleAsync(x => x.Value == issued.RefreshToken);
        Assert.NotNull(token.RevokedAtUtc);
        Assert.NotNull(refreshToken.RevokedAtUtc);
    }

    [Fact]
    public async Task RevokeTokensAsync_NullValues_DoesNotThrowAndLeavesTokensActive()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        await new AuthService(db.CreateContext(), settings)
            .RevokeTokensAsync(null, null, SqliteTestDatabase.UserId);

        using var assert = db.CreateContext();

        var token = await assert.Tokens.SingleAsync(x => x.Value == issued.AccessToken);
        var refreshToken = await assert.RefreshTokens.SingleAsync(x => x.Value == issued.RefreshToken);
        Assert.Null(token.RevokedAtUtc);
        Assert.Null(refreshToken.RevokedAtUtc);
    }

    [Fact]
    public void BuildUserModel_MapsKnownRolesDistinctAndIgnoresUnknown()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        var user = new User
        {
            Id = SqliteTestDatabase.UserId,
            Email = "user@test.local",
            FirstName = "Test",
            LastName = "User1",
        };

        var model = new AuthService(db.CreateContext(), settings)
            .BuildUserModel(user, new[] { RoleNames.User, RoleNames.Admin, RoleNames.User.ToLowerInvariant(), "ghost" });

        Assert.Equal(2, model.Roles.Count);
        Assert.Contains(UserRoleModel.User, model.Roles);
        Assert.Contains(UserRoleModel.Admin, model.Roles);
        Assert.Equal(SqliteTestDatabase.UserId, model.Id);
        Assert.Equal("user@test.local", model.Email);
        Assert.Equal("Test", model.FirstName);
        Assert.Equal("User1", model.LastName);
    }

    [Fact]
    public void BuildUserModel_NullEmail_BecomesEmptyString()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();

        var model = new AuthService(db.CreateContext(), settings)
            .BuildUserModel(new User { Id = 7, Email = null }, System.Array.Empty<string>());

        Assert.Equal(string.Empty, model.Email);
        Assert.Empty(model.Roles);
    }
}
