package com.example.app_smart_trip

import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ─── Auth ────────────────────────────────────────────────────────────────

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @GET("api/user/profile")
    suspend fun getProfile(@Header("Authorization") token: String): Response<ProfileResponse>

    // ─── Flights ─────────────────────────────────────────────────────────────

    @GET("api/flights/search")
    suspend fun searchFlights(
        @Header("Authorization") token: String,
        @Query("origin")        origin: String,
        @Query("destination")   destination: String,
        @Query("departureDate") departureDate: String,
        @Query("returnDate")    returnDate: String? = null,
        @Query("passengers")    passengers: Int = 1,
        @Query("class")         cabinClass: String = "economy"
    ): Response<FlightSearchResponse>

    // ─── Favorites ───────────────────────────────────────────────────────────

    @GET("api/favorites")
    suspend fun getFavorites(@Header("Authorization") token: String): Response<FavoritesResponse>

    @POST("api/favorites")
    suspend fun addFavorite(
        @Header("Authorization") token: String,
        @Body request: AddFavoriteRequest
    ): Response<GenericResponse>

    @DELETE("api/favorites/{id}")
    suspend fun removeFavorite(
        @Header("Authorization") token: String,
        @Path("id") favoriteId: String
    ): Response<GenericResponse>
}
