package com.example.app_smart_trip

import com.google.gson.annotations.SerializedName

// ─── Auth ────────────────────────────────────────────────────────────────────

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName")  val lastName: String,
    val email: String,
    val password: String
)

data class AuthResponse(
    val success: Boolean,
    val token: String?,
    val user: User?,
    val message: String?
)

data class User(
    val id: String,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName")  val lastName: String,
    val email: String
)

// ─── Flights ─────────────────────────────────────────────────────────────────

data class FlightSearchResponse(
    val success: Boolean,
    val flights: List<Flight>,
    val message: String?
)

data class Flight(
    val id: String?,
    val origin: String,
    val destination: String,
    @SerializedName("departureTime") val departureTime: String,
    @SerializedName("arrivalTime")   val arrivalTime: String,
    @SerializedName("returnDepartureTime") val returnDepartureTime: String?,
    @SerializedName("returnArrivalTime")   val returnArrivalTime: String?,
    val airline: String,
    @SerializedName("airlineName") val airlineName: String?,
    val price: Double,
    val currency: String?,
    val duration: String?,
    val stops: Int,
    @SerializedName("bookingLink") val bookingLink: String?,
    @SerializedName("isRoundTrip") val isRoundTrip: Boolean?
)

// ─── Favorites ───────────────────────────────────────────────────────────────

data class FavoritesResponse(
    val success: Boolean,
    val favorites: List<FavoriteItem>
)

data class FavoriteItem(
    val id: String,
    @SerializedName("flight_data") val flightData: Flight?,
    @SerializedName("created_at")  val createdAt: String?
)

data class AddFavoriteRequest(
    @SerializedName("flightData") val flightData: Flight
)

data class GenericResponse(
    val success: Boolean,
    val message: String?
)

// ─── Profile ─────────────────────────────────────────────────────────────────

data class ProfileResponse(
    val success: Boolean,
    val user: User?
)
