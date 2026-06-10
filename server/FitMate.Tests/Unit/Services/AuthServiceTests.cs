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
    public async Task IssueTokensAsync_RevokesPreviouslyActiveTokens()
    {
        using var db = new SqliteTestDatabase();
        var settings = BuildSettings();
        long oldTokenId;
        long oldRefreshTokenId;

        using (var arrange = db.CreateContext())
        {
            oldTokenId = SeedToken(arrange, SqliteTestDatabase.UserId, "old-access", DateTime.UtcNow.AddMinutes(30));
            oldRefreshTokenId = SeedRefreshToken(arrange, SqliteTestDatabase.UserId, "old-refresh", DateTime.UtcNow.AddDays(3));
        }

        var issued = await new AuthService(db.CreateContext(), settings)
            .IssueTokensAsync(MakeUser(SqliteTestDatabase.UserId), new[] { RoleNames.User });

        using var assert = db.CreateContext();

        var oldToken = await assert.Tokens.SingleAsync(x => x.Id == oldTokenId);
        var oldRefreshToken = await assert.RefreshTokens.SingleAsync(x => x.Id == oldRefreshTokenId);
        Assert.NotNull(oldToken.RevokedAtUtc);
        Assert.NotNull(oldRefreshToken.RevokedAtUtc);

        var newToken = await assert.Tokens.SingleAsync(x => x.Value == issued.AccessToken);
        var newRefreshToken = await assert.RefreshTokens.SingleAsync(x => x.Value == issued.RefreshToken);
        Assert.Null(newToken.RevokedAtUtc);
        Assert.Null(newRefreshToken.RevokedAtUtc);
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
    public async Task IssueTokensAsync_RevokesActiveButLeavesAlreadyExpiredTokenUntouched()
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

        var activeToken = await assert.Tokens.SingleAsync(x => x.Id == activeTokenId);
        var expiredToken = await assert.Tokens.SingleAsync(x => x.Id == expiredTokenId);
        Assert.NotNull(activeToken.RevokedAtUtc);
        Assert.Null(expiredToken.RevokedAtUtc);
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
